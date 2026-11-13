import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/admin.ts';
import { isServiceCall } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { nextCronTime } from '../_shared/cron.ts';
import { pauseLink, postToDiscord } from '../_shared/ops.ts';
import { isValidTimeZone } from '../_shared/time.ts';

// Every 5 minutes (pg_cron): starts scheduled bots that are due and triggered
// bots with queued events. Each run goes out through pg_net, so this returns
// quickly and runs don't share one function's time limit.

const RUN_ALERT_THRESHOLD = 50;

async function timezones(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { data } = await admin.from('user_settings').select('user_id, timezone').in('user_id', userIds);
  return new Map(
    userIds.map((id) => {
      const tz = data?.find((r) => r.user_id === id)?.timezone;
      return [id, isValidTimeZone(tz) ? tz : 'UTC'];
    })
  );
}

const startRun = (body: Record<string, unknown>) =>
  admin.rpc('invoke_edge_function', { p_name: 'run-bot', p_body: body });

async function dueScheduledBots(now: Date): Promise<number> {
  const { data: bots, error } = await admin
    .from('meeples')
    .select('id, user_id, schedule, next_run_at')
    .eq('kind', 'scheduled')
    .eq('enabled', true)
    .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);
  if (error) throw error;

  const tzs = await timezones([...new Set((bots ?? []).map((b) => b.user_id))]);
  let started = 0;
  for (const bot of bots ?? []) {
    let next: Date | null = null;
    try {
      next = nextCronTime(bot.schedule, now, tzs.get(bot.user_id) ?? 'UTC');
    } catch (err) {
      console.warn(`[bot-tick] bad schedule on ${bot.id}:`, err);
    }
    await admin.from('meeples').update({ next_run_at: next?.toISOString() ?? null }).eq('id', bot.id);
    // A bot seen for the first time (no next_run_at yet) just gets scheduled.
    if (bot.next_run_at) {
      await startRun({ meepleId: bot.id, mode: 'schedule' });
      started++;
    }
  }
  return started;
}

async function queuedEvents(): Promise<number> {
  const { data: events, error } = await admin
    .from('bot_events')
    .select('id, user_id, type, payload')
    .is('processed_at', null)
    .order('created_at')
    .limit(500);
  if (error) throw error;
  if (!events?.length) return 0;

  // One run per bot per tick, carrying every event it was waiting on.
  const groups = new Map<string, { userId: string; type: string; payloads: unknown[] }>();
  for (const e of events) {
    const key = `${e.user_id}|${e.type}`;
    const g = groups.get(key) ?? { userId: e.user_id, type: e.type, payloads: [] as unknown[] };
    g.payloads.push(e.payload);
    groups.set(key, g);
  }

  let started = 0;
  for (const g of groups.values()) {
    const { data: bots } = await admin
      .from('meeples')
      .select('id')
      .eq('user_id', g.userId)
      .eq('kind', 'triggered')
      .eq('enabled', true)
      .eq('trigger', g.type);
    for (const bot of bots ?? []) {
      await startRun({ meepleId: bot.id, mode: 'event', event: g.type, payloads: g.payloads.slice(0, 20) });
      started++;
    }
  }

  await admin
    .from('bot_events')
    .update({ processed_at: new Date().toISOString() })
    .in('id', events.map((e) => e.id));
  return started;
}

/** No hard cap: past 50 runs in a (UTC) day, tell the team once, with a pause link. */
async function alertBusyUsers(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const { data: runs } = await admin
    .from('bot_runs')
    .select('user_id')
    .gte('started_at', `${day}T00:00:00Z`)
    .neq('status', 'skipped')
    .limit(20000);
  const counts = new Map<string, number>();
  for (const r of runs ?? []) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);

  for (const [userId, count] of counts) {
    if (count <= RUN_ALERT_THRESHOLD) continue;
    const { data: inserted } = await admin
      .from('ops_alerts')
      .upsert({ user_id: userId, day, kind: 'runs_over_50' }, { onConflict: 'user_id,day,kind', ignoreDuplicates: true })
      .select('user_id');
    if (!inserted?.length) continue; // already alerted today
    await postToDiscord(
      `🫠 A meeple is being overly productive: user \`${userId}\` has had ${count} bot runs today (UTC).\n` +
        `Pause their bots for 24h: ${await pauseLink(userId)}\n` +
        `Stop every bot: set \`app_config.bots_paused\` to \`true\`.`
    );
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!isServiceCall(req)) return json({ error: 'Forbidden' }, 403);

  try {
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'bots_paused').maybeSingle();
    if (cfg?.value === true) return json({ paused: true });

    const now = new Date();
    const scheduled = await dueScheduledBots(now);
    const triggered = await queuedEvents();
    await alertBusyUsers(now);
    return json({ scheduled, triggered });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isServiceCall, userIdFrom } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { loadBot, type RunTrigger, runBot } from '../_shared/bots.ts';
import { anthropicErrorResponse } from '../_shared/anthropic.ts';

// Runs one bot. bot-tick calls it (through pg_net) for scheduled and triggered
// runs; the app calls it for chat turns with a bot, "Run now", and the dry run
// after creating or editing one.

type Body =
  | { meepleId: string; mode: 'schedule' }
  | { meepleId: string; mode: 'event'; event: string; payloads: Record<string, unknown>[] }
  | { meepleId: string; mode: 'chat'; message: string }
  | { meepleId: string; mode: 'dry_run' | 'manual' };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = (await req.json()) as Body;
    const service = isServiceCall(req);
    const userId = service ? null : await userIdFrom(req);
    if (!service && !userId) return json({ error: 'Not signed in' }, 401);

    const bot = await loadBot(body.meepleId);
    if (!bot || (userId && bot.user_id !== userId)) return json({ error: 'No such bot' }, 404);

    let trigger: RunTrigger;
    switch (body.mode) {
      case 'schedule':
        trigger = { type: 'schedule' };
        break;
      case 'event':
        trigger = { type: 'event', event: body.event, payloads: body.payloads ?? [] };
        break;
      case 'chat':
        if (!body.message?.trim()) return json({ error: 'Empty message' }, 400);
        trigger = { type: 'chat', message: body.message };
        break;
      case 'dry_run':
        trigger = { type: 'dry_run' };
        break;
      case 'manual':
        trigger = { type: 'manual' };
        break;
      default:
        return json({ error: 'Unknown mode' }, 400);
    }
    // Background runs are the server's to start.
    if (!service && (trigger.type === 'schedule' || trigger.type === 'event')) return json({ error: 'Forbidden' }, 403);

    return json(await runBot(bot, trigger));
  } catch (err) {
    const apiError = anthropicErrorResponse(err);
    if (apiError) return json({ error: apiError.error }, apiError.status);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

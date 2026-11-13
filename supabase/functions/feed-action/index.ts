import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/admin.ts';
import { userIdFrom } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { applyChange, type FeedPayload, loadBot, recheck, undoChanges, withEdits } from '../_shared/bots.ts';

// Approve (all, or some), dismiss, or undo a feed item. Approved changes are
// applied on the bot's behalf; undo works until the block is touched again.

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const userId = await userIdFrom(req);
    if (!userId) return json({ error: 'Not signed in' }, 401);
    const { itemId, action, changeIds, edits } = (await req.json()) as {
      itemId: string;
      action: 'approve' | 'dismiss' | 'undo';
      changeIds?: string[];
      /** New times for some changes, from tweaking them on the day view. */
      edits?: Record<string, { start: string; end: string }>;
    };

    const { data: item } = await admin.from('feed_items').select('*').eq('id', itemId).eq('user_id', userId).maybeSingle();
    if (!item) return json({ error: 'Not found' }, 404);
    const payload = item.payload as FeedPayload;

    if (action === 'dismiss') {
      if (item.status !== 'pending') return json({ error: 'Already handled' }, 409);
      await admin.from('feed_items').update({ status: 'dismissed' }).eq('id', itemId);
      return json({ ok: true });
    }

    if (action === 'approve') {
      if (item.type !== 'proposal' || item.status !== 'pending') return json({ error: 'Already handled' }, 409);
      const bot = await loadBot(item.meeple_id);
      if (!bot) return json({ error: 'That bot was deleted' }, 410);

      const all = withEdits(payload.changes, edits);
      const chosen = new Set(changeIds ?? all.map((c) => c.id));
      const selected = all.filter((c) => chosen.has(c.id));
      if (!selected.length) return json({ error: 'Nothing selected' }, 400);
      const problem = await recheck(userId, selected);
      if (problem) return json({ error: `Things have moved since: ${problem}` }, 409);

      const changes = [];
      for (const c of all) changes.push(chosen.has(c.id) ? await applyChange(bot, c) : c);
      const anyApplied = changes.some((c) => c.applied);
      await admin
        .from('feed_items')
        .update({
          payload: { ...payload, changes },
          status: anyApplied ? 'applied' : 'pending',
          applied_at: anyApplied ? new Date().toISOString() : null,
        })
        .eq('id', itemId);
      const failed = changes.find((c) => chosen.has(c.id) && !c.applied);
      return failed ? json({ error: failed.error ?? 'Some changes could not be applied' }, anyApplied ? 207 : 409) : json({ ok: true });
    }

    if (action === 'undo') {
      if (item.status !== 'applied') return json({ error: 'Nothing to undo' }, 409);
      const problem = await undoChanges(userId, payload.changes);
      if (problem) return json({ error: problem }, 409);
      await admin.from('feed_items').update({ status: 'undone' }).eq('id', itemId);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

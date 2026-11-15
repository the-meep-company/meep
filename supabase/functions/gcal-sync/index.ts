import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/admin.ts';
import { isServiceCall, userIdFrom } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { syncUser } from '../_shared/gcalSync.ts';

// Pulls Google Calendar into the events table. pg_cron calls it every 10 minutes
// with { all: true } and the service-role key; the app calls it for "Sync now".

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));

    if (body.all) {
      if (!isServiceCall(req)) return json({ error: 'Forbidden' }, 403);
      const { data: users, error } = await admin.from('google_credentials').select('user_id');
      if (error) throw error;
      const summary: Record<string, unknown> = {};
      // One user at a time keeps us well inside Google's per-project rate limits.
      for (const { user_id } of users ?? []) {
        try {
          summary[user_id] = await syncUser(user_id);
        } catch (err) {
          summary[user_id] = { error: err instanceof Error ? err.message : String(err) };
        }
      }
      return json({ users: Object.keys(summary).length, summary });
    }

    const userId = await userIdFrom(req);
    if (!userId) return json({ error: 'Not signed in' }, 401);
    return json(await syncUser(userId));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

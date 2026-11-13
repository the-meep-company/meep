import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/admin.ts';
import { userIdFrom } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { syncUser } from '../_shared/gcalSync.ts';

// Stores the Google refresh token captured at sign-in (into Vault) and runs a
// first sync, or disconnects Google and removes everything synced from it.

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const userId = await userIdFrom(req);
    if (!userId) return json({ error: 'Not signed in' }, 401);
    const { refreshToken, disconnect } = (await req.json()) as { refreshToken?: string; disconnect?: boolean };

    if (disconnect) {
      await admin.rpc('delete_google_credentials', { p_user_id: userId });
      await admin.from('events').delete().eq('user_id', userId).not('google_event_id', 'is', null);
      await admin.from('google_calendars').delete().eq('user_id', userId);
      return json({ connected: false });
    }

    if (!refreshToken) return json({ error: 'refreshToken is required' }, 400);
    const { error } = await admin.rpc('store_google_refresh_token', { p_user_id: userId, p_token: refreshToken });
    if (error) throw error;
    return json(await syncUser(userId));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

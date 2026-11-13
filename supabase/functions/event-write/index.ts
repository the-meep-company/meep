import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { userIdFrom } from '../_shared/auth.ts';
import { CORS, json } from '../_shared/cors.ts';
import { type EventChange, writeEvent, WriteError } from '../_shared/eventWrite.ts';

// The app's path for changing events that live in Google, so the edit reaches
// Google instead of being overwritten on the next sync.

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const userId = await userIdFrom(req);
    if (!userId) return json({ error: 'Not signed in' }, 401);
    const change = (await req.json()) as EventChange;
    if (change.op !== 'upsert' && change.op !== 'delete') return json({ error: 'Unknown op' }, 400);
    if (change.op === 'upsert') delete change.extendedProperties;

    const row = await writeEvent(userId, change, 'user');
    return json({ event: row });
  } catch (err) {
    if (err instanceof WriteError) return json({ error: err.message }, err.status);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

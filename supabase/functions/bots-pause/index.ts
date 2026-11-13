import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/admin.ts';
import { verifyPauseLink } from '../_shared/ops.ts';

// The one-tap link in the Discord alert: pauses one user's bots for 24 hours.
// No sign-in; the link carries an HMAC signature and expires after 7 days.

const page = (text: string, status = 200) =>
  new Response(`<!doctype html><meta name="viewport" content="width=device-width"><p style="font:16px system-ui;margin:2rem">${text}</p>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('u') ?? '';
  const exp = url.searchParams.get('exp') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  if (!(await verifyPauseLink(userId, exp, sig))) return page('This pause link is invalid or has expired.', 403);

  const until = new Date(Date.now() + 24 * 3600000).toISOString();
  const { error } = await admin
    .from('user_settings')
    .upsert({ user_id: userId, bots_paused_until: until }, { onConflict: 'user_id' });
  if (error) return page(`Couldn't pause: ${error.message}`, 500);
  return page(`Paused bots for user ${userId} until ${until}. Clear user_settings.bots_paused_until to resume early.`);
});

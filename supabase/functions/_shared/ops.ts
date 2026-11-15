// Ops alerts to the team's Discord (#overly-productive-meeple), plus the signed
// one-tap "pause this user's bots" link included in them.

const encoder = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('BOTS_PAUSE_SECRET') ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A link that pauses one user's bots for 24 hours. Valid for 7 days. */
export async function pauseLink(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const sig = await hmac(`${userId}.${exp}`);
  const params = new URLSearchParams({ u: userId, exp: String(exp), sig });
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/bots-pause?${params}`;
}

export async function verifyPauseLink(userId: string, exp: string, sig: string): Promise<boolean> {
  if (!Deno.env.get('BOTS_PAUSE_SECRET')) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(`${userId}.${exp}`);
  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function postToDiscord(content: string): Promise<void> {
  const url = Deno.env.get('DISCORD_OPS_WEBHOOK_URL');
  if (!url) {
    console.warn('[ops] DISCORD_OPS_WEBHOOK_URL is not set:', content);
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) console.warn('[ops] Discord webhook failed:', res.status, await res.text());
}

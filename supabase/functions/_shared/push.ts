import { admin } from './admin.ts';

// Push through Expo's push service to every device the user registered
// (push_tokens, filled by the app's lib/push.ts). Quiet on purpose: no sound,
// no badge. Tokens Expo reports as gone are removed.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface Ticket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export async function sendPush(userId: string, title: string, body: string, data: Record<string, unknown> = {}) {
  const { data: rows } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  if (!rows?.length) return;

  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(rows.map((r) => ({ to: r.token, title, body, data: { ...data, url: '/chat' } }))),
  });
  if (!res.ok) throw new Error(`Expo push ${res.status}: ${await res.text()}`);

  const { data: tickets } = (await res.json()) as { data?: Ticket[] };
  const gone = rows.filter((_, i) => tickets?.[i]?.details?.error === 'DeviceNotRegistered').map((r) => r.token);
  if (gone.length) await admin.from('push_tokens').delete().in('token', gone);
}

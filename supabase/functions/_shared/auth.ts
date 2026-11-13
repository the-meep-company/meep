import { admin } from './admin.ts';

function bearer(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** True when the caller is pg_cron / another function using the service-role key. */
export function isServiceCall(req: Request): boolean {
  const token = bearer(req);
  return !!token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

/** The signed-in user behind the request's JWT, or null. */
export async function userIdFrom(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

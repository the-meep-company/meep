import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Service-role client: bypasses RLS, so every query must scope by user_id itself.
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

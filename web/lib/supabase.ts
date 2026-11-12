import { createClient } from "@supabase/supabase-js";

// Browser-only client: the session lives in localStorage, like the Expo web build.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

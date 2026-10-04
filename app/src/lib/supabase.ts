import { createClient } from '@supabase/supabase-js'

// The anon (public) key is the only key the app ever holds. Everything it
// can read or change is decided by row-level security in the database.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
)

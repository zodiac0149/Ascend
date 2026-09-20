import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Admin client with service role — bypasses RLS for server-side operations
const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client — for verifying user JWTs
const supabaseAnon: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

export { supabaseAdmin, supabaseAnon };

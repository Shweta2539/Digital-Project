import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('FATAL: SUPABASE_URL environment variable is missing.');
}
if (!supabaseServiceKey) {
  throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
}

// Service-role client for backend operations (bypasses RLS where needed)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Public client for reading public data
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error('FATAL: SUPABASE_ANON_KEY environment variable is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

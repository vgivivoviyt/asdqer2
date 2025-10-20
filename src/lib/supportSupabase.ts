import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Separate Supabase client for support portal with isolated auth session
export const supportSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'supabase-support-auth', // Separate session storage key
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false // Prevent URL-based session detection conflicts
  }
});

// Export for type compatibility
export { supportSupabase as supabase };
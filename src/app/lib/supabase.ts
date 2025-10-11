import { createClient } from "@supabase/supabase-js";
import { env } from '../../types/env';

// Server-side client (for API routes)
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false }
  }
);

// Alias for server client
export const createServerClient = () => supabase;

// Client-side auth client
export const createBrowserClient = () => {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
};

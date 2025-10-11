import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

// Client-side auth client singleton with global storage
const BROWSER_CLIENT_KEY = '__codemind_supabase_client__';

interface GlobalSupabaseClient {
  __codemind_supabase_client__?: SupabaseClient;
}

export const createBrowserClient = () => {
  if (typeof window === 'undefined') {
    // Server-side: create a new client for each request
    return createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
  }

  // Client-side: use global singleton
  const globalClient = globalThis as typeof globalThis & GlobalSupabaseClient;
  
  if (!globalClient[BROWSER_CLIENT_KEY]) {
    globalClient[BROWSER_CLIENT_KEY] = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'codemind-auth-token', // Use a custom storage key
        }
      }
    );
  }

  return globalClient[BROWSER_CLIENT_KEY]!;
};

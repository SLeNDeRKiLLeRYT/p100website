// lib/supabase-server.ts (After)
import { createClient as _createServerClient } from '@supabase/supabase-js';
import type { Database } from './supabase-client';

export const createServerClient = () => {
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // This is the key change.
      // It forces all server-side fetch requests made by this Supabase client
      // to bypass the Next.js Data Cache.
      global: {
        fetch: async (input, init) => {
          return fetch(input, { ...init, cache: 'no-store' });
        },
      },
    }
  );
};
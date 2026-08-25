// lib/supabase-admin.ts
// SERVER-ONLY Supabase client holding the secret (service-role) key.
// `server-only` makes the build FAIL if a client component ever imports this,
// which is the guardrail that stops the key leaking into the browser bundle.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-client';

export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // NOTE: no NEXT_PUBLIC_ prefix. Never add one to this variable.
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be defined (server env only).'
    );
  }

  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetch },
  });
};

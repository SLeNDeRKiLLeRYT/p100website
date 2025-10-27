import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Type definitions for your database schema (no changes needed here)
export type Database = {
  public: {
    Tables: {
      killers: { Row: { id: string; name: string; image_url: string; order: number | null; background_image_url: string | null; created_at: string; updated_at: string; header_url: string | null; artist_urls: string[] | null; legacy_header_urls: string[] | null; }; Insert: { id: string; name: string; image_url: string; order?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; Update: { id?: string; name?: string; image_url?: string; order?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; };
      survivors: { Row: { id: string; name: string; image_url: string; order_num: number | null; background_image_url: string | null; created_at: string; updated_at: string; header_url: string | null; artist_urls: string[] | null; legacy_header_urls: string[] | null; }; Insert: { id: string; name: string; image_url: string; order_num?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; Update: { id?: string; name?: string; image_url?: string; order_num?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; };
  p100_players: { Row: { id: string; username: string; killer_id: string | null; survivor_id: string | null; added_at: string; p200: boolean | null; legacy: boolean | null; favorite: boolean | null; priority: number | null; }; Insert: { id?: string; username: string; killer_id?: string | null; survivor_id?: string | null; added_at?: string; p200: boolean | null; legacy?: boolean | null; favorite?: boolean | null; priority?: number | null; }; Update: { id?: string; username?: string; killer_id?: string | null; survivor_id?: string | null; added_at?: string; p200: boolean | null; legacy?: boolean | null; favorite?: boolean | null; priority?: number | null; }; };
      p100_submissions: { Row: { id: string; username: string; killer_id: string | null; survivor_id: string | null; screenshot_url: string; status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null; submitted_at: string; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string; comment: string | null; legacy: boolean | null; }; Insert: { id?: string; username: string; killer_id?: string | null; survivor_id?: string | null; screenshot_url: string; status?: 'pending' | 'approved' | 'rejected'; rejection_reason?: string | null; submitted_at?: string; reviewed_at?: string | null; reviewed_by?: string | null; created_at?: string; updated_at?: string; comment?: string | null; legacy?: boolean | null; }; Update: { id?: string; username?: string; killer_id?: string | null; survivor_id?: string | null; screenshot_url?: string; status?: 'pending' | 'approved' | 'rejected'; rejection_reason?: string | null; submitted_at?: string; reviewed_at?: string | null; reviewed_by?: string | null; created_at?: string; updated_at?: string; comment?: string | null; legacy?: boolean | null; }; };
      artists: { Row: { id: string; name: string; url: string; platform: 'twitter' | 'instagram' | 'youtube'; slug: string; created_at: string; updated_at: string; }; Insert: { id?: string; name: string; url: string; platform: 'twitter' | 'instagram' | 'youtube'; created_at?: string; updated_at?: string; }; Update: { id?: string; name?: string; url?: string; platform?: 'twitter' | 'instagram' | 'youtube'; created_at?: string; updated_at?: string; }; };
    };
  };
};

// =========================================================================
// SINGLETON CLIENT FOR BROWSER COMPONENTS ('use client')
// =========================================================================

// This helper function creates the client but is NOT exported.
const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and anonymous key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, supabaseServiceKey ? {
    auth: { persistSession: false },
  } : {});
};

// Create ONE single instance of the Supabase client for the browser / HMR.
// In dev, Next.js fast refresh can re-evaluate modules; use globalThis cache.
const getBrowserClient = () => {
  const g = globalThis as any;
  if (!g.__supabase_browser_client) {
    g.__supabase_browser_client = createClient();
  }
  return g.__supabase_browser_client as ReturnType<typeof createClient>;
};

const supabase = getBrowserClient();

// Export the singleton instance as the default export.
export default supabase;

// =========================================================================
// FACTORY FUNCTIONS FOR SERVER & ADMIN (These are fine as they are)
// =========================================================================

export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { fetch: fetch },
  });
};

export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and service role key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, supabaseServiceKey ? {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetch },
  } : {});
};

// =========================================================================
// UTILITY FUNCTIONS (No changes needed)
// =========================================================================

export const validateInput = {
  username: (username: string): boolean => {
    // Allow most human-friendly usernames, including Unicode letters (e.g., Zoë),
    // numbers, punctuation, emojis, and spaces. We only block control chars and angle brackets.
    // Note: username is sanitized before use, so this complements sanitizeInput.
    return typeof username === 'string' &&
           username.length >= 1 &&
           username.length <= 50 &&
           /^[^\p{C}<>]+$/u.test(username);
  },
  
  characterId: (id: string, type: 'killer' | 'survivor'): boolean => {
    return typeof id === 'string' && 
           id.length >= 1 && 
           id.length <= 50 && 
           /^[a-zA-Z0-9_\-]+$/.test(id);
  },
  
  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

// sanitizeInput: relaxed to allow most printable characters (including common special chars)
// Still strips executable vectors (script tags, javascript: urls, inline handlers) and escapes angle brackets.
// NOTE: If further tightening needed, consider a whitelist per field instead of generic sanitizer.
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .trim()
    // Remove script tags entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Neutralize javascript: style protocols
    .replace(/javascript:/gi, '')
    // Strip inline event handlers like onerror=, onclick=
    .replace(/on[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, '')
    // Escape only angle brackets to prevent HTML injection while keeping other special chars
    .replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'))
    // Normalize weird unicode spaces
    .replace(/[\u00A0\u2000-\u200F]/g, ' ')
    // Collapse excessive whitespace
    .replace(/\s{2,}/g, ' ');
};
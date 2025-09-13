import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Type definitions for your database schema (no changes needed here)
export type Database = {
  public: {
    Tables: {
      killers: { Row: { id: string; name: string; image_url: string; order: number | null; background_image_url: string | null; created_at: string; updated_at: string; header_url: string | null; artist_urls: string[] | null; legacy_header_urls: string[] | null; }; Insert: { id: string; name: string; image_url: string; order?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; Update: { id?: string; name?: string; image_url?: string; order?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; };
      survivors: { Row: { id: string; name: string; image_url: string; order_num: number | null; background_image_url: string | null; created_at: string; updated_at: string; header_url: string | null; artist_urls: string[] | null; legacy_header_urls: string[] | null; }; Insert: { id: string; name: string; image_url: string; order_num?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; Update: { id?: string; name?: string; image_url?: string; order_num?: number | null; background_image_url?: string | null; created_at?: string; updated_at?: string; header_url?: string | null; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; }; };
      p100_players: { Row: { id: string; username: string; killer_id: string | null; survivor_id: string | null; added_at: string; p200: boolean | null; legacy: boolean | null; favorite: boolean | null; }; Insert: { id?: string; username: string; killer_id?: string | null; survivor_id?: string | null; added_at?: string; p200: boolean | null; legacy?: boolean | null; favorite?: boolean | null; }; Update: { id?: string; username?: string; killer_id?: string | null; survivor_id?: string | null; added_at?: string; p200: boolean | null; legacy?: boolean | null; favorite?: boolean | null; }; };
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

// Create ONE single instance of the Supabase client for the browser.
const supabase = createClient();

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
    return typeof username === 'string' && 
           username.length >= 1 && 
           username.length <= 50 && 
           /^[a-zA-Z0-9_\-\s]+$/.test(username);
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

export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=\s*['"]/gi, '') // Remove event handlers
    .replace(/[<>]/g, (char) => {
      // Only escape angle brackets, allow other special characters
      const entityMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;'
      };
      return entityMap[char] || char;
    });
};
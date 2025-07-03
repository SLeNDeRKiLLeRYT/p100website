import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Type definitions for database 
export type Database = {
  public: {
    Tables: {
      killers: {        Row: {
          id: string;
          name: string;
          image_url: string;
          order: number | null;
          background_image_url: string | null;
          created_at: string;
          updated_at: string;
          header_url: string | null;
          artist_urls: string[] | null;
          legacy_header_urls: string[] | null;
        };        Insert: {
          id: string;
          name: string;
          image_url: string;
          order?: number | null;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          header_url?: string | null;
          artist_urls?: string[] | null;
          legacy_header_urls?: string[] | null;
        };        Update: {
          id?: string;
          name?: string;
          image_url?: string;
          order?: number | null;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          header_url?: string | null;
          artist_urls?: string[] | null;
          legacy_header_urls?: string[] | null;
        };
      };
      survivors: {        Row: {
          id: string;
          name: string;
          image_url: string;
          order_num: number | null;
          background_image_url: string | null;
          created_at: string;
          updated_at: string;
          artist_urls: string[] | null;
          legacy_header_urls: string[] | null;
        };        Insert: {
          id: string;
          name: string;
          image_url: string;
          order_num?: number | null;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          artist_urls?: string[] | null;
          legacy_header_urls?: string[] | null;
        };        Update: {
          id?: string;
          name?: string;
          image_url?: string;
          order_num?: number | null;
          background_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          artist_urls?: string[] | null;
          legacy_header_urls?: string[] | null;
        };
      };
      p100_players: {
        Row: {
          id: string; // UUID as string
          username: string;
          killer_id: string | null;
          survivor_id: string | null;
          added_at: string; // timestamp as string
          p200: boolean | null; // true if player is P200 (got p100 twice on the same character)
        };
        Insert: {
          id?: string;
          username: string;
          killer_id?: string | null;
          survivor_id?: string | null;
          added_at?: string;
          p200: boolean | null; // true if player is P200 (got p100 twice on the same character)
        };
        Update: {
          id?: string;
          username?: string;
          killer_id?: string | null;
          survivor_id?: string | null;
          added_at?: string;
          p200: boolean | null; // true if player is P200 (got p100 twice on the same character)
        };      };      p100_submissions: {
        Row: {
          id: string;
          username: string;
          killer_id: string | null;
          survivor_id: string | null;
          screenshot_url: string;
          status: 'pending' | 'approved' | 'rejected';
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          killer_id?: string | null;
          survivor_id?: string | null;
          screenshot_url: string;
          status?: 'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          killer_id?: string | null;
          survivor_id?: string | null;
          screenshot_url?: string;
          status?: 'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      artists: {
        Row: {
          id: string;
          name: string;
          url: string;
          platform: 'twitter' | 'instagram' | 'youtube';
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          url: string;
          platform: 'twitter' | 'instagram' | 'youtube';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          url?: string;
          platform?: 'twitter' | 'instagram' | 'youtube';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Create a single supabase client for interacting with your database
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: typeof window !== 'undefined', // Only persist session on client side
    },
  });
};

// For server components - prevents issues with WebSocket dependencies
export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: fetch, // Use native fetch
    },
  });
};

// For admin operations - uses service role key to bypass RLS
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and service role key must be defined in environment variables');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: fetch,
    },
  });
};

// Input validation utilities
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
           /^[a-zA-Z0-9_]+$/.test(id);
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

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>'"&]/g, (char) => {
      const entityMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entityMap[char] || char;
    });
};

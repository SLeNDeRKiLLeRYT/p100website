// lib/artists-service.ts

// Make sure to export SupabaseClient type if you haven't already
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase-client'; // We might still need this for public fetches elsewhere

// --- Interfaces (keep as they are) ---
export interface Artist {
  id: string;
  name: string;
  platform: 'twitter' | 'instagram' | 'youtube';
  url: string;
  created_at: string;
}

export interface ArtistInsert {
  name: string;
  platform: 'twitter' | 'instagram' | 'youtube';
  url: string;
}

// --- REFACTORED FUNCTIONS ---

/**
 * Fetches artists from the database.
 * @param supabase - The Supabase client instance to use (can be public or admin).
 * @param isAdmin - A flag to decide if it should bypass RLS (not needed if passing admin client).
 */
export async function getArtists(supabase: SupabaseClient, isAdmin = false): Promise<Artist[]> {
  // The 'isAdmin' flag is now redundant if you pass the admin client, but we can keep it for clarity.
  // The important part is which `supabase` instance is passed in.
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching artists:', error);
    throw new Error('Could not fetch artists.');
  }
  return data || [];
}

/**
 * Creates a new artist.
 * **Must be called with an admin client.**
 * @param supabase - The Supabase admin client instance.
 * @param artistData - The data for the new artist.
 */
export async function createArtist(supabase: SupabaseClient, artistData: ArtistInsert) {
  const { data, error } = await supabase
    .from('artists')
    .insert(artistData)
    .select()
    .single();

  if (error) {
    console.error('Error creating artist:', error);
    throw error;
  }
  return data;
}

/**
 * Updates an existing artist.
 * **Must be called with an admin client.**
 * @param supabase - The Supabase admin client instance.
 * @param artistId - The ID of the artist to update.
 * @param artistData - The new data for the artist.
 */
export async function updateArtist(supabase: SupabaseClient, artistId: string, artistData: Partial<ArtistInsert>) {
    const { data, error } = await supabase
        .from('artists')
        .update(artistData)
        .eq('id', artistId)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating artist:', error);
        throw error;
    }
    return data;
}


/**
 * Deletes an artist.
 * **Must be called with an admin client.**
 * @param supabase - The Supabase admin client instance.
 * @param artistId - The ID of the artist to delete.
 */
export async function deleteArtist(supabase: SupabaseClient, artistId: string) {
  const { error } = await supabase.from('artists').delete().eq('id', artistId);

  if (error) {
    console.error('Error deleting artist:', error);
    throw error;
  }
}
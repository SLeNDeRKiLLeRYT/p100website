// lib/artists-service.ts

import { SupabaseClient } from '@supabase/supabase-js';
// FIX: Import the default singleton instance.
// We can name it whatever we want here, but `supabase` is standard.
import supabase from './supabase-client';

// --- Interfaces (No changes needed) ---
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

// --- FUNCTIONS (No changes needed in the function bodies themselves) ---

/**
 * Fetches artists from the database.
 * @param supabaseClient - The Supabase client instance to use (can be public or admin).
 */
export async function getArtists(supabaseClient: SupabaseClient): Promise<Artist[]> {
  const { data, error } = await supabaseClient
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
 * @param supabaseClient - The Supabase admin client instance.
 * @param artistData - The data for the new artist.
 */
export async function createArtist(supabaseClient: SupabaseClient, artistData: ArtistInsert) {
  const { data, error } = await supabaseClient
    .from('artists')
    .insert([artistData]) // Ensure it's an array for consistency
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
 * @param supabaseClient - The Supabase admin client instance.
 * @param artistId - The ID of the artist to update.
 * @param artistData - The new data for the artist.
 */
export async function updateArtist(supabaseClient: SupabaseClient, artistId: string, artistData: Partial<ArtistInsert>) {
    const { data, error } = await supabaseClient
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
 * @param supabaseClient - The Supabase admin client instance.
 * @param artistId - The ID of the artist to delete.
 */
export async function deleteArtist(supabaseClient: SupabaseClient, artistId: string) {
  const { error } = await supabaseClient.from('artists').delete().eq('id', artistId);

  if (error) {
    console.error('Error deleting artist:', error);
    throw error;
  }
}
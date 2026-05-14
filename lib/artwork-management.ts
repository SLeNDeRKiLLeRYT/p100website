import { createServerClient } from '@/lib/supabase-client';

export interface ArtworkUsage {
  character_id: string;
  character_type: 'killer' | 'survivor';
  character_name: string;
  usage_type: 'gallery' | 'header' | 'legacy_header' | 'background';
  display_order: number | null;
}

export interface ArtworkWithUsages {
  id: string;
  artwork_url: string;
  artist_name: string | null;
  artist_url: string | null;
  platform: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  usages: ArtworkUsage[];
}

/**
 * Fetch all artworks with their character usages
 */
export async function getAllArtworksWithUsages(): Promise<ArtworkWithUsages[]> {
  const supabase = createServerClient();
  
  // Get all artworks
  const { data: artworks, error: artworksError } = await supabase
    .from('artworks')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (artworksError) {
    console.error('Error fetching artworks:', artworksError);
    throw artworksError;
  }
  
  if (!artworks || artworks.length === 0) return [];
  
  // Get all character artwork relationships with character names
  const { data: relationships, error: relationshipsError } = await supabase
    .from('v_character_artworks')
    .select('*');
  
  if (relationshipsError) {
    console.error('Error fetching relationships:', relationshipsError);
    throw relationshipsError;
  }
  
  // Map artworks with their usages
  return artworks.map(artwork => ({
    ...artwork,
    usages: (relationships || [])
      .filter(rel => rel.artwork_id === artwork.id)
      .map(rel => ({
        character_id: rel.character_id,
        character_type: rel.character_type as 'killer' | 'survivor',
        character_name: rel.character_name || 'Unknown',
        usage_type: rel.usage_type as any,
        display_order: rel.display_order
      }))
  }));
}

/**
 * Update artist information for an artwork
 */
export async function updateArtworkArtist(
  artworkId: string,
  artistName: string | null,
  artistUrl: string | null,
  platform: string | null
) {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from('artworks')
    .update({
      artist_name: artistName,
      artist_url: artistUrl,
      platform: platform,
      updated_at: new Date().toISOString()
    })
    .eq('id', artworkId);
  
  if (error) {
    console.error('Error updating artwork:', error);
    throw error;
  }
}

/**
 * Delete an artwork (cascade deletes character_artworks relationships)
 */
export async function deleteArtwork(artworkId: string) {
  const supabase = createServerClient();
  
  // Foreign key constraint will cascade delete character_artworks relationships
  const { error } = await supabase
    .from('artworks')
    .delete()
    .eq('id', artworkId);
  
  if (error) {
    console.error('Error deleting artwork:', error);
    throw error;
  }
}

/**
 * Get character artworks by character ID and type
 */
export async function getCharacterArtworks(
  characterId: string,
  characterType: 'killer' | 'survivor'
) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('v_character_artworks')
    .select('*')
    .eq('character_id', characterId)
    .eq('character_type', characterType)
    .order('usage_type')
    .order('display_order');
  
  if (error) {
    console.error('Error fetching character artworks:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Add an artwork to a character
 */
export async function addArtworkToCharacter(
  characterId: string,
  characterType: 'killer' | 'survivor',
  artworkUrl: string,
  usageType: 'gallery' | 'header' | 'legacy_header' | 'background',
  displayOrder?: number,
  supabaseClient?: any
) {
  const supabase = supabaseClient || createServerClient();

  // First, ensure the artwork exists
  let { data: artwork } = await supabase
    .from('artworks')
    .select('id')
    .eq('artwork_url', artworkUrl)
    .single();

  if (!artwork) {
    // Create the artwork if it doesn't exist
    const { data: newArtwork, error: createError } = await supabase
      .from('artworks')
      .insert({ artwork_url: artworkUrl })
      .select('id')
      .single();

    if (createError) throw createError;
    artwork = newArtwork;
  }

  // For background/header types, remove existing entry first to prevent duplicates
  if (usageType === 'background' || usageType === 'header') {
    await supabase
      .from('character_artworks')
      .delete()
      .eq('character_id', characterId)
      .eq('character_type', characterType)
      .eq('usage_type', usageType);
  }

  // Create the character-artwork relationship
  const { error } = await supabase
    .from('character_artworks')
    .insert({
      character_id: characterId,
      character_type: characterType,
      artwork_id: artwork.id,
      usage_type: usageType,
      display_order: displayOrder
    });

  if (error) throw error;
}

/**
 * Get all characters (killers and survivors) for selection
 */
export async function getAllCharacters() {
  const supabase = createServerClient();
  
  const [{ data: killers }, { data: survivors }] = await Promise.all([
    supabase.from('killers').select('id, name').order('order'),
    supabase.from('survivors').select('id, name').order('order_num')
  ]);
  
  return {
    killers: killers || [],
    survivors: survivors || []
  };
}

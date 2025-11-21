// lib/artworks-service.ts
// Service helpers for new artist_artworks mapping.

import supabase, { createAdminClient } from './supabase-client';

export interface ArtworkUsage {
  usage_id: string;
  character_type: 'killer' | 'survivor';
  character_id: string;
  field_name: string;
}

export interface ArtworkRecord {
  id: string;
  artwork_url: string;
  artist_id: string | null;
  source_type: string | null;
  source_character_id: string | null;
  usages: ArtworkUsage[];
  created_at: string;
  updated_at: string;
}

export async function fetchArtworks(offset = 0, limit = 100): Promise<ArtworkRecord[]> {
  const { data, error } = await supabase
    .from('v_all_artworks')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function updateArtworkArtist(artworkId: string, artistId: string | null) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('artist_artworks')
    .update({ artist_id: artistId })
    .eq('id', artworkId);
  if (error) throw error;
}

export async function deleteArtwork(artworkId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('artist_artworks')
    .delete()
    .eq('id', artworkId);
  if (error) throw error;
}

// Promote a raw URL to an artwork and attach usage (idempotent)
export async function upsertArtworkAndUsage(params: {
  url: string;
  characterType: 'killer' | 'survivor';
  characterId: string;
  fieldName: string; // e.g. 'artist_urls' | 'legacy_header_urls' | 'header_url' | 'background_image_url' | 'image_url'
  artistId?: string | null; // optional: set artist at creation time
}): Promise<string> {
  const { url, characterType, characterId, fieldName, artistId } = params;
  const admin = createAdminClient();

  // 1. Find or create artwork
  const { data: existing, error: selErr } = await admin
    .from('artist_artworks')
    .select('id')
    .eq('artwork_url', url)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;

  let artworkId = existing?.id as string | undefined;
  if (!artworkId) {
    const { data: inserted, error: insErr } = await admin
      .from('artist_artworks')
      .insert({ artwork_url: url, artist_id: artistId ?? null })
      .select('id')
      .single();
    if (insErr) throw insErr;
    artworkId = inserted.id;
  }

  // 2. Ensure usage exists
  const { data: usageExists, error: usageSelErr } = await admin
    .from('artist_artwork_usages')
    .select('id')
    .eq('artwork_id', artworkId)
    .eq('character_type', characterType)
    .eq('character_id', characterId)
    .eq('field_name', fieldName)
    .limit(1)
    .maybeSingle();
  if (usageSelErr) throw usageSelErr;

  if (!usageExists) {
    const { error: usageInsErr } = await admin
      .from('artist_artwork_usages')
      .insert({ artwork_id: artworkId, character_type: characterType, character_id: characterId, field_name: fieldName });
    if (usageInsErr) throw usageInsErr;
  }
  return artworkId!;
}

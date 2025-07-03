// lib/artist-analytics.ts

import { createServerClient, Database } from './supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';

// --- Type Definitions (Local to this file) ---

/**
 * Represents an artist from the database.
 * This structure matches your 'artists' table schema.
 */
interface Artist {
  id: string;
  name: string;
  url: string;
  platform: string;
  slug: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Represents the detailed analysis of a single piece of artwork.
 */
interface ArtworkDetail {
  artworkUrl: string;
  artist: Artist | null; // Store the full artist object if found
  matchFound: boolean;
}

/**
 * Represents the final analytics report for a character's artworks.
 */
interface ArtworkAnalytics {
  characterId: string;
  characterName: string;
  characterType: 'killer' | 'survivor';
  totalArtworks: number;
  matchedArtistCount: number;
  unmatchedArtistCount: number;
  platformDistribution: { [key: string]: number };
  artworkDetails: ArtworkDetail[];
}

// --- Local Helper Functions ---

/**
 * Normalizes a name for case-insensitive and flexible matching.
 * Removes spaces, hyphens, and underscores, and converts to lowercase.
 * e.g., "Polina Butterfly", "polina-butterfly", "Polina_Butterfly" all become "polinabutterfly".
 * @param name - The string to normalize.
 * @returns The normalized string.
 */
const normalizeName = (name: string): string => name.toLowerCase().replace(/[\s_-]/g, '');

/**
 * Extracts the artist's name or slug from an artwork URL's filename.
 * It looks for a pattern like "art by [artist_name]".
 * @param url - The full URL to the artwork image.
 * @returns The extracted artist identifier string, or null if not found.
 */
function extractArtistIdentifierFromUrl(url: string): string | null {
  try {
    const decodedUrl = decodeURIComponent(url);
    const filename = decodedUrl.substring(decodedUrl.lastIndexOf('/') + 1);
    
    // Remove the file extension to simplify matching
    const namePart = filename.substring(0, filename.lastIndexOf('.'));

    let artistIdentifier: string | null = null;

    // Check for different "by" separators, from most specific to least (case-insensitive)
    const lowerNamePart = namePart.toLowerCase();
    if (lowerNamePart.includes('-by-')) {
      // Handles "art-by-artist"
      artistIdentifier = namePart.split(/-by-/i).pop() || null;
    } else if (lowerNamePart.includes(' by ')) {
      // Handles "art by artist" or "ss by artist"
      artistIdentifier = namePart.split(/ by /i).pop() || null;
    }
    // You can add more 'else if' conditions here for other patterns in the future

    // Return the trimmed result if found, otherwise null
    return artistIdentifier ? artistIdentifier.trim() : null;

  } catch (e) {
    console.error("Error parsing artwork URL:", url, e);
    return null;
  }
}

/**
 * Fetches all artists from the database.
 * @param supabase - The Supabase client instance.
 * @returns A promise that resolves to an array of Artist objects.
 */
async function getAllArtists(supabase: SupabaseClient<Database>): Promise<Artist[]> {
  const { data, error } = await supabase.from('artists').select('*');
  if (error) {
    console.error("Error fetching all artists:", error.message);
    return [];
  }
  // ADD THIS LINE
  console.log(`[Artist Analytics] Fetched ${data?.length || 0} artists from the database.`);
  return data || [];
}

// --- Main Exported Functions ---

/**
 * Analyzes the artwork URLs for a character to provide statistics.
 *
 * @param characterId - The ID of the character.
 * @param characterName - The name of the character.
 * @param characterType - The type of character ('killer' or 'survivor').
 * @param artworkUrls - An array of artwork URLs from the `artist_urls` column.
 * @param legacyHeaderUrls - An array of URLs from the `legacy_header_urls` column.
 * @returns A promise that resolves to an ArtworkAnalytics object.
 */
export async function analyzeCharacterArtworks(
  characterId: string,
  characterName: string,
  characterType: 'killer' | 'survivor',
  artworkUrls: string[],
  legacyHeaderUrls?: (string | null)[] | null // Optional parameter for legacy URLs
): Promise<ArtworkAnalytics> {
  const supabase = createServerClient();
  
  // 1. Fetch all artists and create an efficient lookup map.
  const allArtistsData = await getAllArtists(supabase);
  const artistMap = new Map<string, Artist>();
  for (const artist of allArtistsData) {
    // Use normalized names and slugs as keys for robust matching
    artistMap.set(normalizeName(artist.name), artist);
    if (artist.slug) {
      artistMap.set(normalizeName(artist.slug), artist);
    }
  }

  const artworkDetails: ArtworkDetail[] = [];
  let matchedArtistCount = 0;
  let unmatchedArtistCount = 0;
  const platformCounts: { [key: string]: number } = {};

  // 2. Combine all artwork URLs and filter out non-artwork (like perks images).
  const allArtworkUrls = [
    ...(artworkUrls || []),
    ...(legacyHeaderUrls || []),
  ].filter((url): url is string => !!url && !url.toUpperCase().includes('PERKS.PNG'));

  // 3. Process each artwork URL.
  for (const url of allArtworkUrls) {
    const identifier = extractArtistIdentifierFromUrl(url);
    let foundArtist: Artist | null = null;

    if (identifier) {
      const normalizedIdentifier = normalizeName(identifier);
      foundArtist = artistMap.get(normalizedIdentifier) || null;
    }

    if (foundArtist) {
      artworkDetails.push({ artworkUrl: url, artist: foundArtist, matchFound: true });
      matchedArtistCount++;
      platformCounts[foundArtist.platform] = (platformCounts[foundArtist.platform] || 0) + 1;
    } else {
      artworkDetails.push({ artworkUrl: url, artist: null, matchFound: false });
      unmatchedArtistCount++;
    }
  }

  return {
    characterId,
    characterName,
    characterType,
    totalArtworks: allArtworkUrls.length,
    matchedArtistCount,
    unmatchedArtistCount,
    platformDistribution: platformCounts,
    artworkDetails,
  };
}

/**
 * Logs a detailed analysis of the artwork analytics to the console.
 * This is useful for server-side debugging and monitoring.
 * @param analytics - The ArtworkAnalytics object to log.
 */
export function logDetailedArtworkAnalysis(analytics: ArtworkAnalytics) {
  console.log('--- Artwork Analysis Report ---');
  console.log(`Character: ${analytics.characterName} (${analytics.characterType})`);
  console.log(`Character ID: ${analytics.characterId}`);
  console.log(`Total Artworks Found: ${analytics.totalArtworks}`);
  console.log(`  - Matched Artists in DB: ${analytics.matchedArtistCount}`);
  console.log(`  - Unmatched/Unknown Artists: ${analytics.unmatchedArtistCount}`);

  if (analytics.totalArtworks > 0) {
    const matchPercentage = ((analytics.matchedArtistCount / analytics.totalArtworks) * 100).toFixed(2);
    console.log(`Artist Match Rate: ${matchPercentage}%`);
  }

  if (Object.keys(analytics.platformDistribution).length > 0) {
    console.log('Platform Distribution of Matched Artists:');
    for (const [platform, count] of Object.entries(analytics.platformDistribution)) {
      console.log(`  - ${platform}: ${count}`);
    }
  }
  
  const unmatched = analytics.artworkDetails.filter(d => !d.matchFound);
  if (unmatched.length > 0) {
      console.log('Unmatched Artwork URLs:');
      unmatched.forEach(detail => console.log(`  - ${detail.artworkUrl}`));
  }

  console.log('--- End of Report ---');
}
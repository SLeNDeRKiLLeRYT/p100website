// lib/players-service.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface P100Player {
  id: string;
  username: string;
  killer_id: string | null;
  survivor_id: string | null;
  added_at: string;
  p200: boolean | null;
  legacy: boolean | null;
  favorite: boolean | null;
  priority?: number | null;
}

/**
 * Fetch players with priority ordering (higher first) then fallback ordering
 */
export async function getP100Players(client: SupabaseClient): Promise<P100Player[]> {
  const { data, error } = await client
    .from('p100_players')
    .select('*')
    .order('priority', { ascending: false })
    .order('added_at', { ascending: false });
  if (error) {
    console.error('Error fetching p100 players:', error);
    throw new Error('Could not fetch players');
  }
  return data || [];
}

/**
 * Update only the priority for a player.
 * @param client Supabase admin client
 * @param playerId Player row id (UUID)
 * @param priority Integer >= 0 preferred
 */
export async function updatePlayerPriority(client: SupabaseClient, playerId: string, priority: number) {
  if (!Number.isFinite(priority)) throw new Error('Priority must be a number');
  const clamped = Math.max(0, Math.floor(priority));
  const { data, error } = await client
    .from('p100_players')
    .update({ priority: clamped })
    .eq('id', playerId)
    .select('id, priority')
    .single();
  if (error) {
    console.error('Error updating player priority:', error);
    throw new Error('Could not update player priority');
  }
  return data;
}

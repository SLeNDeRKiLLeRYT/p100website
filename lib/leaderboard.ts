// lib/leaderboard.ts
// Data layer for the Hall of Fame leaderboard (invoice item 10).
import { createServerClient } from './supabase-client';

/** Username that gets its own showcase and is therefore kept off the ranking. */
export const CREATOR_USERNAME = 'SLeNDeR_KiLLeR';

/** How many players the leaderboard shows. */
export const LEADERBOARD_LIMIT = 100;

/** Portraits rendered per player before collapsing into a "+N" chip. */
export const PORTRAITS_PER_PLAYER = 12;

export interface LeaderboardPortrait {
  id: string;
  name: string;
  imageUrl: string;
  type: 'killer' | 'survivor';
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  p100Count: number;
  portraits: LeaderboardPortrait[];
  hiddenPortraits: number;
}

/**
 * Top players by P100 count.
 *
 * Ranking comes from v_p100_leaderboard, which uses rank() — ties share a
 * number and the next rank skips (20,20 -> both 14th, next is 16th). Ties are
 * ordered alphabetically here rather than in the view so the view stays a
 * plain aggregate.
 */
export async function getLeaderboard(limit = LEADERBOARD_LIMIT): Promise<LeaderboardEntry[]> {
  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from('v_p100_leaderboard')
    .select('username, p100_count, rank')
    .order('rank', { ascending: true })
    .limit(limit + 5); // headroom so removing the creator cannot short the list

  if (error) {
    console.error('Leaderboard query failed:', error.message);
    return [];
  }

  const ranked = (rows || [])
    .filter((r: any) => r.username?.toLowerCase() !== CREATOR_USERNAME.toLowerCase())
    .sort((a: any, b: any) =>
      a.rank !== b.rank
        ? a.rank - b.rank
        : String(a.username).toLowerCase().localeCompare(String(b.username).toLowerCase())
    )
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const usernames = ranked.map((r: any) => r.username);

  // One round-trip for every P100 belonging to the listed players, then one
  // each for the character art. Three queries total, regardless of list size.
  const { data: players } = await supabase
    .from('p100_players')
    .select('username, killer_id, survivor_id')
    .in('username', usernames);

  const killerIds = Array.from(new Set((players || []).map((p: any) => p.killer_id).filter(Boolean)));
  const survivorIds = Array.from(new Set((players || []).map((p: any) => p.survivor_id).filter(Boolean)));

  const [killersRes, survivorsRes] = await Promise.all([
    killerIds.length
      ? supabase.from('killers').select('id, name, image_url').in('id', killerIds)
      : Promise.resolve({ data: [] as any[] }),
    survivorIds.length
      ? supabase.from('survivors').select('id, name, image_url').in('id', survivorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const killerMap = new Map((killersRes.data || []).map((k: any) => [k.id, k]));
  const survivorMap = new Map((survivorsRes.data || []).map((s: any) => [s.id, s]));

  const byUser = new Map<string, LeaderboardPortrait[]>();
  for (const p of players || []) {
    const src = p.killer_id ? killerMap.get(p.killer_id) : survivorMap.get(p.survivor_id);
    if (!src) continue;
    const list = byUser.get(p.username) || [];
    list.push({
      id: src.id,
      name: src.name,
      imageUrl: src.image_url,
      type: p.killer_id ? 'killer' : 'survivor',
    });
    byUser.set(p.username, list);
  }

  return ranked.map((r: any) => {
    const all = (byUser.get(r.username) || []).sort((a, b) => a.name.localeCompare(b.name));
    return {
      rank: r.rank,
      username: r.username,
      p100Count: r.p100_count,
      portraits: all.slice(0, PORTRAITS_PER_PLAYER),
      hiddenPortraits: Math.max(0, all.length - PORTRAITS_PER_PLAYER),
    };
  });
}

/** Every P100 belonging to the site creator, for her showcase (item 9). */
export async function getCreatorShowcase(): Promise<LeaderboardPortrait[]> {
  const supabase = createServerClient();

  const { data: players, error } = await supabase
    .from('p100_players')
    .select('killer_id, survivor_id')
    .eq('username', CREATOR_USERNAME);

  if (error) {
    console.error('Creator showcase query failed:', error.message);
    return [];
  }

  const killerIds = Array.from(new Set((players || []).map((p: any) => p.killer_id).filter(Boolean)));
  const survivorIds = Array.from(new Set((players || []).map((p: any) => p.survivor_id).filter(Boolean)));

  const [killersRes, survivorsRes] = await Promise.all([
    killerIds.length
      ? supabase.from('killers').select('id, name, image_url').in('id', killerIds)
      : Promise.resolve({ data: [] as any[] }),
    survivorIds.length
      ? supabase.from('survivors').select('id, name, image_url').in('id', survivorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const out: LeaderboardPortrait[] = [
    ...(killersRes.data || []).map((k: any) => ({
      id: k.id, name: k.name, imageUrl: k.image_url, type: 'killer' as const,
    })),
    ...(survivorsRes.data || []).map((s: any) => ({
      id: s.id, name: s.name, imageUrl: s.image_url, type: 'survivor' as const,
    })),
  ];

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

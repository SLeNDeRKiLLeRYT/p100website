// lib/vip.ts
// VIP tier lookups (invoice item 13).
//
// VIP status belongs to a username, so one entry applies to every character
// that player owns. The table is small (tens of rows), so the whole thing is
// fetched once per render and turned into a map rather than joined per row.
import { createServerClient } from './supabase-client';

export type VipTier = 1 | 2 | 3;

export interface VipUser {
  id: string;
  username: string;
  tier: VipTier;
  reason: string | null;
  created_at: string;
}

/** Lowercased username -> tier. Lookups must lowercase the key. */
export type VipMap = Map<string, VipTier>;

export const VIP_TIER_LABELS: Record<VipTier, string> = {
  1: 'VIP',
  2: 'VIP II',
  3: 'VIP III',
};

/**
 * Every VIP, keyed by lowercased username.
 * Returns an empty map on failure so a VIP outage can never break a page.
 */
export async function getVipMap(): Promise<VipMap> {
  const map: VipMap = new Map();
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('vip_users').select('username, tier');
    if (error) {
      console.error('VIP lookup failed:', error.message);
      return map;
    }
    for (const row of data || []) {
      const tier = Number((row as any).tier);
      if (tier >= 1 && tier <= 3) {
        map.set(String((row as any).username).toLowerCase(), tier as VipTier);
      }
    }
  } catch (e) {
    console.error('VIP lookup threw:', e);
  }
  return map;
}

/** Convenience for a single name. */
export function vipTierFor(map: VipMap, username: string | null | undefined): VipTier | null {
  if (!username) return null;
  return map.get(username.toLowerCase()) ?? null;
}

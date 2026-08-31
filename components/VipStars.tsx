import type { VipTier } from '@/lib/vip';

const TIER_TITLES: Record<VipTier, string> = {
  1: 'VIP player',
  2: 'VIP II player',
  3: 'VIP III player',
};

/** Corner stars for tiers 2 and 3. Tier 3 spins. Renders nothing for tier 1. */
export function VipCorners({ tier }: { tier: VipTier | null }) {
  if (tier !== 2 && tier !== 3) return null;
  return (
    <div
      className={`vip-star-corners ${tier === 3 ? 'vip-spin' : ''}`}
      title={TIER_TITLES[tier]}
      aria-hidden="true"
    >
      <span className="vip-star">★</span>
      <span className="vip-star">★</span>
      <span className="vip-star">★</span>
      <span className="vip-star">★</span>
    </div>
  );
}

/** The single star that sits under the name for tier 1. */
export function VipInlineStar({ tier }: { tier: VipTier | null }) {
  if (tier !== 1) return null;
  return (
    <span className="vip-star-inline" title={TIER_TITLES[1]} role="img" aria-label="VIP player">
      ★
    </span>
  );
}

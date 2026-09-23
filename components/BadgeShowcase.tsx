'use client';

// FAQ badge showcase (invoice item 18).
//
// Renders the exact same player tile the character pages render, for one
// example username, and lets the reader step through every badge so they can
// see what each one actually looks like in place.

import { useState } from 'react';
import Image from 'next/image';
import { VipCorners, VipInlineStar } from '@/components/VipStars';
import type { VipTier } from '@/lib/vip';

const EXAMPLE_USERNAME = 'princegridd';

interface BadgeDemo {
  key: string;
  label: string;
  p200: boolean;
  legacy: boolean;
  favorite: boolean;
  vipTier: VipTier | null;
}

const BADGES: BadgeDemo[] = [
  {
    key: 'legacy',
    label: 'Legacy',
    p200: false,
    legacy: true,
    favorite: false,
    vipTier: null,
  },
  {
    key: 'p200',
    label: 'P200',
    p200: true,
    legacy: false,
    favorite: false,
    vipTier: null,
  },
  {
    key: 'heart',
    label: 'Heart',
    p200: false,
    legacy: false,
    favorite: true,
    vipTier: null,
  },
  {
    key: 'vip1',
    label: 'Star',
    p200: false,
    legacy: false,
    favorite: false,
    vipTier: 1,
  },
  {
    key: 'vip2',
    label: 'Gold stars',
    p200: false,
    legacy: false,
    favorite: false,
    vipTier: 2,
  },
  {
    key: 'vip3',
    label: 'Spinning stars',
    p200: false,
    legacy: false,
    favorite: false,
    vipTier: 3,
  },
];

/** One player tile, styled exactly as it is on a killer or survivor page. */
function DemoTile({ demo }: { demo: BadgeDemo }) {
  const baseNameClasses = 'font-mono text-sm text-gray-200';

  let nameClasses = baseNameClasses;
  let borderClasses =
    'relative block bg-black/40 border border-red-600/20 rounded-md p-3';

  if (demo.vipTier === 3) {
    nameClasses = `${baseNameClasses} vip3-name`;
    borderClasses = 'relative block bg-black/40 vip3-aura rounded-md p-3';
  } else if (demo.vipTier === 2) {
    nameClasses = `${baseNameClasses} vip2-name`;
    borderClasses = 'relative block bg-black/40 vip2-frame rounded-md p-3';
  } else if (demo.favorite) {
    nameClasses = `${baseNameClasses} favorite-glow animate-pulse`;
    borderClasses =
      'relative block bg-black/40 favorite-heart-border rounded-md p-3';
  } else if (demo.legacy) {
    nameClasses = `${baseNameClasses} text-orange-200 drop-shadow-[0_0_4px_rgba(251,146,60,0.8)] animate-pulse`;
  }

  return (
    <div className={borderClasses}>
      <VipCorners tier={demo.vipTier} />
      {demo.favorite && (
        <div className="favorite-heart-corners">
          <span className="heart">&hearts;</span>
          <span className="heart">&hearts;</span>
          <span className="heart">&hearts;</span>
          <span className="heart">&hearts;</span>
        </div>
      )}
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[36px] space-y-2">
        <span className={`${nameClasses} block truncate max-w-full leading-tight`}>
          {EXAMPLE_USERNAME}
        </span>
        {(demo.p200 || demo.legacy || demo.favorite || demo.vipTier === 1) && (
          <div className="flex items-center gap-1">
            <VipInlineStar tier={demo.vipTier} />
            {demo.p200 && (
              <div className="w-5 h-5">
                <Image
                  src="/p200.png"
                  alt="P200 badge"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            {demo.legacy && (
              <div className="w-5 h-5">
                <Image
                  src="/legacy.png"
                  alt="Legacy badge"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            {demo.favorite && (
              <div className="w-5 h-5 text-pink-400">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BadgeShowcase() {
  const [index, setIndex] = useState(0);
  const demo = BADGES[index];

  const step = (by: number) =>
    setIndex((i) => (i + by + BADGES.length) % BADGES.length);

  return (
    <div className="border border-red-600/20 rounded-lg bg-black/30 p-5 md:p-6">
      <p className="font-mono text-xs text-gray-500 text-center mb-5">
        Example player, use the arrows to see each badge
      </p>

      <div className="flex items-center justify-center gap-4 md:gap-6">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous badge"
          className="font-mono text-2xl text-gray-400 hover:text-white px-3 py-2 border border-red-600/20 rounded-md hover:border-red-500/50 transition-colors"
        >
          &lsaquo;
        </button>

        <div className="w-[190px] py-4 flex items-center justify-center">
          <div className="w-[160px]">
            <DemoTile demo={demo} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next badge"
          className="font-mono text-2xl text-gray-400 hover:text-white px-3 py-2 border border-red-600/20 rounded-md hover:border-red-500/50 transition-colors"
        >
          &rsaquo;
        </button>
      </div>

      <div className="mt-5 text-center">
        <p className="font-mono text-base text-gray-200">{demo.label}</p>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {BADGES.map((b, i) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`font-mono text-xs px-3 py-1 rounded-md border transition-colors ${
              i === index
                ? 'border-red-500/60 text-white bg-red-900/30'
                : 'border-red-600/20 text-gray-400 hover:text-white hover:border-red-500/40'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

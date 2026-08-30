import Image from 'next/image';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/leaderboard';

/**
 * Rank medals. SLeNDeR_KiLLeR is still finishing these ("I just need to combine
 * the blood for the injured and downed"), so they render as numbers until the
 * files exist. Drop the PNGs into /public/ranks/ and uncomment — no other change.
 *
 * NOTE: these are keyed by RANK NUMBER, and ranks skip on ties. In the current
 * data there is no rank 3 at all (1, 2, 2, 4, ...), so the 3rd-place medal will
 * simply not appear until the standings change.
 */
const RANK_ICONS: Record<number, string | undefined> = {
  1: undefined, // '/ranks/escaped.png'
  2: undefined, // '/ranks/downed.png'
  3: undefined, // '/ranks/hooked.png'
  4: undefined, // '/ranks/sacrificed.png'
};

function RankBadge({ rank }: { rank: number }) {
  const icon = RANK_ICONS[rank];

  if (icon) {
    return (
      <div className="relative w-12 h-12 md:w-14 md:h-14 flex-shrink-0">
        <Image src={icon} alt={`Rank ${rank}`} fill className="object-contain" />
      </div>
    );
  }

  const top4 = rank <= 4;
  return (
    <div
      className={`w-12 h-12 md:w-14 md:h-14 flex-shrink-0 flex items-center justify-center rounded font-mono
        ${top4
          ? 'bg-red-900/50 border-2 border-red-500 text-red-200 text-xl md:text-2xl'
          : 'bg-black/60 border border-red-600/40 text-gray-300 text-lg'}`}
    >
      {rank}
    </div>
  );
}

export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-black/40 border border-red-600/30 rounded-lg p-8 text-center text-gray-400">
        No players to rank yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li
          key={e.username}
          className={`bg-black/50 border rounded-lg p-3 md:p-4 backdrop-blur-sm
            ${e.rank <= 4 ? 'border-red-600/60' : 'border-red-600/25'}`}
        >
          <div className="flex items-center gap-3 md:gap-4">
            <RankBadge rank={e.rank} />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link
                  href={`/profile/${encodeURIComponent(e.username)}`}
                  className="text-lg md:text-xl font-mono text-white hover:text-red-300 transition-colors truncate"
                >
                  {e.username}
                </Link>
                <span className="text-red-400 font-mono text-sm md:text-base whitespace-nowrap">
                  {e.p100Count} P100{e.p100Count === 1 ? '' : 's'}
                </span>
              </div>

              {/* Portraits — placeholder layout, sits beside the name on wide
                  screens and wraps beneath on mobile. Swap for her drawing. */}
              {e.portraits.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 md:gap-1.5 mt-2">
                  {e.portraits.map((p) => (
                    <Link
                      key={`${p.type}-${p.id}`}
                      href={`/${p.type === 'killer' ? 'killers' : 'survivors'}/${p.id}`}
                      title={p.name}
                    >
                      <div className="relative w-8 h-10 md:w-9 md:h-12 rounded-sm overflow-hidden border border-red-600/30 hover:border-red-400 transition-colors">
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="36px"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                  ))}
                  {e.hiddenPortraits > 0 && (
                    <span className="text-xs font-mono text-gray-400 ml-1">
                      +{e.hiddenPortraits}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

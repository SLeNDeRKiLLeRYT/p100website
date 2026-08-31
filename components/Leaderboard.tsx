import Image from 'next/image';
import Link from 'next/link';
import type { LeaderboardPage } from '@/lib/leaderboard';

/**
 * Rank medals, keyed by ROW POSITION (1st..4th row of the whole list) rather
 * than by shared rank — SLeNDeR_KiLLeR chose "top 4 rows always get the 4
 * medals", so tied players can carry different medals.
 *
 * Files live in /public/ranks/. Names are lowercase because Cloudflare serves
 * assets case-sensitively.
 */
const RANK_ICONS: Record<number, string> = {
  1: '/ranks/first.png',
  2: '/ranks/second.png',
  3: '/ranks/third.png',
  4: '/ranks/fourth.png',
};

function RankBadge({ position, rank }: { position: number; rank: number }) {
  const icon = RANK_ICONS[position];

  if (icon) {
    return (
      <div className="flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
        <div className="relative w-12 h-12 md:w-14 md:h-14">
          <Image src={icon} alt={`Place ${rank}`} fill className="object-contain" priority />
        </div>
        <span className="text-[10px] font-mono text-gray-400 leading-none">{rank}</span>
      </div>
    );
  }

  return (
    <div className="w-14 flex-shrink-0 flex items-center justify-center">
      <div className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded bg-black/60 border border-red-600/40 text-gray-300 font-mono text-lg">
        {rank}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-3 mt-8">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
        const from = (n - 1) * 50 + 1;
        const to = n * 50;
        const active = n === page;
        return (
          <Link
            key={n}
            href={n === 1 ? '/hall-of-fame' : `/hall-of-fame?page=${n}`}
            scroll
            className={`px-6 py-2 rounded-lg font-mono text-sm md:text-base border transition-colors
              ${active
                ? 'bg-red-600 border-red-400 text-white'
                : 'bg-black/60 border-red-600/50 text-gray-300 hover:bg-red-900/40 hover:border-red-400'}`}
          >
            {from}-{to}
          </Link>
        );
      })}
    </div>
  );
}

export default function Leaderboard({ data }: { data: LeaderboardPage }) {
  const { entries, page, totalPages } = data;

  if (entries.length === 0) {
    return (
      <div className="bg-black/40 border border-red-600/30 rounded-lg p-8 text-center text-gray-400">
        No players to rank yet.
      </div>
    );
  }

  return (
    <>
      {/* Width is sized to a row of 10 portraits plus the "+N" counter, and
          centred — the biggest row we ever render sets the column width. */}
      <ol className="space-y-3 mx-auto w-full max-w-[640px]">
        {entries.map((e) => (
          <li
            key={e.username}
            className={`bg-black/50 border rounded-lg px-3 py-3 backdrop-blur-sm
              ${e.position <= 4 ? 'border-red-600/60' : 'border-red-600/25'}`}
          >
            <div className="flex items-center gap-3">
              <RankBadge position={e.position} rank={e.rank} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link
                    href={`/profile/${encodeURIComponent(e.username)}`}
                    className="text-base md:text-lg font-mono text-white hover:text-red-300 transition-colors truncate"
                  >
                    {e.username}
                  </Link>
                  <span className="text-red-400 font-mono text-xs md:text-sm whitespace-nowrap">
                    {e.p100Count} P100{e.p100Count === 1 ? '' : 's'}
                  </span>
                </div>

                {e.portraits.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 md:gap-1.5 mt-1.5">
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
                      <span className="text-xs font-mono text-gray-400 ml-1 whitespace-nowrap">
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

      <Pagination page={page} totalPages={totalPages} />
    </>
  );
}

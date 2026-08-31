import Image from 'next/image';
import Link from 'next/link';
import type { LeaderboardPortrait } from '@/lib/leaderboard';

export default function CreatorShowcase({
  username,
  portraits,
}: {
  username: string;
  portraits: LeaderboardPortrait[];
}) {
  return (
    <section className="mb-14 md:mb-20">
      {/* Sized to its contents and centred, rather than stretching the page. */}
      <div className="legacy-gold-box rounded-lg px-6 py-6 md:px-10 md:py-8 backdrop-blur-sm mx-auto w-fit max-w-full">
        <h2 className="legacy-gold-text text-2xl md:text-3xl font-mono text-center mb-1">
          {username}
        </h2>
        <p className="text-center text-[rgba(212,175,55,0.75)] text-xs md:text-sm font-mono mb-6">
          creator of the website — {portraits.length} P100{portraits.length === 1 ? '' : 's'}
        </p>

        {portraits.length === 0 ? (
          <p className="text-center text-gray-400 text-sm">No P100s recorded yet.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {portraits.map((p) => (
              <Link
                key={`${p.type}-${p.id}`}
                href={`/${p.type === 'killer' ? 'killers' : 'survivors'}/${p.id}`}
                title={p.name}
              >
                <div className="legacy-gold-portrait relative w-20 h-[107px] md:w-24 md:h-32 rounded overflow-hidden">
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 80px, 96px"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

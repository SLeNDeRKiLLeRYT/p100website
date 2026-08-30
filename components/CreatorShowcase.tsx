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
      <div className="bg-black/50 border-2 border-red-600/60 rounded-lg p-6 md:p-8 backdrop-blur-sm">
        <h2 className="text-2xl md:text-3xl font-mono text-center mb-1">
          {username}
        </h2>
        <p className="text-center text-red-400 text-sm font-mono mb-6">
          creator of the website — {portraits.length} P100{portraits.length === 1 ? '' : 's'}
        </p>

        {portraits.length === 0 ? (
          <p className="text-center text-gray-400 text-sm">No P100s recorded yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-3">
            {portraits.map((p) => (
              <Link
                key={`${p.type}-${p.id}`}
                href={`/${p.type === 'killer' ? 'killers' : 'survivors'}/${p.id}`}
                title={p.name}
                className="group"
              >
                <div className="relative aspect-[3/4] rounded overflow-hidden border border-red-600/40 group-hover:border-red-400 transition-colors">
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 30vw, (max-width: 1024px) 12vw, 9vw"
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

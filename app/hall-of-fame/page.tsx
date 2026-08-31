import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import CreatorShowcase from '@/components/CreatorShowcase';
import Leaderboard from '@/components/Leaderboard';
import {
  getLeaderboard,
  getCreatorShowcase,
  CREATOR_USERNAME,
  LEADERBOARD_LIMIT,
  PER_PAGE,
} from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Hall of Fame | The Ultimate P100 List Library',
  description: 'The players with the most P100s in Dead by Daylight.',
};

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const requestedPage = Number(searchParams?.page) || 1;

  const [board, creatorPortraits] = await Promise.all([
    getLeaderboard(requestedPage, PER_PAGE, LEADERBOARD_LIMIT),
    getCreatorShowcase(),
  ]);

  return (
    <BackgroundWrapper>
      <div className="container mx-auto px-4 pt-8">
        <Navigation />
      </div>

      <main className="container mx-auto px-4 md:px-6 lg:px-8 pb-16">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-mono text-center tracking-wider mb-8 md:mb-12">
          HALL OF FAME
        </h1>

        {/* INTRO — placeholder until SLeNDeR_KiLLeR supplies the real copy */}
        <div className="content-text max-w-3xl mx-auto mb-12 md:mb-16">
          <p className="text-base md:text-lg leading-relaxed text-center text-gray-300">
            Intro text goes here — placeholder copy so the page can be reviewed.
          </p>
        </div>

        <CreatorShowcase username={CREATOR_USERNAME} portraits={creatorPortraits} />

        <section>
          <h2 className="text-3xl md:text-4xl font-mono text-center mb-2">MOST P100s</h2>
          <p className="text-center text-gray-400 text-sm font-mono mb-6 md:mb-8">
            Top {LEADERBOARD_LIMIT} — tied players share a place
          </p>
          <Leaderboard data={board} />
        </section>
      </main>
    </BackgroundWrapper>
  );
}

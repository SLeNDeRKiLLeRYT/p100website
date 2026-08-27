import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Hall of Fame | The Ultimate P100 List Library',
  description: 'The players with the most P100s in Dead by Daylight.',
};

export default function HallOfFamePage() {
  return (
    <BackgroundWrapper>
      <div className="container mx-auto px-4 pt-8">
        <Navigation />
      </div>

      <main className="container mx-auto px-4 md:px-6 lg:px-8 pb-16">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-mono text-center tracking-wider mb-8 md:mb-12">
          HALL OF FAME
        </h1>

        {/* INTRO — placeholder until SLeNDeR_KiLLeR supplies the final copy */}
        <div className="content-text max-w-3xl mx-auto mb-12 md:mb-16">
          <p className="text-base md:text-lg leading-relaxed text-center text-gray-300">
            Intro text goes here — this is placeholder copy so the page can be
            reviewed. Replace with the real introduction.
          </p>
        </div>

        {/* CREATOR SHOWCASE — item 9 */}
        <section className="mb-12 md:mb-16">
          <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 md:p-8 backdrop-blur-sm text-center">
            <h2 className="text-2xl md:text-3xl font-mono mb-2">
              SLeNDeR_KiLLeR, creator of the website
            </h2>
            <p className="text-gray-400 text-sm">Showcase coming next.</p>
          </div>
        </section>

        {/* LEADERBOARD — items 10 &amp; 11 */}
        <section>
          <h2 className="text-3xl md:text-4xl font-mono text-center mb-6 md:mb-8">
            MOST P100s
          </h2>
          <div className="bg-black/40 border border-red-600/30 rounded-lg p-8 text-center text-gray-400">
            Leaderboard coming next.
          </div>
        </section>
      </main>
    </BackgroundWrapper>
  );
}

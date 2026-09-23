import Navigation from '@/components/ui/Navigation';
import BadgeShowcase from '@/components/BadgeShowcase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'FAQ | The Ultimate P100 List Library',
  description:
    'Answers about the P100 List Library: when it was made, artwork credits, how to help, list order, and what the icons next to player names mean.',
};

const DISCORD_INVITE = 'https://discord.gg/GFPuzehJZs';
const DONATION_LINK = 'https://streamelements.com/slender_kill3r/tip';

function Question({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-mono text-lg md:text-xl text-red-400 mb-3">{question}</h2>
      <div className="font-mono text-sm leading-relaxed text-gray-300 space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <Navigation hideFaq />

        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-mono mb-10 text-center">FAQ</h1>

          {/* All answers written by SLeNDeR_KiLLeR. Reproduced verbatim. */}

          <Question question="When was this website created?">
            <p>
              I got the idea to create this at the end of 2024, when it was the trend on
              Twitter to do P100 lists for specific characters, and noticed that most
              characters didn&apos;t have a list for them, so I wanted to make a place
              where everyone could show off their beloved p100s
            </p>
          </Question>

          <Question question="Where can I find the credits for any artwork visible on the website?">
            <p>
              For each artwork, I made sure to place the name below, and the link, either
              by clicking on it, or right below, with the name when it was not possible.
            </p>
          </Question>

          <Question question="Can I help with the website?">
            <p>
              The best thing you could do, would be to share the website so we can reach
              more players and add more p100s on the list &lt;3 any p100 added is a
              victory ! You can also financially support the website monthly cost{' '}
              <a
                href={DONATION_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 underline hover:text-red-300"
              >
                here
              </a>{' '}
              ! Any support and donation will go directly toward the website &lt;3
            </p>
          </Question>

          <Question question="Are lists ordered in any particular way?">
            <p>
              No, I am not trying to start a competition by ordering the lists by date,
              and some things are impossible to prove. It&apos;s easier this way.
              <br />
              First come, first added. With exceptions.
            </p>
          </Question>

          <Question question="What do the icons on some players names mean?">
            <p>We have icons for special members of our lovely community &lt;3</p>

            <ul className="list-disc pl-6 space-y-3">
              <li>
                The p200 icon is here for people that get a character p100 on 2 DIFFERENT
                accounts. To submit for that badge you need to join the Discord.
              </li>
              <li>
                The different star icons are for really kind people that chose to support
                the website financially. I am really grateful for each and all of those
                that donate, it helps with the monthly cost of the website as well as
                funding updates. Thank you !
              </li>
              <li>
                The heart icon is for the best dbd player of all time, this is not
                debatable &lt;3
              </li>
              <li>
                The legacy icon some names have is for players owning the legacy outfits
                that were available in the old prestige system ! Please{' '}
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 underline hover:text-red-300"
                >
                  join the discord
                </a>{' '}
                to request it !
              </li>
            </ul>

            <div className="pt-4">
              <BadgeShowcase />
            </div>
          </Question>
        </div>
      </main>
    </div>
  );
}

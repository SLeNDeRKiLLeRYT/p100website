import Image from "next/image";
import Navigation from "@/components/ui/Navigation";

export const dynamic = 'force-dynamic';

export default function CreditsPage() {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <Navigation hideCredits />
        
        {/* Centered content wrapper */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-mono mb-8 text-center">CREDITS ❤️</h1>
          
          {/* Centered container for the image and its caption */}
          <div className="flex flex-col items-center mb-8">
            <a
              href="https://x.com/HavesomePotat0"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full max-w-md group"
            >
              <div className="relative h-72 border border-gray-700 overflow-hidden">
                <Image
                  src="/Art by Emilu.png"
                  alt="Credits artwork by Emilu"
                  fill
                  className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                />
              </div>
            </a>
            <p className="mt-2 text-sm italic text-gray-400">Art by Emilu</p>
          </div>
          
          <div className="mb-12 space-y-6 font-mono text-center">
            <p className="text-lg">Hello!</p>
            
            <p className="text-sm">
              Thank you for visiting the credits section. I am Steve Slender, the one who came up with the idea for this website and built it. I'm a variety streamer who loves gathering data and playing DBD. Of course, I was not alone in this. Many people—players, artists, and friends—helped me along the way.
            </p>
            
            <p className="text-sm">
              Even though I wrote down the names, organized the DMs I received, and checked the screenshots, everything you see and are browsing right now would not exist without their help. I especially want to thank Pix, Convalaja, and Zet_Zen, all amazing people who contributed to this project.
            </p>
            
            <p className="text-sm">
              I mentioned artists, and you probably saw their work above. Every artwork has the author's name below it, and clicking the artwork will redirect you to the artist's main social media account. If it doesn't redirect you or lacks credits, I made it. All the artists are amazing people—please show them support and love! This website would never be this beautiful without them!
            </p>
            
            <p className="text-sm">
              This website was also heavily inspired by a trend of P100 lists that happened on Twitter a few months ago. People were creating lists by character, and I wanted to turn it into something bigger. Somehow, this website came to life in the end! Seeing that the DBD community loved those lists as much as I do, it seemed like a great idea.
            </p>
            
            <p className="text-sm">
              If you are a content creator, feel free to show the website during a stream or in a video! The goal is to get as many P100s as possible.
            </p>
            
            <p className="text-sm font-bold">
              SPECIAL THANKS TO PIX, ZEBROWSKI, CONVALAJA, and ZET_ZEN for helping with the website!
            </p>
            <p className="text-sm">
              Special thanks to{" "}
              <a
                href="https://x.com/princegrid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white-400 underline hover:text-blue-300"
              >
                princegrid
              </a>{" "}
              for developing the website!
            </p>

          </div>
        </div>
      </main>
    </div>
  );
}
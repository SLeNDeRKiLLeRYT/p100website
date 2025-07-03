import Image from "next/image";
import Navigation from "@/components/ui/Navigation";
import BackgroundWrapper from "@/components/BackgroundWrapper";

export const dynamic = 'force-dynamic';


export default function CreditsPage() {
  return (
    <BackgroundWrapper>
      <main className="container mx-auto px-4 py-8">
        <Navigation hideCredits />
        
        {/* Centered content wrapper */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-mono mb-8 text-center">CREDITS &lt;3</h1>
          
          <div className="flex justify-center mb-8">
            <div className="w-full max-w-md relative h-72 border border-gray-700">
              <Image
                src="https://images.pexels.com/photos/7034539/pexels-photo-7034539.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
                alt="Credits artwork"
                fill
                className="object-cover"
              />
            </div>
          </div>
          
          <div className="mb-12 space-y-6 font-mono text-center">
            <p className="text-lg">Hello !</p>
            
            <p className="text-sm">
              Thank you for coming to the credits section. I, the one who came up the idea of this website, and made it, am steve
              slender. A variety streamer, that loves to gather data, and DBD. I was of course not alone on this. Lot of people,
              players, artists, and friends helped me.
            </p>
            
            <p className="text-sm">
              Even if I was the one to write down the names, order the dms I got, and check the screenshots. Everything you see and what
              you are browsing right now, would not be there without them. So I really want to thank Pix, Convalaja, and Zet_Zen who are
              all amazing people who helped with this project.
            </p>
            
            <p className="text-sm">
              I talked about artists, and you probably saw them around (in fact, right above this). Every artwork got the author&apos;s name
              below it, along with the artwork itself redirecting you toward the main social media account of the artist. If it doesn&apos;t
              redirect you, or lack credits, I made it. They are all amazing people, please show them support and love ! This website
              would never be this beautiful without them !
            </p>
            
            <p className="text-sm">
              This website was also HEAVILY inspired by a trend of P100 lists that happened on Twitter, a few months ago. People were
              creating lists by characters, and I wanted to turn it into something bigger. Somehow, this website came to life in the end
              haha. Seeing that the DBD community was loving those lists as much as I do, this seemed like a good idea.
            </p>
            
            <p className="text-sm">
              If you are a content creator, feel free to show the website during a stream or in a video ! The goal is to get as many
              P100s as possible.
            </p>
            
            <p className="text-sm">
              SPECIAL THANKS TO PIX, ZEBROWSKI, CONVALAJA, ZET_ZEN for helping with the website !
            </p>
          </div>
        </div>
      </main>
    </BackgroundWrapper>
  );
}
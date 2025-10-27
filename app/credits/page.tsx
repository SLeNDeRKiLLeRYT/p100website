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
                  src="https://ddejzyoxrbccpickqakz.supabase.co/storage/v1/object/public/artworks//Art%20by%20Emilu.png"
                  alt="Credits artwork by Emilu"
                  fill
                  className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                />
              </div>
            </a>
            <p className="mt-2 text-sm italic text-gray-400">Art by Emilu</p>
          </div>
          
          <div className="mb-12 font-mono text-sm leading-relaxed space-y-4">
            <p>Hello !</p>
            <p>
              Thank you for coming to the credits section. I, the one who came up the idea of this website, and made it, am steve Slender. A variety streamer, that loves to gather data, and DbD.
            </p>
            <p>
              I was of course not alone on this. Lot of people, players, artists, and friends helped me. Even if I was the one to write down the names, order the dms i got, and check the screenshots. Everything you see and what you are browsing right now, would not be there without them. So I really want to thank Pix, Convaliaa, and Zet_Zen who are all amazing people who helped with this project.
            </p>
            <p>
              I talked about artists, and you probably saw them around (in fact, right above this). Every artwork got the author's name below it, along with the artwork itself redirecting you toward the main social media account of the artist. If it doesn't redirect you, or lack credits, I made it. They are all amazing people, please show them support and love ! This website would never be this beautiful without them !
            </p>
            <p>
              This website was also HEAVILY inspired by a trend of P100 lists that happened on Twitter, a few months ago. People were sharing their love for their favorite character by making lists of people who got p100 on them. I loved the idea, but then I noticed : Some characters were never even mentioned. Or when they were, the ones who did would give up saying there was not enough people to make a list. Remember when i said I love Dead by Daylight?
            </p>
            <p>
              I love every and each of its characters. seeing this made me a bit sad that some of them would simply not get a list because of the lack of communication and means to get players on that list. So I did, what you are reading, this website. I was also heavily helped by the ones who made the original p100 lists, and this, again, would not be possible without them.
            </p>
            <p>I want to thanks :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Witheringspark, for the Cheryl list,</li>
              <li>VeriHiHi, for the Leon list,</li>
              <li>YoichiBear, for the Yoichi list,</li>
              <li>Riversknife, for the Trickster list, along with the amazing screenshots,</li>
              <li>Ghost Anonymous, for the Chucky list,</li>
              <li>D4wny3l, for the Nea list,</li>
              <li>Horceror, for the Nemesis list,</li>
              <li>Resoleon, for the Knight list,</li>
              <li>YoCyanide, for the Yun-Jin list,</li>
              <li>Momtanna, for the Feng Min list,</li>
              <li>Diabetic, for the Nancy list,</li>
              <li>Raccoon kid, for the Singularity list,</li>
              <li>Brandyn, for the Unknown list (not that i forgot what list they helped with. It's literally the Unknown.)</li>
              <li>allthatjasss, for the Zarina list,</li>
              <li>Esskay, for the GhostFace list,</li>
              <li>Needtorename, for the Leatherface list,</li>
              <li>AlexandrFall, for the DeathSlinger list,</li>
              <li>GrimCyanide, for the Alan Wake list,</li>
              <li>and Aries, for the Jill list.</li>
            </ul>
            <p>
              Special thanks to HPHoenix, for helping me with the Clown and Doctor lists, as well as sending me every P100 they could spot. Huge !
            </p>
            <p>Thank you so much for reading.<br/>Much love,<br/>Slender</p>
          </div>
        </div>
      </main>
    </div>
  );
}
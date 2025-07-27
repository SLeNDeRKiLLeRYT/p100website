import Link from "next/link";
import Navigation from "@/components/ui/Navigation";
import BackgroundWrapper from "@/components/BackgroundWrapper";
import RecentP100s from "@/components/RecentP100s";
import HighlightOfTheDay from "@/components/HighlightOfTheDay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <BackgroundWrapper backgroundUrl="/homepage.png">
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-mono mb-8 md:mb-12 text-center">
          The Ultimate P100 List Library.
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 mb-12 md:mb-16 lg:mb-20 justify-center">
          <Link href="/killers" className="nav-button text-center">
            KILLERS
          </Link>
          <Link href="/survivors" className="nav-button text-center">
            SURVIVORS
          </Link>
          <Link href="/credits" className="nav-button text-center">
            Credits
          </Link>
        </div>
      
        <div className="content-text mb-12 md:mb-16 lg:mb-20">
          <p className="text-xl md:text-2xl lg:text-3xl mb-6 md:mb-8">Hello !</p>
          
          <p className="text-base md:text-lg lg:text-xl leading-relaxed mb-6 md:mb-8">
            Welcome to the Ultimate P100 List Library, created by SLeNDeR_KiLLeR.
            <br className="hidden md:block" />
            If you are reading this, the list(s) are still being updated ! Thanks to everyone who helped keep them up to date, it&apos;s a lot of work.
            <br className="hidden md:block" />
            To check out the lists, simply click on <Link href="/killers" className="text-red-400 hover:text-red-300 font-bold underline transition-colors">Killers</Link> or <Link href="/survivors" className="text-red-400 hover:text-red-300 font-bold underline transition-colors">Survivors</Link> above to have a complete list of the game&apos;s roster ! From there, you can choose which list you want to see.
          </p>
          
          <div className="faq-section">
            <h2 className="text-2xl md:text-3xl lg:text-4xl mb-4 md:mb-6">Want to add a P100?</h2>
            <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 md:mb-6">Right below :</h3>
            
            <div className="text-center mb-8 md:mb-12">
              <Link href="/submission" className="nav-button-large inline-block rounded-lg">
                🎯 SUBMIT P100
              </Link>
            </div>
            
            {/* P100 Showcase Section with Tabs */}
            <div className="mb-8 md:mb-12">
              <Tabs defaultValue="recent" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-black/60 border border-red-600/50">
                  <TabsTrigger 
                    value="recent" 
                    className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-300"
                  >
                    Recent P100s
                  </TabsTrigger>
                  <TabsTrigger 
                    value="highlight" 
                    className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black text-gray-300"
                  >
                    Highlight of the Day
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="recent" className="mt-6">
                  <RecentP100s />
                </TabsContent>
                
                <TabsContent value="highlight" className="mt-6">
                  <HighlightOfTheDay />
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 md:p-8 mb-8 md:mb-12 backdrop-blur-sm">
              <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 md:mb-6 text-center">Looking for someone?</h3>
              <p className="text-base md:text-lg leading-relaxed mb-6 text-center text-gray-300">
                Search for specific players to see all their P100 characters in one place.
              </p>
              <div className="text-center">
                <Link href="/search" className="nav-button-large inline-block rounded-lg">
                  🔍 SEARCH PLAYERS
                </Link>
              </div>
            </div>
            
            <div className="space-y-8 md:space-y-12">
              <div>
                <h3 className="faq-question">FAQ :</h3>
                
                <div className="space-y-6 md:space-y-8">
                  <div>
                    <p className="faq-question">- When was this website created?</p>
                    <p className="faq-answer">
                      I got the idea to create this at the end of 2024, when it was the trend on Twitter to do P100 lists for specific characters
                    </p>
                  </div>
                  
                  <div>
                    <p className="faq-question">- Where can I find the credits for any artwork visible on the website?</p>
                    <p className="faq-answer">
                      For each artwork, I made sure to place the name below, and the link, either by clicking on it, or right below, with the name when it was not possible
                    </p>
                  </div>
                  
                  <div>
                    <p className="faq-question">- Can I help with the website?</p>
                    <p className="faq-answer">
                      I do not accept financial help, however the best thing you could do, would be to share the website so we can reach more players and add more p100s on the list &lt;3 any p100 added is a victory !
                    </p>
                  </div>
                  
                  <div>
                    <p className="faq-question">- Are lists ordered in any particular way?</p>
                    <p className="faq-answer">
                      No, I am not trying to start a competition by ordering the lists by date, and some things are impossible to prove. It&apos;s easier this way.
                      <br className="hidden sm:block" />
                      First come, first added
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </BackgroundWrapper>
  );
}
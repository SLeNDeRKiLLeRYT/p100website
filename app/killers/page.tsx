import Link from "next/link";
import Navigation from "@/components/ui/Navigation";
import CharacterGrid from "@/components/CharacterGrid";
import BackgroundWrapper from "@/components/BackgroundWrapper";
import { createServerClient } from "@/lib/supabase-client";
import { Character } from "@/lib/data";

export const dynamic = 'force-dynamic';

export const revalidate = 0;  // Revalidate every request

async function getKillers(): Promise<Character[]> {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('killers')
      .select('*')
      .order('order', { ascending: true });
    
    if (error) {
      console.error('Error fetching killers:', error);
      throw new Error(`Failed to fetch killers: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No killers found in database');
      return [];
    }
    
    return data.map(killer => ({
      id: killer.id,
      name: killer.name,
      imageUrl: killer.image_url
    }));
  } catch (error) {
    console.error('Unexpected error fetching killers:', error);
    throw error; // Re-throw to trigger error boundary
  }
}

export default async function KillersPage() {
  const killers = await getKillers();

  return (
    <BackgroundWrapper backgroundUrl="/killerpage.png">
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
        <Navigation hideKillers />
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-mono mb-8 md:mb-12 text-center">
          Welcome to the P100 Killers SELECTION PAGE
        </h1>
        
        <div className="content-text mb-12 md:mb-16 lg:mb-20">
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">You can find each list&apos;s original creator on the credits page.</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">Click on any killer icon to see the current list of P100s.</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">If you have a P100 and you are not on a list yet, or if you made a P100 list, feel free to contact me !</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">Links and contact details are at the bottom !</p>
        </div>
        
        <CharacterGrid characters={killers} type="killer" />
      </main>
    </BackgroundWrapper>
  );
}
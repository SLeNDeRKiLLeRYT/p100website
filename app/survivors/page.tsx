import Link from "next/link";
import Navigation from "@/components/ui/Navigation";
import CharacterGrid from "@/components/CharacterGrid";
import BackgroundWrapper from "@/components/BackgroundWrapper";
import { createServerClient } from "@/lib/supabase-client";
import { Character } from "@/lib/data";

export const revalidate = 3600; // Revalidate every hour

async function getSurvivors(): Promise<Character[]> {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('survivors')
      .select('*')
      .order('order_num', { ascending: true });
    
    if (error) {
      console.error('Error fetching survivors:', error);
      throw new Error(`Failed to fetch survivors: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No survivors found in database');
      return [];
    }
    
    console.log('Found survivors:', data);
    
    return data.map(survivor => ({
      id: survivor.id,
      name: survivor.name,
      imageUrl: survivor.image_url
    }));
  } catch (error) {
    console.error('Unexpected error fetching survivors:', error);
    throw error;
  }
}

export default async function SurvivorsPage() {
  const survivors = await getSurvivors();

  return (
    <BackgroundWrapper backgroundUrl="/survivorpage.png">
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
        <Navigation hideSurvivors />
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-mono mb-8 md:mb-12 text-center">
          Welcome to the P100 Survivors SELECTION PAGE
        </h1>
        
        <div className="content-text mb-12 md:mb-16 lg:mb-20">
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">You can find each list&apos;s original creator on the credits page.</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">Click on any survivor icon to see the current list of P100s.</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">Legendary cosmetics are considered the same as the base survivor. (i.e. : P100 Rain would be listed as P100 Ellen Ripley)</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">If you have a P100 and you are not on a list yet, or if you made a P100 list, feel free to contact me !</p>
          <p className="text-base md:text-lg lg:text-xl leading-relaxed">Links and contact details are at the bottom !</p>
        </div>
        
        <CharacterGrid characters={survivors} type="survivor" />
      </main>
    </BackgroundWrapper>
  );
}
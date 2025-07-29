import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import CharacterNavigation from '@/components/CharacterNavigation';
import { createServerClient } from '@/lib/supabase-client';
import { getCharacterNavigation } from '@/lib/character-navigation';
import { analyzeCharacterArtworks, logDetailedArtworkAnalysis } from '@/lib/artist-analytics';

// Define types for our data
interface P100Player {
  id: string;
  username: string;
  added_at: string;
  p200: boolean | null;
  legacy: boolean | null; // Add legacy field
}

interface KillerData {
  id: string;
  name: string;
  image_url: string;
  header_url?: string | null;
  artist_urls?: (string | null)[] | null;
  legacy_header_urls?: (string | null)[] | null;
  players: P100Player[];
  background_image_url?: string;
}

// Helper function to check if legacy header should be displayed
function shouldDisplayLegacyHeader(legacy_header_urls: (string | null)[] | null | undefined): boolean {
  return legacy_header_urls !== null && 
         legacy_header_urls !== undefined && 
         legacy_header_urls.length >= 2 &&
         !!legacy_header_urls[0] && 
         !!legacy_header_urls[1];
}

export async function generateStaticParams() {
  try {
    const supabase = createServerClient();
    const { data: killers, error } = await supabase
      .from('killers')
      .select('id')
      .order('id');
    
    if (error) {
      console.error('Error fetching killers for static params:', error);
      return [];
    }
    
    if (!killers || killers.length === 0) {
      console.warn('No killers found in database for static params');
      return [];
    }
      return killers.map(killer => ({
      slug: killer.id
    }));
  } catch (error) {
    console.error('Unexpected error in generateStaticParams:', error);
    return [];
  }
}

async function getKillerData(slug: string): Promise<KillerData | null> {
  const supabase = createServerClient();
  const { data: killer, error: killerError } = await supabase
    .from('killers')
    .select('id, name, image_url, created_at, updated_at, order, background_image_url, header_url, artist_urls, legacy_header_urls')
    .eq('id', slug)
    .single();
  
  if (killerError) {
    console.error('Error fetching killer:', killerError);
    return null;
  }
  if (!killer) {
    console.log('No killer found for slug:', slug);
    return null;
  }
  
  let players: any[] = [];
  const { data: playersById, error: playersByIdError } = await supabase
    .from('p100_players')
    .select('*')
    .eq('killer_id', killer.id)
    .order('added_at', { ascending: true });
  if (playersByIdError) {
    console.error('Error fetching players by ID:', playersByIdError);
  } else if (playersById && playersById.length > 0) {
    players = playersById;
  } else {
    const killerNameLower = killer.name.toLowerCase();
    const { data: playersByName, error: playersByNameError } = await supabase
      .from('p100_players')
      .select('*')
      .eq('killer_id', killerNameLower)
      .order('added_at', { ascending: true });
    
    if (playersByNameError) {
      console.error('Error fetching players by name:', playersByNameError);
    } else {
      players = playersByName || [];
    }
  }
  
  let parsedArtistUrls = null;
  if (killer.artist_urls) {
    try {
      parsedArtistUrls = typeof killer.artist_urls === 'string' 
        ? JSON.parse(killer.artist_urls) 
        : killer.artist_urls;
      console.log('✓ Identified artist names:', parsedArtistUrls?.length || 0, 'URLs from killer data');
    } catch (error) {
      console.error('Error parsing artist_urls:', error);
    }
  }
  return {
    ...killer,
    artist_urls: parsedArtistUrls,
    players: players || []
  };
}

export default async function KillerPage({ params }: { params: { slug: string } }) {
  const killerData = await getKillerData(params.slug);
  
  if (!killerData) {
    notFound();
  }
  
  const navigation = await getCharacterNavigation(params.slug, 'killer');

  const analytics = await analyzeCharacterArtworks(
    killerData.id,
    killerData.name,
    'killer',
    (killerData.artist_urls as string[]) || [],
    killerData.legacy_header_urls
  );
  
  logDetailedArtworkAnalysis(analytics);

  const artworkAnalyticsMap = new Map(analytics.artworkDetails.map(detail => [detail.artworkUrl, detail]));
  const galleryArtworkDetails = analytics.artworkDetails.filter(detail => killerData.artist_urls?.includes(detail.artworkUrl));

  return (
    <>
      <BackgroundWrapper 
        characterId={killerData.id}
        backgroundUrl={killerData.background_image_url}
      >
        <CharacterNavigation previous={navigation.previous} next={navigation.next} />
        
        <main className="container mx-auto px-4 py-8 pt-16 sm:pt-20">
          <Navigation />
          
          {/* Centered header content */}
          <div className="max-w-4xl mx-auto relative">
            {shouldDisplayLegacyHeader(killerData.legacy_header_urls) ? (
              <div className="mb-12">
                <div className="hidden md:flex items-center justify-center gap-8 mb-8">
                  <div className="flex-shrink-0">                    
                    {(() => {
                        const detail = artworkAnalyticsMap.get(killerData.legacy_header_urls![0]!);
                        return (
                          <a href={detail?.artist?.url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                            <div className="relative w-48 h-64 overflow-hidden rounded-lg shadow-lg">
                              <Image src={killerData.legacy_header_urls![0]!} alt={`${killerData.name} artwork`} fill className="object-contain" priority/>
                            </div>
                            <div className="mt-2 text-center">
                               <p className="text-sm text-gray-300">Art by {detail?.artist?.name || 'Unknown'}</p>
                            </div>
                          </a>
                        );
                    })()}
                  </div>
                  <div className="flex-1 max-w-md text-center">
                    <h1 className="text-3xl font-mono mb-6 underline">P100 {killerData.name.toUpperCase()}</h1>
                    <div className="space-y-4 font-mono text-lg">
                      <p>
                        Welcome on the P100 {killerData.name} page. Here, you will find the list, 
                        as well as multiple artwork/renders made by wonderful artists. 
                        Click on the image to go to the artist's page directly. 
                        You can also see their name below each fanart. Reminder that it isn't ordered! 
                        You can find links at the bottom of the page to contact me.
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="relative w-48 h-64 overflow-hidden rounded-lg shadow-lg">
                      <Image src={killerData.legacy_header_urls![1]!} alt={`${killerData.name} perks`} fill className="object-contain" priority/>
                    </div>
                  </div>
                </div>
                <div className="md:hidden space-y-6">
                  <h1 className="text-3xl font-mono mb-6 underline text-center">Welcome to the P100 {killerData.name.toUpperCase()}</h1>
                  <div className="space-y-4 font-mono text-lg text-center">
                    <p>
                      Welcome on the P100 {killerData.name} page. Here, you will find the list, 
                      as well as multiple artwork/renders made by wonderful artists. 
                      Click on the image to go to the artist's page directly. 
                      You can also see their name below each fanart. Reminder that it isn't ordered! 
                      You can find links at the bottom of the page to contact me.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const detail = artworkAnalyticsMap.get(killerData.legacy_header_urls![0]!);
                      return (
                        <div>
                          <a href={detail?.artist?.url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                            <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-lg">
                              <Image src={killerData.legacy_header_urls![0]!} alt={`${killerData.name} artwork`} fill className="object-contain" priority/>
                            </div>
                          </a>
                          <div className="mt-2 text-center">
                            <p className="text-sm text-gray-300">Art by {detail?.artist?.name || 'Unknown'}</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-lg">
                        <Image src={killerData.legacy_header_urls![1]!} alt={`${killerData.name} perks`} fill className="object-contain" priority/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-mono mb-6 underline text-center">P100 {killerData.name.toUpperCase()}</h1>
                {killerData.header_url && (
                  <div className="mb-8">
                    <div className="relative h-48 md:h-64 lg:h-80 w-full overflow-hidden rounded-lg">
                      <Image src={killerData.header_url} alt={`${killerData.name} header`} fill className="object-contain" priority/>
                    </div>
                  </div>
                )}
                {!killerData.header_url && (
                  <div className="mb-12 space-y-4 font-mono text-xl text-center">
                    <p>
                      Welcome on the P100 {killerData.name} page. Here, you will find the list, 
                      as well as multiple artwork/renders made by wonderful artists. 
                      Click on the image to go to the artist's page directly. 
                      You can also see their name below each fanart. Reminder that it isn't ordered! 
                      You can find links at the bottom of the page to contact me.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ====== NEW LAYOUT CONTAINER ====== */}
          <div className="relative xl:grid xl:grid-cols-[1fr_minmax(0,_56rem)_1fr] xl:gap-x-16">
            
            {/* Left Side Artist Gallery (Grid Col 1) */}
            <div className="hidden xl:block space-y-6 pt-12 max-w-sm mx-auto">
              {galleryArtworkDetails.slice(0, Math.ceil(galleryArtworkDetails.length / 2)).map((detail, index) => (
                  <a key={`left-artwork-${index}`} href={detail.artist?.url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                      <div className="relative overflow-hidden rounded-lg shadow-lg">
                          <Image src={detail.artworkUrl} alt={`${killerData.name} artwork by ${detail.artist?.name || 'Unknown'}`} width={1800} height={1800} className="w-full h-auto object-contain"/>
                      </div>
                      <div className="mt-2 text-center">
                          <p className="text-sm text-gray-300">Art by: {detail.artist?.name || 'Unknown'}</p>
                      </div>
                  </a>
              ))}
            </div>

            {/* Center Column (Grid Col 2) */}
            <div className="w-full">
              <div className="mb-10">
                <h2 className="text-xl font-mono mb-6 text-center">The P100 {killerData.name} list starts here:</h2>
                {killerData.players.length === 0 ? (
                  <div className="bg-black/40 border border-red-600/30 rounded-lg p-8 text-center">
                    <p className="font-mono text-lg text-gray-400">No P100 players found for this killer yet.</p>
                    <p className="font-mono text-sm text-gray-500 mt-2">Be the first to submit your P100!</p>
                  </div>
                ) : (
                  <div className="bg-black/30 border border-red-600/20 rounded-lg p-6 backdrop-blur-sm">
                    <div className="mb-4 flex items-center justify-center gap-4 text-sm text-gray-400 font-mono">
                      <span>Total P100 Players: {killerData.players.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {killerData.players.map((player) => {
                        const decodedUsername = player.username
                          .replace(/"/g, '"')
                          .replace(/'/g, "'")
                          .replace(/</g, '<')
                          .replace(/>/g, '>')
                          .replace(/&/g, '&');
                        
                        const isLongName = decodedUsername.length > 14;
                        const baseNameClasses = `font-mono text-sm text-gray-200`;
                        
                        // Add legacy glow effect
                        const nameClasses = player.legacy 
                          ? `${baseNameClasses} text-orange-200 drop-shadow-[0_0_4px_rgba(251,146,60,0.8)] animate-pulse`
                          : baseNameClasses;

                        return (
                            <Link
                              key={player.id}
                              href={`/profile/${encodeURIComponent(decodedUsername)}`}
                              className="group relative block bg-black/40 border border-red-600/20 rounded-md p-3 hover:border-red-500/40 hover:bg-black/60 transition-all duration-200"
                              role="listitem"
                              tabIndex={0}
                              title={`View P100 profile for ${decodedUsername}`}
                            >
                              <div className="flex flex-col items-center justify-center w-full h-full min-h-[36px] space-y-2">
                              <div className="relative">
                                <span className={`${nameClasses} block truncate max-w-full leading-tight`}>
                                  {isLongName ? `${decodedUsername.substring(0, 14)}...` : decodedUsername}
                                </span>
                                {isLongName && (
                                  <div className="absolute invisible group-hover:visible z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-3 py-2 bg-black border border-red-500 rounded-md text-white text-sm font-mono shadow-2xl pointer-events-none transition-all duration-300 ease-out group-hover:scale-110 group-hover:animate-in group-hover:fade-in-0 group-hover:zoom-in-95">
                                    <div className="whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                                      {decodedUsername}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {(player.p200 || player.legacy) && (
                                <div className="flex items-center gap-1">
                                  {player.p200 && (
                                    <div className="w-5 h-5" title="P200 means a player reached P100 on the same character twice. This is a rare achievement and the players on this list deserve full credit for the time and dedication it takes to reach it.">
                                      <Image src="/p200.png" alt="P200 Achievement" width={20} height={20} className="object-contain"/>
                                    </div>
                                  )}
                                  {player.legacy && (
                                    <div className="w-5 h-5" title="Legacy player: One of the original P100 achievers who reached this milestone when it was extremely rare and difficult.">
                                      <Image src="/legacy.png" alt="Legacy Achievement" width={20} height={20} className="object-contain"/>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            </Link>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-600/20 text-center">
                      <p className="text-xs text-gray-500 font-mono">Last updated: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Mobile Artwork Gallery */}
              {galleryArtworkDetails.length > 0 && (
                <div className="mb-12 xl:hidden">
                  <h2 className="text-xl font-mono mb-4 text-center">Artwork Gallery</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {galleryArtworkDetails.map((detail, index) => (
                      <a key={`mobile-artwork-${index}`} href={detail.artist?.url || '#'} target="_blank" rel="noopener noreferrer" className="block">
                        <div className="relative overflow-hidden rounded-lg">
                          <Image src={detail.artworkUrl} alt={`${killerData.name} artwork by ${detail.artist?.name || 'Unknown'}`} width={0} height={0} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="w-full h-auto transition-transform hover:scale-105" style={{ width: 'auto', height: 'auto' }} loading="lazy"/>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-center">
                            <p className="text-sm">Art by: {detail.artist?.name || 'Unknown'}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Artist Gallery (Grid Col 3) */}
            <div className="hidden xl:block space-y-6 pt-12 max-w-sm mx-auto">
              {galleryArtworkDetails.slice(Math.ceil(galleryArtworkDetails.length / 2)).map((detail, index) => (
                  <a key={`right-artwork-${index}`} href={detail.artist?.url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                      <div className="relative overflow-hidden rounded-lg shadow-lg">
                          <Image src={detail.artworkUrl} alt={`${killerData.name} artwork by ${detail.artist?.name || 'Unknown'}`} width={1800} height={1800} className="w-full h-auto object-contain"/>
                      </div>
                      <div className="mt-2 text-center">
                          <p className="text-sm text-gray-300">Art by: {detail.artist?.name || 'Unknown'}</p>
                      </div>
                  </a>
              ))}
            </div>
          </div>
        </main>
      </BackgroundWrapper>
    </>
  );
}
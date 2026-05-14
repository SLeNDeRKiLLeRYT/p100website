import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import LensFlare from '@/components/LensFlare';
import CharacterNavigation from '@/components/CharacterNavigation';
import { createServerClient } from '@/lib/supabase-client';
import { getCharacterNavigation } from '@/lib/character-navigation';
import { getCharacterArtworks } from '@/lib/artwork-management';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Define types for our data
interface P100Player {
  id: string;
  username: string;
  added_at: string;
  p200: boolean | null;
  legacy: boolean | null; // Add legacy field
  favorite: boolean | null; // Add favorite field
}

interface ArtworkDetail {
  artwork_url: string;
  artist_name: string | null;
  artist_url: string | null;
  platform: string | null;
  usage_type: string;
  display_order: number | null;
}

interface SurvivorData {
  id: string;
  name: string;
  image_url: string;
  header_url?: string | null;
  artist_urls?: (string | null)[] | null;
  legacy_header_urls?: (string | null)[] | null;
  players: P100Player[];
  background_image_url?: string;
  background_credit_name?: string | null;
  background_credit_url?: string | null;
  gallery_artworks?: ArtworkDetail[];
  legacy_headers?: ArtworkDetail[];
  header_artwork?: ArtworkDetail;
  background_artwork?: ArtworkDetail;
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
    const { data: survivors, error } = await supabase
      .from('survivors')
      .select('id')
      .order('order_num');
    
    if (error) {
      console.error('Error fetching survivors for static params:', error);
      return [];
    }
    
    if (!survivors || survivors.length === 0) {
      console.warn('No survivors found in database for static params');
      return [];
    }
    
    return survivors.map(survivor => ({
      slug: survivor.id
    }));
  } catch (error) {
    console.error('Unexpected error in generateStaticParams:', error);
    return [];
  }
}

async function getSurvivorData(slug: string): Promise<SurvivorData | null> {
  const supabase = createServerClient();
  
  const { data: survivor, error: survivorError } = await supabase
    .from('survivors')
    .select('id, name, image_url, created_at, updated_at, order_num, background_image_url, background_credit_name, background_credit_url')
    .eq('id', slug)
    .single();
  
  if (survivorError) {
    console.error('Error fetching survivor:', survivorError);
    return null;
  }
  
  if (!survivor) {
    console.log('No survivor found for slug:', slug);
    return null;
  }
  
  // Fetch artworks from centralized table
  const artworks = await getCharacterArtworks(survivor.id, 'survivor');
  
  // Group artworks by usage type
  const galleryArtworks = artworks.filter(a => a.usage_type === 'gallery');
  const legacyHeaders = artworks.filter(a => a.usage_type === 'legacy_header');
  const header = artworks.find(a => a.usage_type === 'header');
  const background = artworks.find(a => a.usage_type === 'background');
  
  let players: any[] = [];
  const { data: playersById, error: playersByIdError } = await supabase
    .from('p100_players')
    .select('*')
    .eq('survivor_id', survivor.id)
    .order('priority', { ascending: false })
    .order('added_at', { ascending: true });

  if (playersByIdError) {
    console.error('Error fetching players by ID:', playersByIdError);
  } else if (playersById && playersById.length > 0) {
    players = playersById;
  } else {
    const survivorNameLower = survivor.name.toLowerCase();
    const { data: playersByName, error: playersByNameError } = await supabase
      .from('p100_players')
      .select('*')
      .eq('survivor_id', survivorNameLower)
      .order('priority', { ascending: false })
      .order('added_at', { ascending: true });
    
    if (playersByNameError) {
      console.error('Error fetching players by name:', playersByNameError);
    } else {
      players = playersByName || [];
    }
  }
  
  return {
    ...survivor,
    artist_urls: galleryArtworks.map(a => a.artwork_url),
    legacy_header_urls: legacyHeaders.map(a => a.artwork_url),
    header_url: header?.artwork_url,
    background_image_url: background?.artwork_url || survivor.background_image_url,
    players: players || [],
    gallery_artworks: galleryArtworks,
    legacy_headers: legacyHeaders,
    header_artwork: header,
    background_artwork: background
  };
}

export default async function SurvivorPage({ params }: { params: { slug: string } }) {
  const survivorData = await getSurvivorData(params.slug);
  
  if (!survivorData) {
    notFound();
  }
  
  const navigation = await getCharacterNavigation(params.slug, 'survivor');

  // Use artwork details directly from centralized database
  const galleryArtworkDetails = survivorData.gallery_artworks || [];
  const legacyHeaderDetails = survivorData.legacy_headers || [];
  
  // Create a map for quick lookup of legacy header artwork details
  const legacyHeaderMap = new Map(legacyHeaderDetails.map(detail => [detail.artwork_url, detail]));
  
  return (
    <>
      <BackgroundWrapper 
        characterId={survivorData.id}
        backgroundUrl={survivorData.background_image_url}
      >
        <LensFlare />
        <CharacterNavigation previous={navigation.previous} next={navigation.next} />
        
        <main className="container mx-auto px-4 py-8 pt-16 sm:pt-20">
          <Navigation />
          {survivorData?.background_credit_name && (
            <div className="max-w-4xl mx-auto mt-2 mb-4 text-center text-xs text-gray-400 italic">
              Background art credit: {survivorData.background_credit_url ? (
                <a href={survivorData.background_credit_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-300">{survivorData.background_credit_name}</a>
              ) : (
                survivorData.background_credit_name
              )}
            </div>
          )}
          <div className="max-w-4xl mx-auto relative">
            {shouldDisplayLegacyHeader(survivorData.legacy_header_urls) ? (
              <div className="mb-12">
                <div className="hidden md:flex items-center justify-center gap-8 mb-8">
                  <div className="flex-shrink-0">
                      {(() => {
                        const detail = legacyHeaderMap.get(survivorData.legacy_header_urls![0]!);
                        return (
                          <a href={detail?.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                            <div className="relative w-48 h-64 overflow-hidden rounded-lg shadow-lg">
                              <Image src={survivorData.legacy_header_urls![0]!} alt={`${survivorData.name} artwork`} fill className="object-contain" priority/>
                            </div>
                            <div className="mt-2 text-center">
                               <p className="text-sm text-gray-300">Art by {detail?.artist_name || 'Unknown'}</p>
                            </div>
                          </a>
                        );
                      })()}
                  </div>
                  <div className="flex-1 max-w-md text-center">
                    <h1 className="text-3xl font-mono mb-6 underline">Welcome to the P100 {survivorData.name.toUpperCase()}</h1>
                    <div className="space-y-4 font-mono text-lg">
                      <p>
                        Welcome on the P100 {survivorData.name} page. Here, you will find the list, 
                        as well as multiple artwork/renders made by wonderful artists. 
                        Click on the image to go to the artist's page directly. 
                        You can also see their name below each fanart. Reminder that it isn't ordered! 
                        You can find links at the bottom of the page to contact me.
                      </p>
                      {survivorData.id.includes('legendary') && (<p>Legendary cosmetics are considered the same as the base survivor. (i.e. : P100 Rain would be listed as P100 Ellen Ripley)</p>)}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                      {(() => {
                        const detail = legacyHeaderMap.get(survivorData.legacy_header_urls![1]!);
                        return (
                          <a href={detail?.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                            <div className="relative w-48 h-64 overflow-hidden rounded-lg shadow-lg">
                              <Image src={survivorData.legacy_header_urls![1]!} alt={`${survivorData.name} perks`} fill className="object-contain" priority/>
                            </div>
                            <div className="mt-2 text-center">
                               <p className="text-sm text-gray-300">Art by {detail?.artist_name || 'Unknown'}</p>
                            </div>
                          </a>
                        );
                      })()}
                  </div>
                </div>
                <div className="md:hidden space-y-6">
                  <h1 className="text-2xl font-mono mb-6 underline text-center">Welcome to the P100 {survivorData.name.toUpperCase()}</h1>
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                        const detail = legacyHeaderMap.get(survivorData.legacy_header_urls![0]!);
                        return (
                          <div>
                            <a href={detail?.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                              <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-lg">
                                <Image src={survivorData.legacy_header_urls![0]!} alt={`${survivorData.name} artwork`} fill className="object-contain" priority/>
                              </div>
                            </a>
                            <div className="mt-2 text-center">
                              <p className="text-xs text-gray-300">Art by {detail?.artist_name || 'Unknown'}</p>
                            </div>
                          </div>
                        );
                    })()}
                    {(() => {
                        const detail = legacyHeaderMap.get(survivorData.legacy_header_urls![1]!);
                        return (
                          <div>
                            <a href={detail?.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                              <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-lg">
                                <Image src={survivorData.legacy_header_urls![1]!} alt={`${survivorData.name} perks`} fill className="object-contain" priority/>
                              </div>
                            </a>
                            <div className="mt-2 text-center">
                              <p className="text-xs text-gray-300">Art by {detail?.artist_name || 'Unknown'}</p>
                            </div>
                          </div>
                        );
                    })()}
                  </div>
                  <div className="space-y-4 font-mono text-sm text-center">
                    <p>
                      Welcome on the P100 {survivorData.name} page. Here, you will find the list, 
                      as well as multiple artwork/renders made by wonderful artists. 
                      Click on the image to go to the artist's page directly. 
                      You can also see their name below each fanart. Reminder that it isn't ordered! 
                      You can find links at the bottom of the page to contact me.
                    </p>
                    {survivorData.id.includes('legendary') && (<p>Legendary cosmetics are considered the same as the base survivor. (i.e. : P100 Rain would be listed as P100 Ellen Ripley)</p>)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-mono mb-6 underline text-center">P100 {survivorData.name.toUpperCase()}</h1>
                {survivorData.header_url && (
                  <div className="mb-8">
                    <div className="relative h-48 md:h-64 lg:h-80 w-full overflow-hidden rounded-lg">
                      <Image src={survivorData.header_url} alt={`${survivorData.name} header`} fill className="object-contain" priority/>
                    </div>
                  </div>
                )}
                {!survivorData.header_url && (
                  <div className="mb-12 space-y-4 font-mono text-xl text-center">
                    <p>
                      Welcome on the P100 {survivorData.name} page. Here, you will find the list, 
                      as well as multiple artwork/renders made by wonderful artists. 
                      Click on the image to go to the artist's page directly. 
                      You can also see their name below each fanart. Reminder that it isn't ordered! 
                      You can find links at the bottom of the page to contact me.
                    </p>
                    {survivorData.id.includes('legendary') && (<p>Legendary cosmetics are considered the same as the base survivor. (i.e. : P100 Rain would be listed as P100 Ellen Ripley)</p>)}
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
                  <a key={`left-artist-url-${index}`} href={detail.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                      <div className="relative overflow-hidden rounded-lg shadow-lg">
                          <Image src={detail.artwork_url} alt={`${survivorData.name} artwork by ${detail.artist_name || 'Unknown'}`} width={1800} height={1800} className="w-full h-auto object-contain"/>
                      </div>
                      <div className="mt-2 text-center">
                          <p className="text-sm text-gray-300">Art by: {detail.artist_name || 'Unknown'}</p>
                      </div>
                  </a>
              ))}
            </div>

            {/* Center Column (Grid Col 2) */}
            <div className="w-full">
              <div className="mb-12">
                <h2 className="text-xl font-mono mb-6 text-center">The P100 {survivorData.name} list starts here:</h2>
                {survivorData.players.length === 0 ? (
                  <div className="bg-black/40 border border-red-600/30 rounded-lg p-8 text-center">
                    <p className="font-mono text-lg text-gray-400">No P100 players found for this survivor yet.</p>
                    <p className="font-mono text-sm text-gray-500 mt-2">Be the first to submit your P100!</p>
                  </div>
                ) : (
                  <div className="bg-black/30 border border-red-600/20 rounded-lg p-6 backdrop-blur-sm">
                    <div className="mb-4 flex items-center justify-center gap-4 text-sm text-gray-400 font-mono">
                      <span>Total P100 Players: {survivorData.players.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {survivorData.players.map((player) => {
                        const decodedUsername = player.username
                          .replace(/"/g, '"')
                          .replace(/'/g, "'")
                          .replace(/</g, '<')
                          .replace(/>/g, '>')
                          .replace(/&/g, '&');
                        
                        const isLongName = decodedUsername.length > 14;
                        const baseNameClasses = `font-mono text-sm text-gray-200`;
                        
                        // Add legacy glow effect
                        let nameClasses = baseNameClasses;
                        let borderClasses = "group relative block bg-black/40 border border-red-600/20 rounded-md p-3 hover:border-red-500/40 hover:bg-black/60 transition-all duration-200";
                        
                        if (player.favorite) {
                          nameClasses = `${baseNameClasses} favorite-glow animate-pulse`;
                          borderClasses = "group relative block bg-black/40 favorite-heart-border rounded-md p-3 hover:border-pink-400/60 hover:bg-pink-900/20 transition-all duration-200";
                        } else if (player.legacy) {
                          nameClasses = `${baseNameClasses} text-orange-200 drop-shadow-[0_0_4px_rgba(251,146,60,0.8)] animate-pulse`;
                        }

                        return (
                          <Link
                            key={player.id}
                            href={`/profile/${encodeURIComponent(decodedUsername)}`}
                            className={borderClasses}
                            role="listitem"
                            tabIndex={0}
                            title={`View P100 profile for ${decodedUsername}`}
                          >
                            {player.favorite && (
                              <div className="favorite-heart-corners">
                                <span className="heart">♥</span>
                                <span className="heart">♥</span>
                                <span className="heart">♥</span>
                                <span className="heart">♥</span>
                              </div>
                            )}
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
                              {(player.p200 || player.legacy || player.favorite) && (
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
                                  {player.favorite && (
                                    <div className="w-5 h-5 text-pink-400" title="Favorite player: A beloved member of the community who has made special contributions and is cherished by fellow players.">
                                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                      </svg>
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
                      <a key={`mobile-artwork-${index}`} href={detail.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block">
                        <div className="relative overflow-hidden rounded-lg">
                          <Image src={detail.artwork_url} alt={`${survivorData.name} artwork by ${detail.artist_name || 'Unknown'}`} width={0} height={0} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="w-full h-auto transition-transform hover:scale-105" style={{ width: 'auto', height: 'auto' }} loading="lazy"/>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-center">
                            <p className="text-sm">Art by: {detail.artist_name || 'Unknown'}</p>
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
                  <a key={`right-artist-url-${index}`} href={detail.artist_url || '#'} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                      <div className="relative overflow-hidden rounded-lg shadow-lg">
                          <Image src={detail.artwork_url} alt={`${survivorData.name} artwork by ${detail.artist_name || 'Unknown'}`} width={1800} height={1800} className="w-full h-auto object-contain"/>
                      </div>
                      <div className="mt-2 text-center">
                          <p className="text-sm text-gray-300">Art by: {detail.artist_name || 'Unknown'}</p>
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
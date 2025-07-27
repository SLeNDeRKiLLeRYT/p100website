import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import { createServerClient } from '@/lib/supabase-client';
import { Crown, Shield } from 'lucide-react';
import PlayerProfileHeader from '@/components/PlayerProfileHeader';

interface PlayerP100s {
  username: string;
  killers: Array<{
    id: string;
    name: string;
    imageUrl: string;
    p200?: boolean;
    legacy?: boolean;
  }>;
  survivors: Array<{
    id: string;
    name: string;
    imageUrl: string;
    p200?: boolean;
    legacy?: boolean;
  }>;
}

async function getPlayerData(username: string): Promise<PlayerP100s | null> {
  const supabase = createServerClient();
  
  const { data: players, error } = await supabase
    .from('p100_players')
    .select('killer_id, survivor_id, p200, legacy') // Add legacy field
    .eq('username', username);

  if (error) {
    console.error('Error fetching player P100s:', error);
    return null;
  }
  
  // This handles both users not found and users with 0 p100s
  if (!players) {
    return { username, killers: [], survivors: [] };
  }

  const killerIds = Array.from(new Set(players.filter(p => p.killer_id).map(p => p.killer_id)));
  const survivorIds = Array.from(new Set(players.filter(p => p.survivor_id).map(p => p.survivor_id)));

  const [killersResponse, survivorsResponse] = await Promise.all([
    killerIds.length > 0
      ? supabase.from('killers').select('id, name, image_url').in('id', killerIds)
      : Promise.resolve({ data: [], error: null }),
    survivorIds.length > 0
      ? supabase.from('survivors').select('id, name, image_url').in('id', survivorIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  
  if (killersResponse.error || survivorsResponse.error) {
    console.error("Error fetching character details:", killersResponse.error || survivorsResponse.error);
    return null;
  }

  const killers = (killersResponse.data || []).map(k => ({ 
    id: k.id, 
    name: k.name, 
    imageUrl: k.image_url,
    // Add status info from player data
    p200: players?.find(p => p.killer_id === k.id)?.p200 || false,
    legacy: players?.find(p => p.killer_id === k.id)?.legacy || false
  })).sort((a,b) => a.name.localeCompare(b.name));
  
  const survivors = (survivorsResponse.data || []).map(s => ({ 
    id: s.id, 
    name: s.name, 
    imageUrl: s.image_url,
    // Add status info from player data
    p200: players?.find(p => p.survivor_id === s.id)?.p200 || false,
    legacy: players?.find(p => p.survivor_id === s.id)?.legacy || false
  })).sort((a,b) => a.name.localeCompare(b.name));

  return { username, killers, survivors };
}


export default async function PlayerProfilePage({ params }: { params: { username: string } }) {
  const decodedUsername = decodeURIComponent(params.username);
  const playerData = await getPlayerData(decodedUsername);

  if (!playerData) {
    notFound();
  }
  
  const totalP100s = playerData.killers.length + playerData.survivors.length;

  return (
    <BackgroundWrapper backgroundUrl="/search.png">
      <Navigation />
      <main className="container mx--auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-mono mb-8 text-center">
            Player Profile
          </h1>

          <div className="space-y-12">
            <PlayerProfileHeader player={playerData} />

            {playerData.killers.length > 0 && (
              <div>
                <h3 className="text-2xl md:text-3xl font-mono mb-6 flex items-center gap-3">
                  <Crown className="h-7 w-7 text-red-400" />
                  P100 Killers ({playerData.killers.length})
                </h3>
                <div className="character-grid">
                  {playerData.killers.map((killer, index) => (
                    <Link key={killer.id} href={`/killers/${killer.id}`} className="character-card group">
                      <div className="relative w-full h-full">
                        <Image
                          src={killer.imageUrl}
                          alt={killer.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          priority={index < 6}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        {killer.p200 && (
                          <div className="absolute top-1 right-1 w-8 h-8 z-20" title="P200 Achievement">
                            <Image src="/p200.png" alt="P200 Achievement" width={32} height={32} className="object-contain"/>
                          </div>
                        )}
                        {killer.legacy && (
                          <div className="absolute top-1 right-11 w-8 h-8 z-20" title="Legacy Player">
                            <Image src="/legacy.png" alt="Legacy Achievement" width={32} height={32} className="object-contain"/>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                          <h4 className={`font-bold text-lg ${killer.legacy ? 'text-orange-200 drop-shadow-[0_0_6px_rgba(251,146,60,0.8)]' : 'text-white'}`}>
                            {killer.name}
                          </h4>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {playerData.survivors.length > 0 && (
              <div>
                <h3 className="text-2xl md:text-3xl font-mono mb-6 flex items-center gap-3">
                  <Shield className="h-7 w-7 text-blue-400" />
                  P100 Survivors ({playerData.survivors.length})
                </h3>
                <div className="character-grid">
                  {playerData.survivors.map((survivor, index) => (
                    <Link key={survivor.id} href={`/survivors/${survivor.id}`} className="character-card group">
                      <div className="relative w-full h-full">
                        <Image
                          src={survivor.imageUrl}
                          alt={survivor.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          loading={index < 6 ? "eager" : "lazy"}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        {survivor.p200 && (
                          <div className="absolute top-1 right-1 w-8 h-8 z-20" title="P200 Achievement">
                            <Image src="/p200.png" alt="P200 Achievement" width={32} height={32} className="object-contain"/>
                          </div>
                        )}
                        {survivor.legacy && (
                          <div className="absolute top-1 right-11 w-8 h-8 z-20" title="Legacy Player">
                            <Image src="/legacy.png" alt="Legacy Achievement" width={32} height={32} className="object-contain"/>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                          <h4 className={`font-bold text-lg ${survivor.legacy ? 'text-orange-200 drop-shadow-[0_0_6px_rgba(251,146,60,0.8)]' : 'text-white'}`}>
                            {survivor.name}
                          </h4>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {totalP100s === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">😔</div>
                <h3 className="text-2xl font-mono mb-2">No P100s Found</h3>
                <p className="text-gray-400">
                  This player doesn't have any verified P100 entries on record.
                </p>
                <Link href="/search" className="nav-button mt-6">
                  Try another search
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </BackgroundWrapper>
  );
}
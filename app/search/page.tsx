'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import { Search, User, Crown, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

interface PlayerSearchResult {
  username: string;
  p100Count: number;
  lastSubmission: string;
}

interface PlayerP100s {
  username: string;
  killers: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
  survivors: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerP100s | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const supabase = createClient();
  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchPlayers();
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  const searchPlayers = async () => {
    if (!searchTerm.trim()) {
      return;
    }
    
    setIsSearching(true);
    setShowSuggestions(true);
    
    try {
      const { data, error } = await supabase
        .from('p100_players')
        .select('username')
        .ilike('username', `%${searchTerm}%`)
        .order('username');      if (error) {
        console.error('Search error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setSearchResults([]);
        return;
      }      // Group by username and count P100s
      const userCounts = data.reduce((acc: Record<string, number>, player) => {
        acc[player.username] = (acc[player.username] || 0) + 1;
        return acc;      }, {});

      const results = Object.entries(userCounts).map(([username, count]) => ({
        username,
        p100Count: count,
        lastSubmission: new Date().toISOString() // We'll get this from the latest player entry
      }));

      console.log('📋 Processed search results:', results);
      
      const limitedResults = results.slice(0, 10);
      console.log('🎯 Final results (limited to 10):', limitedResults);
      
      setSearchResults(limitedResults);
    } catch (error) {
      console.error('💥 Error searching players:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      setSearchResults([]);
    } finally {
      console.log('🏁 Search completed, setting isSearching to false');
      setIsSearching(false);
    }
  };

  const loadPlayerP100s = async (username: string) => {
    console.log('👤 Loading P100s for player:', username);
    setIsLoadingPlayer(true);
    setShowSuggestions(false);
    
    try {
      console.log('📡 Fetching P100 players for username:', username);
      // Get all players for this username
      const { data: players, error } = await supabase
        .from('p100_players')
        .select('killer_id, survivor_id')
        .eq('username', username);

      if (error) {
        console.error('❌ Error fetching player data:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          username: username
        });
        throw error;
      }

      console.log('✅ Player data received:', players);
      console.log('📊 Number of P100s:', players?.length || 0);

      if (!players || players.length === 0) {
        console.log('📭 No P100s found for player:', username);
        setSelectedPlayer({
          username,
          killers: [],
          survivors: []
        });
        return;
      }

      // Get unique character IDs
      const killerIds = Array.from(new Set(players.filter(p => p.killer_id).map(p => p.killer_id)));
      const survivorIds = Array.from(new Set(players.filter(p => p.survivor_id).map(p => p.survivor_id)));

      console.log('🔪 Unique killer IDs:', killerIds);
      console.log('🛡️ Unique survivor IDs:', survivorIds);

      // Fetch killer and survivor data separately
      console.log('📡 Fetching character data...');
      const [killersResponse, survivorsResponse] = await Promise.all([
        killerIds.length > 0 
          ? supabase.from('killers').select('id, name, image_url').in('id', killerIds)
          : Promise.resolve({ data: [], error: null }),
        survivorIds.length > 0 
          ? supabase.from('survivors').select('id, name, image_url').in('id', survivorIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      console.log('🔪 Killers response:', killersResponse);
      console.log('🛡️ Survivors response:', survivorsResponse);

      if (killersResponse.error) {
        console.error('❌ Error fetching killers:', killersResponse.error);
      }

      if (survivorsResponse.error) {
        console.error('❌ Error fetching survivors:', survivorsResponse.error);
      }

      const killers = (killersResponse.data || []).map(killer => ({
        id: killer.id,
        name: killer.name,
        imageUrl: killer.image_url
      })).sort((a, b) => a.name.localeCompare(b.name));

      const survivors = (survivorsResponse.data || []).map(survivor => ({
        id: survivor.id,
        name: survivor.name,
        imageUrl: survivor.image_url
      })).sort((a, b) => a.name.localeCompare(b.name));

      console.log('🔪 Processed killers:', killers);
      console.log('🛡️ Processed survivors:', survivors);

      const playerData = {
        username,
        killers,
        survivors
      };

      console.log('👤 Final player data:', playerData);
      console.log('📊 Total P100s:', killers.length + survivors.length);

      setSelectedPlayer(playerData);
    } catch (error) {
      console.error('💥 Error loading player P100s:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      console.error('Failed for username:', username);
    } finally {
      console.log('🏁 Player loading completed');
      setIsLoadingPlayer(false);
    }
  };

  const handlePlayerSelect = (username: string) => {
    console.log('🎯 Player selected from suggestions:', username);
    setSearchTerm(username);
    loadPlayerP100s(username);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSearch = searchTerm.trim();
    console.log('🔍 Search form submitted:', trimmedSearch);
    
    if (trimmedSearch) {
      loadPlayerP100s(trimmedSearch);
    } else {
      console.log('❌ Search form submitted with empty term');
    }
  };

  const totalP100s = selectedPlayer ? selectedPlayer.killers.length + selectedPlayer.survivors.length : 0;

  return (
    <BackgroundWrapper>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-mono mb-8 text-center">
            Player Search
          </h1>
          
          <div className="max-w-2xl mx-auto mb-12">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-400 h-5 w-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    console.log('✏️ Search term changed:', e.target.value);
                    setSearchTerm(e.target.value);
                  }}
                  onFocus={() => {
                    console.log('👁️ Search input focused, showing suggestions:', searchResults.length > 0);
                    setShowSuggestions(searchResults.length > 0);
                  }}
                  placeholder="Type the username of the person you are looking for"
                  className="w-full pl-12 pr-4 py-4 text-lg border-2 border-red-600 rounded-lg bg-black/80 text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors backdrop-blur-sm"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                  </div>
                )}
              </div>
              
              {/* Search Suggestions */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-black/95 border-2 border-red-600 rounded-lg shadow-2xl max-h-80 overflow-y-auto backdrop-blur-sm">
                  {searchResults.map((result, index) => (
                    <button
                      key={result.username}
                      type="button"
                      onClick={() => handlePlayerSelect(result.username)}
                      className="w-full p-4 text-left hover:bg-red-900/50 transition-colors flex items-center justify-between border-b border-red-600/20 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-red-400" />
                        <span className="text-lg text-white">{result.username}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {result.p100Count} P100{result.p100Count !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
            
            <div className="text-center mt-4">
              <button
                type="submit"
                onClick={handleSearchSubmit}
                disabled={!searchTerm.trim() || isLoadingPlayer}
                className="nav-button-large disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingPlayer ? 'SEARCHING...' : 'SEARCH'}
              </button>
            </div>
          </div>

          {/* Player Results */}
          {selectedPlayer && (
            <div className="space-y-8">
              <div className="text-center bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
                <h2 className="text-3xl md:text-4xl font-mono mb-4 flex items-center justify-center gap-3">
                  <User className="h-8 w-8 text-red-400" />
                  {selectedPlayer.username}
                </h2>
                <p className="text-xl text-gray-300">
                  {totalP100s} Total P100 Character{totalP100s !== 1 ? 's' : ''}
                </p>
                <div className="flex justify-center gap-8 mt-4">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-red-400" />
                    <span>{selectedPlayer.killers.length} Killer{selectedPlayer.killers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <span>{selectedPlayer.survivors.length} Survivor{selectedPlayer.survivors.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Killers Section */}
              {selectedPlayer.killers.length > 0 && (
                <div>
                  <h3 className="text-2xl md:text-3xl font-mono mb-6 flex items-center gap-3">
                    <Crown className="h-7 w-7 text-red-400" />
                    P100 Killers ({selectedPlayer.killers.length})
                  </h3>                  <div className="character-grid">
                    {selectedPlayer.killers.map((killer, index) => (
                      <Link
                        key={killer.id}
                        href={`/killers/${killer.id}`}
                        className="character-card group"
                      >
                        <div className="relative w-full h-full">
                          <Image
                            src={killer.imageUrl}
                            alt={killer.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                            sizes="(max-width: 640px) 200px, (max-width: 768px) 220px, (max-width: 1024px) 240px, (max-width: 1280px) 260px, 280px"
                            loading={index < 6 ? "eager" : "lazy"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h4 className="text-white font-bold text-lg mb-2">{killer.name}</h4>
                            <div className="flex items-center gap-2">
                              </div>
                            </div>
                          </div>

                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Survivors Section */}
              {selectedPlayer.survivors.length > 0 && (
                <div>
                  <h3 className="text-2xl md:text-3xl font-mono mb-6 flex items-center gap-3">
                    <Shield className="h-7 w-7 text-blue-400" />
                    P100 Survivors ({selectedPlayer.survivors.length})
                  </h3>                  <div className="character-grid">
                    {selectedPlayer.survivors.map((survivor, index) => (
                      <Link
                        key={survivor.id}
                        href={`/survivors/${survivor.id}`}
                        className="character-card group"
                      >
                        <div className="relative w-full h-full">
                          <Image
                            src={survivor.imageUrl}
                            alt={survivor.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                            sizes="(max-width: 640px) 200px, (max-width: 768px) 220px, (max-width: 1024px) 240px, (max-width: 1280px) 260px, 280px"
                            loading={index < 6 ? "eager" : "lazy"}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h4 className="text-white font-bold text-lg mb-2">{survivor.name}</h4>
                            <div className="flex items-center gap-2">
                            </div>
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
                    This player doesn't have any approved P100 submissions yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!selectedPlayer && !isLoadingPlayer && (
            <div className="text-center py-16 space-y-6">
              <div className="text-8xl mb-6">🔍</div>
              <h2 className="text-3xl font-mono mb-4">Start Your Search</h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Enter a username in the search box above to find a player and see all their P100 characters.
                <br />
                <span className="text-base">
                  Try typing names like "Otz", "Ayrun", or any other player you're looking for!
                </span>
              </p>
            </div>
          )}
        </div>
      </main>
    </BackgroundWrapper>
  );
}
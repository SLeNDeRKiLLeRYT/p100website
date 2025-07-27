'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RecentP100 {
  id: string;
  username: string;
  killer_id?: string;
  survivor_id?: string;
  submitted_at: string;
  character?: {
    id: string;
    name: string;
    image_url: string;
    type: 'killer' | 'survivor';
  };
}

// Type alias for a P100 entry that is guaranteed to have character data.
type EnrichedP100 = RecentP100 & { character: NonNullable<RecentP100['character']> };

export default function RecentP100s() {
  const [recentP100s, setRecentP100s] = useState<EnrichedP100[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecentP100s();
  }, []);

  // NOTE: The auto-advancing useEffect hook with setInterval has been removed.

  const fetchRecentP100s = async () => {
    try {
      const supabase = createClient();
      
      const { data: players, error } = await supabase
        .from('p100_players')
        .select('id, username, killer_id, survivor_id, added_at')
        .order('added_at', { ascending: false })
        .limit(7);

      if (error) {
        console.error('Error fetching recent P100s:', error);
        setIsLoading(false);
        return;
      }

      if (!players || players.length === 0) {
        setIsLoading(false);
        return;
      }

      const killerIds = Array.from(new Set(players.map(p => p.killer_id).filter(Boolean)));
      const survivorIds = Array.from(new Set(players.map(p => p.survivor_id).filter(Boolean)));

      const characterPromises = [];
      
      if (killerIds.length > 0) {
        characterPromises.push(
          supabase.from('killers').select('id, name, image_url').in('id', killerIds)
        );
      } else {
        characterPromises.push(Promise.resolve({ data: [], error: null }));
      }
      
      if (survivorIds.length > 0) {
        characterPromises.push(
          supabase.from('survivors').select('id, name, image_url').in('id', survivorIds)
        );
      } else {
        characterPromises.push(Promise.resolve({ data: [], error: null }));
      }

      const [killersResponse, survivorsResponse] = await Promise.all(characterPromises);

      if (killersResponse.error) console.error('Error fetching killers:', killersResponse.error);
      if (survivorsResponse.error) console.error('Error fetching survivors:', survivorsResponse.error);

      const enrichedPlayers = players
        .map((player): RecentP100 => {
          let character: RecentP100['character'] = undefined;
          
          if (player.killer_id) {
            const killer = killersResponse.data?.find(k => k.id === player.killer_id);
            if (killer) character = { ...killer, type: 'killer' as const };
          } else if (player.survivor_id) {
            const survivor = survivorsResponse.data?.find(s => s.id === player.survivor_id);
            if (survivor) character = { ...survivor, type: 'survivor' as const };
          }

          return {
            id: player.id,
            username: player.username,
            submitted_at: player.added_at,
            character
          };
        })
        .filter((player): player is EnrichedP100 => !!player.character);

      setRecentP100s(enrichedPlayers);
    } catch (error) {
      console.error('Error in fetchRecentP100s:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const slideToIndex = (newIndex: number) => {
    setCurrentIndex(newIndex);
  };

  const nextSlide = () => {
    setCurrentIndex((currentIndex + 1) % recentP100s.length);
  };

  const prevSlide = () => {
    setCurrentIndex((currentIndex - 1 + recentP100s.length) % recentP100s.length);
  };

  if (isLoading) {
    return (
      <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
        <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-center">Recent P100s</h3>
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (recentP100s.length === 0) {
    return (
      <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
        <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-center">Recent P100s</h3>
        <div className="text-center py-8">
          <p className="text-gray-400">No recent P100 entries found yet.</p>
          <p className="text-gray-500 text-sm mt-2">Be the first to submit your P100!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm overflow-hidden">
      <h3 className="text-xl md:text-2xl lg:text-3xl mb-6 text-center">Recent P100s</h3>
      
      <div className="relative h-96">
        {/* Carousel Viewport */}
        <div className="relative w-full h-full">
            {recentP100s.map((p100, index) => {
              const totalItems = recentP100s.length;
              let offset = index - currentIndex;

              if (offset > totalItems / 2) {
                offset -= totalItems;
              } else if (offset < -totalItems / 2) {
                offset += totalItems;
              }

              const isActive = offset === 0;
              const isSideItem = Math.abs(offset) === 1 && totalItems > 2;
              
              const style: React.CSSProperties = {
                transform: `translateX(${offset * 40}%) scale(${isActive ? 1 : 0.8})`,
                zIndex: isActive ? 3 : isSideItem ? 2 : 1,
                opacity: isSideItem || isActive ? 1 : 0,
                transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                pointerEvents: isActive ? 'auto' : 'none',
              };

              return (
                <div
                  key={p100.id}
                  className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-start pt-4"
                  style={style}
                >
                  <Link
                    href={`/${p100.character.type}s/${p100.character.id}`}
                    className={`group block transition-transform duration-300 ${isActive ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
                    onClick={(e) => { if (!isActive) e.preventDefault(); }}
                  >
                    <div
                      className={`relative rounded-lg overflow-hidden transition-all duration-300 shadow-xl 
                        ${isActive
                          ? 'w-36 h-48 md:w-44 md:h-60 border-2 border-red-600/50 group-hover:border-red-500'
                          : 'w-30 h-42 md:w-36 md:h-48 border border-red-600/30 blur-sm'
                        }`}
                    >
                      <Image
                        src={p100.character.image_url}
                        alt={p100.character.name}
                        fill
                        className={`object-cover ${isActive && 'transition-transform group-hover:scale-110'}`}
                        sizes="(max-width: 768px) 176px, 176px"
                        priority={isActive}
                      />
                    </div>
                  </Link>

                  <div className={`text-center mt-4 space-y-1 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-sm md:text-base font-mono text-white font-semibold">
                      {p100.username}
                    </p>
                    <p className="text-xs md:text-sm text-gray-300">
                      achieved P100 with <span className="text-red-400 font-semibold">{p100.character.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(p100.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
        
        {/* Navigation */}
        {recentP100s.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 border border-red-600/50 hover:border-red-500 rounded-full transition-all z-10"
              aria-label="Previous P100"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 border border-red-600/50 hover:border-red-500 rounded-full transition-all z-10"
              aria-label="Next P100"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </>
        )}
      </div>

      {/* Dots Indicator */}
      {recentP100s.length > 1 && (
        <div className="flex justify-center space-x-2 mt-2">
          {recentP100s.map((_, index) => (
            <button
              key={index}
              onClick={() => slideToIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-red-500 w-6 shadow-lg' 
                  : 'bg-gray-600 hover:bg-gray-500 w-2'
              }`}
              aria-label={`Go to P100 ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* View All Link */}
      <div className="text-center mt-6">
        <Link 
          href="/search" 
          className="text-sm text-red-400 hover:text-red-300 underline transition-colors"
        >
          Search all P100 players →
        </Link>
      </div>
    </div>
  );
}
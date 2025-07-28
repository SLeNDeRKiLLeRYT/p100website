'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import supabase from '@/lib/supabase-client';
import { Star, Crown, Shield } from 'lucide-react';

// Interface for a single character, including added_at for sorting
interface HighlightCharacter {
  id: string;
  name: string;
  image_url: string;
  added_at: string;
}

// Interface for the data returned by our Supabase function
interface HighlightPlayer {
  username: string;
  p100Count: number;
  killers: HighlightCharacter[] | null; // The function can return null
  survivors: HighlightCharacter[] | null; // The function can return null
}

export default function HighlightOfTheDay() {
  const [highlightPlayer, setHighlightPlayer] = useState<HighlightPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHighlightPlayer = async () => {
      setIsLoading(true);
      try {
        // FIX: Use the imported singleton instance
        const { data, error } = await supabase.rpc('get_highlight_of_the_day');

        if (error) {
          console.error('Error fetching highlight of the day from RPC:', error);
          return;
        }
        
        if (data) {
          setHighlightPlayer({
            ...data,
            killers: data.killers || [],
            survivors: data.survivors || [],
          });
        } else {
          setHighlightPlayer(null);
        }

      } catch (rpcError) {
        console.error('RPC call to get_highlight_of_the_day failed:', rpcError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighlightPlayer();
  }, []);

  // Loading state remains the same
  if (isLoading) {
    return (
      <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
        <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-center flex items-center justify-center gap-2">
          <Star className="w-6 h-6 text-yellow-400" />
          Highlight of the Day
        </h3>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // No eligible player state remains the same
  if (!highlightPlayer) {
    return (
      <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
        <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-center flex items-center justify-center gap-2">
          <Star className="w-6 h-6 text-yellow-400" />
          Highlight of the Day
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-400">No eligible players found for today.</p>
          <p className="text-gray-500 text-sm mt-2">Players need 5+ unique P100s to be featured!</p>
        </div>
      </div>
    );
  }

  // The main component JSX is now simpler and more robust
  return (
    <div className="bg-black/40 border-2 border-red-600/50 rounded-lg p-6 backdrop-blur-sm">
      <h3 className="text-xl md:text-2xl lg:text-3xl mb-6 text-center flex items-center justify-center gap-2">
        <Star className="w-6 h-6 text-yellow-400" />
        Highlight of the Day
      </h3>
      
      <div className="space-y-6">
        {/* Player Header */}
        <div className="text-center bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-lg p-4">
          <h4 className="text-2xl md:text-3xl font-mono text-yellow-300 mb-2">
            {highlightPlayer.username}
          </h4>
          <p className="text-lg text-gray-300">
            Amazing <span className="text-red-400 font-bold">{highlightPlayer.p100Count} P100s</span>!
          </p>
          <div className="flex justify-center gap-6 mt-3">
            {(highlightPlayer.killers ?? []).length > 0 && (
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-red-400" />
                <span className="text-sm">{(highlightPlayer.killers ?? []).length} Killer{(highlightPlayer.killers ?? []).length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {(highlightPlayer.survivors ?? []).length > 0 && (
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-400" />
                <span className="text-sm">{(highlightPlayer.survivors ?? []).length} Survivor{(highlightPlayer.survivors ?? []).length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Character Showcase - Top 6 most recent */}
        <div className="space-y-4">
          <h5 className="text-center text-lg text-gray-300">Featured Characters (Most Recent):</h5>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[...(highlightPlayer.killers ?? []), ...(highlightPlayer.survivors ?? [])]
              // Note: The SQL function needs to provide `added_at` for this to work.
              // I'll provide an updated SQL function below that includes it.
              .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
              .slice(0, 6)
              .map((character) => {
                const isKiller = (highlightPlayer.killers ?? []).some(k => k.id === character.id);
                return (
                  <Link
                    key={character.id}
                    href={`/${isKiller ? 'killers' : 'survivors'}/${character.id}`}
                    className="group relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-transparent hover:border-yellow-500 transition-all"
                  >
                    <Image
                      src={character.image_url}
                      alt={character.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-110"
                      sizes="(max-width: 768px) 80px, 100px"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-semibold truncate">{character.name}</p>
                    </div>
                  </Link>
                );
              })}
          </div>
          
          {highlightPlayer.p100Count > 6 && (
            <p className="text-center text-sm text-gray-400">
              +{highlightPlayer.p100Count - 6} more P100 characters!
            </p>
          )}
        </div>

        {/* Call to Action */}
        <div className="text-center pt-4 border-t border-yellow-600/30">
          <Link 
            href={`/profile/${encodeURIComponent(highlightPlayer.username)}`}
            className="inline-block bg-yellow-600 hover:bg-yellow-700 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            View Full Profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
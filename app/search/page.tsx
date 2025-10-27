'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import { Search, User } from 'lucide-react';
import supabase from '@/lib/supabase-client';

interface Suggestion {
  username: string;
  p100Count: number;
}

export default function SearchPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .rpc('search_players', { search_term: term });
        if (error) {
          throw error;
        }
        setSuggestions(data || []);
        setShowSuggestions(data && data.length > 0);
      } catch (error) {
        console.error("Failed to fetch suggestions via RPC:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);


  const handleSearch = (username: string) => {
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      router.push(`/profile/${encodeURIComponent(trimmedUsername)}`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  return (
    // FIX: The entire page content is now wrapped by BackgroundWrapper
    <BackgroundWrapper>
      {/* FIX: The Navigation is now a child of BackgroundWrapper, so it appears on top of the background */}
      <div className="container mx-auto px-4 pt-8">
        <Navigation />
      </div>
      
      <main className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-mono mb-8 text-center">
            Player Search
          </h1>
          <div className="max-w-2xl mx-auto mb-12">
            <form onSubmit={handleFormSubmit} className="relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-400 h-5 w-5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Type a player's username..."
                  className="w-full pl-12 pr-12 py-4 text-lg border-2 border-red-600 rounded-lg bg-black/80 text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors backdrop-blur-sm"
                  autoComplete="off"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                  </div>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-black/95 border-2 border-red-600 rounded-lg shadow-2xl max-h-80 overflow-y-auto backdrop-blur-sm">
                  {suggestions.map((result) => (
                    <button
                      key={result.username}
                      type="button"
                      onMouseDown={() => handleSearch(result.username)}
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
                onClick={handleFormSubmit}
                disabled={!searchTerm.trim()}
                className="nav-button-large disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SEARCH
              </button>
            </div>

            {/* Link to check submission status */}
            <div className="text-center mt-6">
              <Link href="/submission/status" className="text-red-400 hover:text-red-300 font-bold underline">
                Already submitted? Check your submission status
              </Link>
            </div>
          </div>
          <div className="text-center py-16 space-y-6">
            <div className="text-8xl mb-6">🔍</div>
            <h2 className="text-3xl font-mono mb-4">Find a Player</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Enter a username in the search box above to find a player and see all their P100 characters.
            </p>
          </div>
        </div>
      </main>
    </BackgroundWrapper>
  );
}
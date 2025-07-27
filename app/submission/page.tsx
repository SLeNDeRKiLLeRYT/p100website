'use client';

import { useState, useEffect, useRef } from 'react'; // --- 1. IMPORT useRef ---
import { createClient, sanitizeInput, validateInput } from '@/lib/supabase-client';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import Image from 'next/image';
import Link from 'next/link';
import { FaDiscord } from 'react-icons/fa';
import { User } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

// Interfaces
interface Character { id: string; name: string; imageUrl: string; }
interface Suggestion { username: string; p100Count: number; }
interface CustomDropdownProps { characters: Character[]; value: string; onChange: (value: string) => void; placeholder: string; }

// Custom Dropdown Component (Unchanged)
function CustomDropdown({ characters, value, onChange, placeholder }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCharacter = characters.find(char => char.id === value);
  return (
    <div className="relative min-w-[300px]"><button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full p-4 border border-red-600 rounded-lg bg-black hover:bg-red-900 text-white focus:border-red-400 focus:outline-none transition-colors text-left flex items-center justify-between"><div className="flex items-center gap-4">{selectedCharacter ? (<><div className="relative w-[96px] h-[120px] rounded overflow-hidden flex-shrink-0"><Image src={selectedCharacter.imageUrl} alt={selectedCharacter.name} fill className="object-cover" sizes="96px" priority /></div><span className="text-lg">{selectedCharacter.name}</span></>) : (<span className="text-gray-400 text-lg">{placeholder}</span>)}</div><svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>{isOpen && (<div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">{characters.map((character) => (<button key={character.id} type="button" onClick={() => {onChange(character.id); setIsOpen(false);}} className="w-full p-3 text-left hover:bg-red-900 transition-colors flex items-center gap-3 first:rounded-t-lg last:rounded-b-lg border-b border-red-600/20 last:border-b-0"><div className="relative w-[48px] h-[60px] rounded overflow-hidden flex-shrink-0"><Image src={character.imageUrl} alt={character.name} fill className="object-cover" sizes="48px" loading="lazy" /></div><span className="text-base text-white">{character.name}</span></button>))}</div>)}</div>
  );
}

export default function SubmissionPage() {
  const [formData, setFormData] = useState({
    username: '',
    characterType: 'killer' as 'killer' | 'survivor',
    characterId: '',
    screenshot: null as File | null,
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const selectionMade = useRef(false); // --- 1. ADD THE REF ---
  
  const supabase = createClient();

  // --- 2. UPDATE useEffect TO BE THE SOURCE OF TRUTH ---
  useEffect(() => {
    // If the last change was a programmatic selection, do nothing.
    if (selectionMade.current) {
      selectionMade.current = false;
      return;
    }

    const term = formData.username.trim();

    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false); // Hide suggestions for short terms
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(async () => {
      let finalSuggestions: Suggestion[] = [];
      try {
        const { data, error } = await supabase
          .from('p100_players')
          .select('username')
          .ilike('username', `%${term}%`)
          .order('username');

        if (error) throw error;
        
        if (data && data.length > 0) {
          const userCounts = data.reduce((acc: Record<string, number>, player) => {
            acc[player.username] = (acc[player.username] || 0) + 1;
            return acc;
          }, {});

          const results: Suggestion[] = Object.entries(userCounts).map(([username, count]) => ({
            username,
            p100Count: count,
          }));
          
          finalSuggestions = results.slice(0, 10);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        finalSuggestions = []; 
      } finally {
        setSuggestions(finalSuggestions);
        setShowSuggestions(finalSuggestions.length > 0); // Control visibility here
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.username, supabase]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.characterId || !formData.screenshot) {
      setMessage('Please fill in all fields');
      return;
    }
    const sanitizedUsername = sanitizeInput(formData.username);
    if (!validateInput.username(sanitizedUsername)) {
      setMessage('Username must be 1-50 characters');
      return;
    }
    if (!validateInput.characterId(formData.characterId, formData.characterType)) {
      setMessage('Invalid character selection');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!formData.screenshot || !allowedTypes.includes(formData.screenshot.type)) {
      setMessage('Only JPEG, PNG, and WebP images are allowed');
      return;
    }
    if (formData.screenshot.size > 10 * 1024 * 1024) {
      setMessage('File size must be less than 10MB');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      const fileExt = formData.screenshot.name.split('.').pop()?.toLowerCase();
      if (!fileExt) throw new Error('Invalid file type');
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('screenshots').upload(fileName, formData.screenshot);
      if (uploadError) throw new Error('Failed to upload screenshot: ' + uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(fileName);
      
      const submissionData = {
        username: sanitizedUsername,
        screenshot_url: publicUrl,
        killer_id: formData.characterType === 'killer' ? formData.characterId : null,
        survivor_id: formData.characterType === 'survivor' ? formData.characterId : null,
        status: 'pending' as const,
        comment: sanitizeInput(formData.comment),
      };

      const { error: submitError } = await supabase.from('p100_submissions').insert([submissionData]);
      if (submitError) throw new Error('Failed to submit P100: ' + submitError.message);
      
      setMessage('P100 submission successful! It will be reviewed by an admin.');
      
      setFormData({ username: '', characterType: 'killer', characterId: '', screenshot: null, comment: ''});

      const fileInput = document.getElementById('screenshot') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Submission error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Something went wrong'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [killers, setKillers] = useState<Character[]>([]);
  const [survivors, setSurvivors] = useState<Character[]>([]);
  
  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const supabase = createClient();
        const [killersResponse, survivorsResponse] = await Promise.all([
          supabase.from('killers').select('id, name, image_url').order('order', { ascending: true}),
          supabase.from('survivors').select('id, name, image_url').order('order_num', { ascending: true})
        ]);
        if (killersResponse.data) {
          const formattedKillers = killersResponse.data.map(killer => ({ id: killer.id, name: killer.name, imageUrl: killer.image_url }));
          setKillers(formattedKillers);
        }
        if (survivorsResponse.data) {
          const formattedSurvivors = survivorsResponse.data.map(survivor => ({ id: survivor.id, name: survivor.name, imageUrl: survivor.image_url }));
          setSurvivors(formattedSurvivors);
        }
      } catch (error) {
        console.error('Error fetching characters:', error);
      }
    };
    fetchCharacters();
  }, []);

  const characters = formData.characterType === 'killer' ? killers : survivors;
  
  return (
    <BackgroundWrapper backgroundUrl="/p100submissions.png">
      <div className="container mx-auto px-4 py-8">
        <Navigation />
        <main className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-mono mb-8 text-center">Submit Your P100</h1>
          {/* ... unchanged JSX for discord and rules ... */}
          <div className="mb-8 bg-discord/20 border border-discord rounded-lg p-6 text-center"><div className="flex items-center justify-center gap-4 mb-4"><FaDiscord size={32} className="text-discord" /><span className="text-2xl font-mono text-discord">Join Our Discord Community!</span><FaDiscord size={32} className="text-discord" /></div><p className="text-lg mb-4">Join our community for faster support, discussions, and updates about the website.</p><Link href="https://discord.gg/GFPuzehJZs" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 bg-discord hover:bg-discord/80 text-white font-mono rounded-lg transition-colors"><FaDiscord size={20} />Join Discord Server</Link></div>
          <div className="mb-12 bg-black/60 border border-gray-600 rounded-lg p-8"><h2 className="text-2xl font-mono mb-6 text-red-400">READ BEFORE SUBMITTING:</h2><div className="space-y-6 text-gray-100"><p className="text-lg">So, You made it all the way here. Welcome.</p><p>As long as this website is online, I am taking submissions if you want to add your name to any list, if you have a P100. I accept them ONLY through this form or Discord, but before you submit, please note I need your submission to meet some requirements:</p><div className="bg-red-900/30 border border-red-500 rounded-lg p-6"><h3 className="text-xl font-mono mb-4 text-red-300">Requirements:</h3><ul className="space-y-3 list-disc list-inside"><li>If you are submitting for someone else, you are going to need proof (screenshots) of this person agreeing to be added to the list;</li><li>Your screenshot must be taken in the current lobby when you are submitting. <strong className="text-red-300">Old screenshots are no longer accepted</strong>;</li><li>The screenshot must clearly show your P100 character and username;</li><li>Please check if you are not already on the list you are submitting for! You can use the <Link href="/search" className="text-red-300 underline hover:text-red-400">search page</Link> to find your name quickly.</li></ul></div><div className="bg-blue-900/30 border border-blue-500 rounded-lg p-6"><h3 className="text-xl font-mono mb-4 text-blue-300">Example of a Good Screenshot:</h3><p className="mb-4 text-blue-200">This is what I expect to see in your screenshot submissions:</p><div className="flex justify-center"><div className="relative max-w-2xl w-full"><Image src="/example.png" alt="Example of a proper P100 screenshot" width={800} height={450} className="rounded-lg border border-blue-400" priority /></div></div></div><div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6"><h3 className="text-xl font-mono mb-4 text-yellow-300">Exception to the "Old Screenshots" Rule:</h3><p>There is one exception to the "old screenshots" rule: it is IF, and only IF, it is a screenshot of when you got your P100. Please note that when submitting multiple P100s, if you changed your username, you will be asked to take new screenshots in the current lobby.</p></div><div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6"><h3 className="text-xl font-mono mb-4 text-yellow-300">Example of Exception Screenshot:</h3><p className="mb-4 text-yellow-200">This type of screenshot is acceptable as an exception (P100 achievement moment):</p><div className="flex justify-center"><div className="relative max-w-2xl w-full"><Image src="/exception.png" alt="Example of acceptable exception screenshot" width={800} height={450} className="rounded-lg border border-yellow-400" priority /></div></div></div><div className="bg-green-900/30 border border-green-500 rounded-lg p-6"><p className="text-green-300 font-semibold">If, and ONLY IF, your screenshot respects every requirement, you will be added to the requested list.</p></div></div></div>
          
          <div className="bg-black/70 border border-gray-600 rounded-lg p-8">
            <h2 className="text-2xl font-mono mb-6 text-center">Submission Form</h2>
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-8">
              <div className="space-y-2 relative">
                <label htmlFor="username" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Username *</label>
                <div className="relative">
                  <input
                    type="text"
                    id="username"
                    value={formData.username}
                    // --- 4. SIMPLIFY onChange ---
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="w-full p-4 border border-red-600 rounded-lg bg-black text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors pr-12"
                    placeholder="Enter your username"
                    autoComplete="off"
                    required
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div>
                    </div>
                  )}
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                    {suggestions.map((result) => (
                      <button
                        key={result.username}
                        type="button"
                        // --- 3. UPDATE onMouseDown ---
                        onMouseDown={() => {
                          selectionMade.current = true; // Flag the selection
                          setFormData(prev => ({ ...prev, username: result.username }));
                          setShowSuggestions(false); // Hide immediately
                        }}
                        className="w-full p-4 text-left hover:bg-red-900 transition-colors flex items-center justify-between border-b border-red-600/20 last:border-b-0"
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
              </div>
              {/* ... rest of the form is unchanged ... */}
              <div className="space-y-4"><label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Character Type *</label><div className="flex gap-6"><label className="flex items-center cursor-pointer"><input type="radio" value="killer" checked={formData.characterType === 'killer'} onChange={(e) => setFormData({ ...formData, characterType: e.target.value as 'killer', characterId: '' })} className="mr-3 w-4 h-4 accent-red-500" /> <span className="text-lg">Killer</span></label><label className="flex items-center cursor-pointer"><input type="radio" value="survivor" checked={formData.characterType === 'survivor'} onChange={(e) => setFormData({ ...formData, characterType: e.target.value as 'survivor', characterId: '' })} className="mr-3 w-4 h-4 accent-red-500" /> <span className="text-lg">Survivor</span></label></div></div>
              <div className="space-y-2"><label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Character *</label><CustomDropdown characters={characters} value={formData.characterId} onChange={(value) => setFormData({ ...formData, characterId: value })} placeholder="Select a character" /></div>
              <div className="space-y-2"><label htmlFor="screenshot" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Screenshot *</label><input type="file" id="screenshot" accept="image/*" onChange={(e) => setFormData({ ...formData, screenshot: e.target.files?.[0] || null })} className="w-full p-4 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white file:cursor-pointer hover:file:bg-red-700 focus:border-red-400 focus:outline-none transition-colors" required /><p className="text-sm text-gray-400 mt-2">Upload a screenshot showing your P100 character in the current lobby</p></div>
              <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Comment (Optional)</label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  className="w-full p-4 border border-red-600 rounded-lg bg-black text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors min-h-[100px]"
                  placeholder="Leave a message for the admin..."
                  rows={3}
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 px-6 bg-black border border-red-600 hover:bg-red-900 hover:border-red-400 disabled:bg-gray-800 disabled:border-gray-600 disabled:cursor-not-allowed text-white font-mono uppercase tracking-wider rounded-lg transition-all text-lg">{isSubmitting ? 'Submitting...' : 'Submit P100'}</button>
            </form>
            {message && (<div className={`mt-6 p-4 rounded-lg max-w-lg mx-auto ${message.includes('Error') ? 'bg-red-900/50 border border-red-500 text-red-200' : 'bg-green-900/50 border border-green-500 text-green-200'}`}>{message}</div>)}
          </div>
        </main>
      </div>
    </BackgroundWrapper>
  );
}
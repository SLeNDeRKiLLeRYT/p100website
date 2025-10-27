'use client';

import { useState, useEffect, useRef } from 'react';
import supabase, { sanitizeInput, validateInput } from '@/lib/supabase-client';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import Image from 'next/image';
import Link from 'next/link';
import { FaDiscord } from 'react-icons/fa';
import { User } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import DOMPurify from 'dompurify';

// Safe sanitization for comments - allows emojis, symbols, but prevents XSS
const sanitizeComment = (comment: string): string => {
  if (typeof window !== 'undefined' && comment) {
    return DOMPurify.sanitize(comment, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
      KEEP_CONTENT: true, // Keep text content including emojis and special characters
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
    });
  }
  // Server-side fallback - keep most characters, just remove dangerous patterns
  if (!comment) return '';
  return comment
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*['"]/gi, '')
    .trim();
};

// Interfaces
interface Character {
  id: string;
  name: string;
  imageUrl: string;
}
interface Suggestion {
  username: string;
  p100Count: number;
}
interface CustomDropdownProps {
  characters: Character[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

// Custom Dropdown Component
function CustomDropdown({ characters, value, onChange, placeholder }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCharacter = characters.find(char => char.id === value);

  return (
    <div className="relative min-w-[300px]">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full p-4 border border-red-600 rounded-lg bg-black hover:bg-red-900 text-white focus:border-red-400 focus:outline-none transition-colors text-left flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedCharacter ? (
            <>
              <div className="relative w-[96px] h-[120px] rounded overflow-hidden flex-shrink-0">
                <Image src={selectedCharacter.imageUrl} alt={selectedCharacter.name} fill className="object-cover" sizes="96px" priority />
              </div>
              <span className="text-lg">{selectedCharacter.name}</span>
            </>
          ) : (
            <span className="text-gray-400 text-lg">{placeholder}</span>
          )}
        </div>
        <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
          {characters.map((character) => (
            <button key={character.id} type="button" onClick={() => { onChange(character.id); setIsOpen(false); }} className="w-full p-3 text-left hover:bg-red-900 transition-colors flex items-center gap-3 first:rounded-t-lg last:rounded-b-lg border-b border-red-600/20 last:border-b-0">
              <div className="relative w-[48px] h-[60px] rounded overflow-hidden flex-shrink-0">
                <Image src={character.imageUrl} alt={character.name} fill className="object-cover" sizes="48px" loading="lazy" />
              </div>
              <span className="text-base text-white">{character.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
  const selectionMade = useRef(false);
  const [killers, setKillers] = useState<Character[]>([]);
  const [survivors, setSurvivors] = useState<Character[]>([]);

  useEffect(() => {
    if (selectionMade.current) {
      selectionMade.current = false;
      return;
    }
    const term = formData.username.trim();
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
            username, p100Count: count,
          }));
          setSuggestions(results.slice(0, 10));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.username]);
  
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
    if (formData.screenshot.size > 20 * 1024 * 1024) {
      setMessage('File size must be less than 20MB');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      // Step 1: Determine character identifiers for lookup
      const targetKillerId = formData.characterType === 'killer' ? formData.characterId : null;
      const targetSurvivorId = formData.characterType === 'survivor' ? formData.characterId : null;

      // Step 2: Check for existing pending OR approved submissions for this character.
      // We exclude legacy=true in case legacy rows shouldn't block (adjust if legacy should block by removing filter).
      // NOTE: This is a client-side safeguard; for true integrity add a DB unique partial index (see comments below).
      let duplicateQuery = supabase
        .from('p100_submissions')
        .select('id, status, killer_id, survivor_id, username, legacy')
        .in('status', ['pending', 'approved'])
        .eq('legacy', false)
        .eq('username', sanitizedUsername);

      if (targetKillerId) {
        duplicateQuery = duplicateQuery.eq('killer_id', targetKillerId);
      } else if (targetSurvivorId) {
        duplicateQuery = duplicateQuery.eq('survivor_id', targetSurvivorId);
      }

      const { data: dupData, error: dupError } = await duplicateQuery.limit(1);
      if (dupError) {
        console.warn('Duplicate check failed (continuing to allow submission):', dupError.message);
      }

      if (dupData && dupData.length > 0) {
        const blockingRecords = dupData.map((entry) => ({
          id: entry.id,
          status: entry.status,
          killer_id: entry.killer_id,
          survivor_id: entry.survivor_id,
          username: entry.username,
          legacy: entry.legacy,
        }));

        console.groupCollapsed('[P100 Submission] Denied duplicate attempt');
        console.info('Attempted submission:', {
          username: sanitizedUsername,
          characterType: formData.characterType,
          characterId: formData.characterId,
        });
        console.info('Blocking database records (status ∈ pending/approved, legacy=false):');
        console.table(blockingRecords);
        console.groupEnd();

        // Auto-reject user attempt to prevent spam/doubles.
        const autoRejectReason = 'A submission for this character already exists and is pending or approved.';
        const submissionData = {
          username: sanitizedUsername,
          screenshot_url: null as string | null, // we will skip upload to save storage since it's auto-rejected
          killer_id: targetKillerId,
            survivor_id: targetSurvivorId,
          status: 'rejected' as const,
          rejection_reason: autoRejectReason,
          comment: sanitizeComment(formData.comment),
        };

        // (Optional) Insert record to keep an audit trail of attempted duplicate submissions.
        const { error: autoRejectError } = await supabase.from('p100_submissions').insert([submissionData]);
        if (autoRejectError) {
          console.error('Failed to record auto-rejected duplicate attempt:', autoRejectError.message);
        }

        setMessage('Denied: ' + autoRejectReason);
        setIsSubmitting(false);
        return;
      }

      // Step 3: Proceed with normal upload & insertion when not duplicate.
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
        comment: sanitizeComment(formData.comment),
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

  /**
   * NOTE ON DUPLICATE ENFORCEMENT (Race Condition Warning):
   * Two users could theoretically submit for the same character at the same time and pass the client-side check.
   * To harden this, add a partial unique index at the DB layer (ONLY one non-legacy pending/approved per character):
   *
   * -- For killers
   * CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_killer_submission ON public.p100_submissions (killer_id)
   * WHERE killer_id IS NOT NULL AND legacy = false AND status IN ('pending','approved');
   *
   * -- For survivors
   * CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_survivor_submission ON public.p100_submissions (survivor_id)
   * WHERE survivor_id IS NOT NULL AND legacy = false AND status IN ('pending','approved');
   *
   * If you later allow multiple submissions, drop or adjust these indexes.
   */
  
  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const [killersResponse, survivorsResponse] = await Promise.all([
          supabase.from('killers').select('id, name, image_url').order('order', { ascending: true}),
          supabase.from('survivors').select('id, name, image_url').order('order_num', { ascending: true})
        ]);
        if (killersResponse.data) {
          setKillers(killersResponse.data.map(k => ({ id: k.id, name: k.name, imageUrl: k.image_url })));
        }
        if (survivorsResponse.data) {
          setSurvivors(survivorsResponse.data.map(s => ({ id: s.id, name: s.name, imageUrl: s.image_url })));
        }
      } catch (error) {
        console.error('Error fetching characters:', error);
      }
    };
    fetchCharacters();
  }, []);

  const characters = formData.characterType === 'killer' ? killers : survivors;
  
  return (
    // FIX: The entire page content is now wrapped by BackgroundWrapper.
    // The unnecessary outer React Fragment has been removed.
    <BackgroundWrapper>
      {/* 
        FIX: The Navigation component is now a child of BackgroundWrapper,
        ensuring it renders on top of the background image.
      */}
      <div className="container mx-auto px-4 pt-8">
        <Navigation />
      </div>

      <main className="container mx-auto px-4 pb-8 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white tracking-wider uppercase">Submit Your P100</h1>
          <p className="text-red-400 mt-2 text-lg">
            Provide your details to be featured on the site. All submissions are manually reviewed.
          </p>
          <p className="mt-4">
            <Link href="/submission/status" className="text-red-400 hover:text-red-300 font-bold underline">
              Already submitted? Check your submission status here.
            </Link>
          </p>
        </div>

        <div className="mb-8 bg-discord/20 border border-discord rounded-lg p-6 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
                <FaDiscord size={32} className="text-discord" />
                <span className="text-2xl font-mono text-discord">Join Our Discord Community!</span>
                <FaDiscord size={32} className="text-discord" />
            </div>
            <p className="text-lg mb-4">Join our community for faster support, discussions, and updates about the website.</p>
            <Link href="https://discord.gg/GFPuzehJZs" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 bg-discord hover:bg-discord/80 text-white font-mono rounded-lg transition-colors">
                <FaDiscord size={20} />
                Join Discord Server
            </Link>
        </div>
        
        <div className="mb-12 bg-black/60 border border-gray-600 rounded-lg p-8">
            <h2 className="text-2xl font-mono mb-6 text-red-400">READ BEFORE SUBMITTING:</h2>
            <div className="space-y-6 text-gray-100">
                <p className="text-lg">So, You made it all the way here. Welcome.</p>
                <p>As long as this website is online, I am taking submissions if you want to add your name to any list, if you have a P100. I accept them ONLY through this form or Discord, but before you submit, please note I need your submission to meet some requirements:</p>
                <div className="bg-red-900/30 border border-red-500 rounded-lg p-6">
                    <h3 className="text-xl font-mono mb-4 text-red-300">Requirements:</h3>
                    <ul className="space-y-3 list-disc list-inside">
                        <li>If you are submitting for someone else, you are going to need proof (screenshots) of this person agreeing to be added to the list;</li>
                        <li>Your screenshot must be taken in the current lobby when you are submitting. <strong className="text-red-300">Old screenshots are no longer accepted</strong>;</li>
                        <li>The screenshot must clearly show your P100 character and username;</li>
                        <li>Please check if you are not already on the list you are submitting for! You can use the <Link href="/search" className="text-red-300 underline hover:text-red-400">search page</Link> to find your name quickly.</li>
                    </ul>
                </div>
                <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-6">
                    <h3 className="text-xl font-mono mb-4 text-blue-300">Example of a Good Screenshot:</h3>
                    <p className="mb-4 text-blue-200">This is what I expect to see in your screenshot submissions:</p>
                    <div className="flex justify-center">
                        <div className="relative max-w-2xl w-full">
                            <Image src="/example.png" alt="Example of a proper P100 screenshot" width={800} height={450} className="rounded-lg border border-blue-400" priority />
                        </div>
                    </div>
                </div>
                <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6">
                    <h3 className="text-xl font-mono mb-4 text-yellow-300">Exception to the "Old Screenshots" Rule:</h3>
                    <p>There is one exception to the "old screenshots" rule: it is IF, and only IF, it is a screenshot of when you got your P100. Please note that when submitting multiple P100s, if you changed your username, you will be asked to take new screenshots in the current lobby.</p>
                </div>
                <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6">
                    <h3 className="text-xl font-mono mb-4 text-yellow-300">Example of Exception Screenshot:</h3>
                    <p className="mb-4 text-yellow-200">This type of screenshot is acceptable as an exception (P100 achievement moment):</p>
                    <div className="flex justify-center">
                        <div className="relative max-w-2xl w-full">
                            <Image src="/exception.png" alt="Example of acceptable exception screenshot" width={800} height={450} className="rounded-lg border border-yellow-400" priority />
                        </div>
                    </div>
                </div>
                <div className="bg-green-900/30 border border-green-500 rounded-lg p-6">
                    <p className="text-green-300 font-semibold">If, and ONLY IF, your screenshot respects every requirement, you will be added to the requested list.</p>
                </div>
            </div>
        </div>
        
        <div className="bg-black/70 border border-gray-600 rounded-lg p-8">
          <h2 className="text-2xl font-mono mb-6 text-center">Submission Form</h2>
          <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-8">
            <div className="space-y-2 relative">
              <label htmlFor="username" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Username *</label>
              <div className="relative">
                <input type="text" id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} className="w-full p-4 border border-red-600 rounded-lg bg-black text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors pr-12" placeholder="Enter your username" autoComplete="off" required />
                {isSearching && (<div className="absolute right-4 top-1/2 transform -translate-y-1/2"><div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent"></div></div>)}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                  {suggestions.map((result) => (
                    <button key={result.username} type="button" onMouseDown={() => { selectionMade.current = true; setFormData(prev => ({ ...prev, username: result.username })); setShowSuggestions(false); }} className="w-full p-4 text-left hover:bg-red-900 transition-colors flex items-center justify-between border-b border-red-600/20 last:border-b-0">
                      <div className="flex items-center gap-3"><User className="h-5 w-5 text-red-400" /><span className="text-lg text-white">{result.username}</span></div>
                      <div className="text-sm text-gray-400">{result.p100Count} P100{result.p100Count !== 1 ? 's' : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
                <label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Character Type *</label>
                <div className="flex gap-6">
                    <label className="flex items-center cursor-pointer">
                        <input type="radio" value="killer" checked={formData.characterType === 'killer'} onChange={(e) => setFormData({ ...formData, characterType: e.target.value as 'killer', characterId: '' })} className="mr-3 w-4 h-4 accent-red-500" /> 
                        <span className="text-lg">Killer</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input type="radio" value="survivor" checked={formData.characterType === 'survivor'} onChange={(e) => setFormData({ ...formData, characterType: e.target.value as 'survivor', characterId: '' })} className="mr-3 w-4 h-4 accent-red-500" /> 
                        <span className="text-lg">Survivor</span>
                    </label>
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Character *</label>
                <CustomDropdown characters={characters} value={formData.characterId} onChange={(value) => setFormData({ ...formData, characterId: value })} placeholder="Select a character" />
            </div>
            <div className="space-y-2">
                <label htmlFor="screenshot" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Screenshot *</label>
                <input type="file" id="screenshot" accept="image/*" onChange={(e) => setFormData({ ...formData, screenshot: e.target.files?.[0] || null })} className="w-full p-4 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white file:cursor-pointer hover:file:bg-red-700 focus:border-red-400 focus:outline-none transition-colors" required />
                <p className="text-sm text-gray-400 mt-2">Upload a screenshot showing your P100 character in the current lobby</p>
            </div>
            <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">Comment (Optional)</label>
                <Textarea id="comment" value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} className="w-full p-4 border border-red-600 rounded-lg bg-black text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors min-h-[100px]" placeholder="Leave a message for the admin..." rows={3}/>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-4 px-6 bg-black border border-red-600 hover:bg-red-900 hover:border-red-400 disabled:bg-gray-800 disabled:border-gray-600 disabled:cursor-not-allowed text-white font-mono uppercase tracking-wider rounded-lg transition-all text-lg">
                {isSubmitting ? 'Submitting...' : 'Submit P100'}
            </button>
          </form>
          {message && (
            <div
              className={`mt-6 p-4 rounded-lg max-w-lg mx-auto font-mono text-sm tracking-wide
                ${message.startsWith('Denied:')
                  ? 'bg-red-900/70 border border-red-600 text-red-200'
                  : message.includes('Error')
                    ? 'bg-red-900/50 border border-red-500 text-red-200'
                    : 'bg-green-900/50 border border-green-500 text-green-200'}
              `}
              role={message.startsWith('Denied:') || message.includes('Error') ? 'alert' : undefined}
            >
              {message}
            </div>
          )}
        </div>
      </main>
    </BackgroundWrapper>
  );
}
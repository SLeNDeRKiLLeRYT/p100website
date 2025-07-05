'use client';

import { useState, useEffect } from 'react';
import { createClient, sanitizeInput, validateInput } from '@/lib/supabase-client';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import Image from 'next/image';

interface Character {
  id: string;
  name: string;
  imageUrl: string;
}

// Custom Dropdown Component with Images
interface CustomDropdownProps {
  characters: Character[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function CustomDropdown({ characters, value, onChange, placeholder }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCharacter = characters.find(char => char.id === value);

  return (
    <div className="relative min-w-[300px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 border border-red-600 rounded-lg bg-black hover:bg-red-900 text-white focus:border-red-400 focus:outline-none transition-colors text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          {selectedCharacter ? (
            <>
              <div className="relative w-[96px] h-[120px] rounded overflow-hidden flex-shrink-0">
                <Image
                  src={selectedCharacter.imageUrl}
                  alt={selectedCharacter.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
                />
              </div>
              <span className="text-lg">{selectedCharacter.name}</span>
            </>
          ) : (
            <span className="text-gray-400 text-lg">{placeholder}</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-black border border-red-600 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => {
                onChange(character.id);
                setIsOpen(false);
              }}
              className="w-full p-3 text-left hover:bg-red-900 transition-colors flex items-center gap-3 first:rounded-t-lg last:rounded-b-lg border-b border-red-600/20 last:border-b-0"
            >
              <div className="relative w-[48px] h-[60px] rounded overflow-hidden flex-shrink-0">
                <Image
                  src={character.imageUrl}
                  alt={character.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                  loading="lazy"
                />
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
    screenshot: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.characterId || !formData.screenshot) {
      setMessage('Please fill in all fields');
      return;
    }

    // Validate inputs on client side
    const sanitizedUsername = sanitizeInput(formData.username);
    
    if (!validateInput.username(sanitizedUsername)) {
      setMessage('Username must be 1-50 characters and contain only letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    if (!validateInput.characterId(formData.characterId, formData.characterType)) {
      setMessage('Invalid character selection');
      return;
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(formData.screenshot.type)) {
      setMessage('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    if (formData.screenshot.size > 10 * 1024 * 1024) { // 10MB limit
      setMessage('File size must be less than 10MB');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const supabase = createClient();
      
      // Upload screenshot to Supabase Storage
      const fileExt = formData.screenshot.name.split('.').pop()?.toLowerCase();
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      if (!fileExt || !allowedExts.includes(fileExt)) {
        throw new Error('Invalid file extension');
      }
      
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, formData.screenshot);

      if (uploadError) {
        throw new Error('Failed to upload screenshot');
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      // Create submission record with validated data
      const submissionData = {
        username: sanitizedUsername,
        screenshot_url: publicUrl,
        killer_id: formData.characterType === 'killer' ? formData.characterId : null,
        survivor_id: formData.characterType === 'survivor' ? formData.characterId : null,
        status: 'pending' as const
      };

      // Use parameterized query - Supabase handles this automatically
      const { error: submitError } = await supabase
        .from('p100_submissions')
        .insert([submissionData]);

      if (submitError) {
        throw new Error('Failed to submit P100: ' + submitError.message);
      }

      setMessage('P100 submission successful! It will be reviewed by an admin.');
      setFormData({
        username: '',
        characterType: 'killer',
        characterId: '',
        screenshot: null
      });
      
      // Reset file input
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
        
        // Use parameterized queries with proper ordering, but only select essential fields
        const [killersResponse, survivorsResponse] = await Promise.all([
          supabase
            .from('killers')
            .select('id, name, image_url')
            .order('order', { ascending: true}),
          supabase
            .from('survivors')
            .select('id, name, image_url')
            .order('order_num', { ascending: true})
        ]);

        if (killersResponse.data) {
          setKillers(killersResponse.data.map(killer => ({
            id: killer.id,
            name: killer.name,
            imageUrl: killer.image_url
          })));
        }

        if (survivorsResponse.data) {
          setSurvivors(survivorsResponse.data.map(survivor => ({
            id: survivor.id,
            name: survivor.name,
            imageUrl: survivor.image_url
          })));
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
          
          {/* Requirements Section */}
          <div className="mb-12 bg-black/60 border border-gray-600 rounded-lg p-8">
            <h2 className="text-2xl font-mono mb-6 text-red-400">READ BEFORE SUBMITTING:</h2>
            
            <div className="space-y-6 text-gray-100">
              <p className="text-lg">
                So, You made it all the way here. Welcome.
              </p>
              
                <p>
                As long as this website is online, I am taking submissions if you want to add your name to any list, if you have a P100.
                I accept them ONLY through this form, but before you submit, please note I need your submission to meet some requirements:
                </p>
              
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-6">
                <h3 className="text-xl font-mono mb-4 text-red-300">Requirements:</h3>
                <ul className="space-y-3 list-disc list-inside">
                  <li>If you are submitting for someone else, you are going to need proof (screenshots) of this person agreeing to be added to the list;</li>
                  <li>Your screenshot must be taken in the current lobby when you are submitting. <strong className="text-red-300">Old screenshots are no longer accepted</strong>;</li>
                  <li>The screenshot must clearly show your P100 character and username;</li>
                  <li>Please check if you are not already on the list you are submitting for! Use "Ctrl + F" on a list's page to search for your name if you are on a computer.</li>
                </ul>
              </div>
              
              <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-6">
                <h3 className="text-xl font-mono mb-4 text-yellow-300">Exception to the "Old Screenshots" Rule:</h3>
                <p>
                  There is one exception to the "old screenshots" rule: it is IF, and only IF, it is a screenshot of when you got your P100. 
                  Please note that when submitting multiple P100s, if you changed your username, you will be asked to take new screenshots in the current lobby.
                </p>
              </div>
              
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-6">
                <p className="text-green-300 font-semibold">
                  If, and ONLY IF, your screenshot respects every requirement, you will be added to the requested list.
                </p>
              </div>
            </div>
          </div>
          
          {/* Submission Form */}
          <div className="bg-black/70 border border-gray-600 rounded-lg p-8">
            <h2 className="text-2xl font-mono mb-6 text-center">Submission Form</h2>
            
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-8">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full p-4 border border-red-600 rounded-lg bg-black text-white placeholder-gray-400 focus:border-red-400 focus:outline-none transition-colors"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">
                  Character Type *
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="killer"
                      checked={formData.characterType === 'killer'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        characterType: e.target.value as 'killer' | 'survivor',
                        characterId: ''
                      })}
                      className="mr-3 w-4 h-4 accent-red-500"
                    />
                    <span className="text-lg">Killer</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="survivor"
                      checked={formData.characterType === 'survivor'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        characterType: e.target.value as 'killer' | 'survivor',
                        characterId: ''
                      })}
                      className="mr-3 w-4 h-4 accent-red-500"
                    />
                    <span className="text-lg">Survivor</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-mono text-gray-300 uppercase tracking-wider">
                  Character *
                </label>
                <CustomDropdown
                  characters={characters}
                  value={formData.characterId}
                  onChange={(value) => setFormData({ ...formData, characterId: value })}
                  placeholder="Select a character"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="screenshot" className="block text-sm font-mono text-gray-300 uppercase tracking-wider">
                  Screenshot *
                </label>
                <input
                  type="file"
                  id="screenshot"
                  accept="image/*"
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    screenshot: e.target.files?.[0] || null 
                  })}
                  className="w-full p-4 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white file:cursor-pointer hover:file:bg-red-700 focus:border-red-400 focus:outline-none transition-colors"
                  required
                />
                <p className="text-sm text-gray-400 mt-2">
                  Upload a screenshot showing your P100 character in the current lobby
                </p>
              </div>              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-black border border-red-600 hover:bg-red-900 hover:border-red-400 disabled:bg-gray-800 disabled:border-gray-600 disabled:cursor-not-allowed text-white font-mono uppercase tracking-wider rounded-lg transition-all text-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Submit P100'}
              </button>
            </form>

            {message && (
              <div className={`mt-6 p-4 rounded-lg max-w-lg mx-auto ${
                message.includes('Error') 
                  ? 'bg-red-900/50 border border-red-500 text-red-200' 
                  : 'bg-green-900/50 border border-green-500 text-green-200'
              }`}>
                {message}
              </div>
            )}
          </div>
        </main>
      </div>
    </BackgroundWrapper>
  );
}
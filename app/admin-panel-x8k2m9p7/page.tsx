
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import supabase, { createAdminClient, sanitizeInput, validateInput } from '@/lib/supabase-client';
import React from 'react';
// You will need to export updateArtist from your service file
import { getArtists, createArtist, deleteArtist, updateArtist, Artist, ArtistInsert } from '@/lib/artists-service';
import Navigation from '@/components/ui/Navigation';
import BackgroundWrapper from '@/components/BackgroundWrapper';
import { useToast } from '@/hooks/use-toast';
// local debounced value (avoid importing callback-debounce hook)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';
import DOMPurify from 'dompurify';

// Interfaces
interface Submission {
  id: string;
  username: string;
  killer_id?: string;
  survivor_id?: string;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  comment?: string;
  legacy?: boolean;
}

interface Character {
  id: string;
  name: string;
  image_url: string;
}

interface StorageItem {
  name: string;
  path: string;
  bucket: string;
  publicUrl: string;
  created_at: string;
  updated_at: string;
  size: number;
}

// Legacy type kept for backward compatibility
interface ArtworkRecord {
  id: string;
  artwork_url: string;
  artist_id: string | null;
}

interface LoginAttempts {
  count: number;
  lastAttempt: number;
  isLocked: boolean;
}

interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SUBMISSIONS_PAGE_SIZE = 100;
const ARTWORKS_PAGE_SIZE = 100;

// Safe sanitization for comments - allows emojis, symbols, but prevents XSS
const sanitizeComment = (comment: string): string => {
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(comment, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
      KEEP_CONTENT: true, // Keep text content
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
    });
  }
  // Server-side fallback - only remove dangerous patterns, keep special characters
  return comment
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*['"]/gi, '')
    .trim();
};

// Helper to format lockout time
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

// Helper to format file size
const formatFileSize = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const sanitizeFileName = (filename: string): string => {
  // Keep Unicode letters and numbers to support international artist names.
  // Still remove path separators and unsafe punctuation; collapse spaces to dashes.
  const decoded = decodeURIComponent(filename);
  return decoded
    .replace(/[\\/]/g, '-') // never allow path separators
    .replace(/\s+/g, '-') // spaces -> dashes for stability
    // Allow Unicode letters (\p{L}), numbers (\p{N}), dash, underscore and dot
    // Everything else is stripped for a storage-safe base name
    .replace(/[^\p{L}\p{N}\-_.]/gu, '');
};

interface NewCharacterForm {
  name: string;
  id: string;
  type: 'killer' | 'survivor';
  image: File | null;
  backgroundImage: File | null;
  headerImage: File | null;
  artistImages: File[];
}

interface ArtworkUploadForm {
  artworkFile: File | null;
  characterId: string;
  characterType: 'killer' | 'survivor';
  artistName: string;
  artistId: string;
  placement: 'gallery' | 'header' | 'legacy_header';
}

export default function AdminPage() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  
  if (secretKey !== process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY) {
    notFound();
  }

  const { toast } = useToast();
  
  // Auth and Loading States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlayersLoading, setIsPlayersLoading] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [isSubmissionsLoadingMore, setIsSubmissionsLoadingMore] = useState(false);

  // Data States
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [killers, setKillers] = useState<Character[]>([]);
  const [survivors, setSurvivors] = useState<Character[]>([]);
  const [allKillers, setAllKillers] = useState<any[]>([]);
  const [allSurvivors, setAllSurvivors] = useState<any[]>([]);
  const [p100Players, setP100Players] = useState<any[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [submissionStats, setSubmissionStats] = useState<SubmissionStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  
  // Blacklist state
  const [blacklistedUsers, setBlacklistedUsers] = useState<any[]>([]);
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [newBlacklistUsername, setNewBlacklistUsername] = useState('');
  const [newBlacklistReason, setNewBlacklistReason] = useState('');
  const [newBlacklistSuper, setNewBlacklistSuper] = useState(false);
  const [isAddingToBlacklist, setIsAddingToBlacklist] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState('submissions');
  
  // Filter States
  const [filter, setFilter] = useState<'all' | 'killer' | 'survivor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingSubmissionUsername, setEditingSubmissionUsername] = useState<string | null>(null);
  const [editingSubmissionValue, setEditingSubmissionValue] = useState('');
  const [lastApprovedGlobal, setLastApprovedGlobal] = useState<string | null>(null);
  const [lastApprovedKiller, setLastApprovedKiller] = useState<string | null>(null);
  const [lastApprovedSurvivor, setLastApprovedSurvivor] = useState<string | null>(null);
  // Artworks state
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [artworksLoading, setArtworksLoading] = useState(false);
  const [artworkSearch, setArtworkSearch] = useState('');
  const [debouncedArtworkSearch, setDebouncedArtworkSearch] = useState('');
  const [artworkCharacterFilter, setArtworkCharacterFilter] = useState<string>('all');
  const [assigningArtworkId, setAssigningArtworkId] = useState<string | null>(null);
  const [deletingArtworkId, setDeletingArtworkId] = useState<string | null>(null);
  const [artworksOffset, setArtworksOffset] = useState(0);
  const [hasMoreArtworks, setHasMoreArtworks] = useState(true);
  const [showArtworkPreviews, setShowArtworkPreviews] = useState(true);
  useEffect(()=>{
    const t = setTimeout(()=> setDebouncedArtworkSearch(artworkSearch), 250);
    return ()=> clearTimeout(t);
  }, [artworkSearch]);
  // New Artwork (from Artworks tab) dialog state
  const [showNewArtworkDialog, setShowNewArtworkDialog] = useState(false);
  const [newArtworkArtistId, setNewArtworkArtistId] = useState<string>('');
  const [newArtworkCharacterType, setNewArtworkCharacterType] = useState<'killer' | 'survivor'>('killer');
  const [newArtworkCharacterId, setNewArtworkCharacterId] = useState<string>('');
  const [newArtworkPlacement, setNewArtworkPlacement] = useState<'gallery' | 'header' | 'legacy_header' | 'background'>('gallery');
  const [isCreatingArtwork, setIsCreatingArtwork] = useState(false);
  const [characterImageSearch, setCharacterImageSearch] = useState('');
  const [selectedArtworkCharacter, setSelectedArtworkCharacter] = useState<{ type: 'killer' | 'survivor'; id: string } | null>(null);
  // Storage browser state
  const [storageArtworks, setStorageArtworks] = useState<StorageItem[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageSearch, setStorageSearch] = useState('');
  const [artworkArtists, setArtworkArtists] = useState<Record<string, string | null>>({});
  const [updatingArtist, setUpdatingArtist] = useState<string | null>(null);

  // Add artwork dialog state
  const [addArtworkCharacter, setAddArtworkCharacter] = useState<{ type: 'killer' | 'survivor'; character: any } | null>(null);
  const [newArtworkUrl, setNewArtworkUrl] = useState('');
  const [newArtworkFile, setNewArtworkFile] = useState<File | null>(null);
  const [newArtworkUsageType, setNewArtworkUsageType] = useState<'gallery' | 'header' | 'legacy_header' | 'background'>('gallery');
  const [newArtworkArtist, setNewArtworkArtist] = useState<string>('none');
  const [isAddingArtwork, setIsAddingArtwork] = useState(false);

  // ---------------- Artworks grouping helpers & child components ----------------
  type MinimalCharacter = { id: string; name: string; artist_urls?: string[] | null; legacy_header_urls?: string[] | null; header_url?: string | null; background_image_url?: string | null; image_url?: string | null; };

  interface GroupedArtworksProps {
    killers: any[];
    survivors: any[];
    artists: { id: string; name: string }[];
    onUpdateField: (characterType: 'killer' | 'survivor', characterId: string, fieldName: string, newValue: string | string[] | null) => Promise<void>;
    onDeleteFromArray: (characterType: 'killer' | 'survivor', characterId: string, fieldName: string, urlToRemove: string) => Promise<void>;
    showPreviews?: boolean;
    searchTerm?: string;
  }

  type GroupKey = string;
  interface GroupMeta { 
    label: string; 
    characterType: 'killer' | 'survivor'; 
    characterId: string; 
    characterName: string;
  }

  interface ImageField {
    fieldName: string;
    fieldLabel: string;
    value: string | string[] | null;
    isArray: boolean;
  }

  const extractImageFields = (character: any): ImageField[] => {
    return [
      { fieldName: 'header_url', fieldLabel: 'Header Image', value: character.header_url, isArray: false },
      { fieldName: 'background_image_url', fieldLabel: 'Background Image', value: character.background_image_url, isArray: false },
      { fieldName: 'artist_urls', fieldLabel: 'Gallery Images', value: character.artist_urls, isArray: true },
      { fieldName: 'legacy_header_urls', fieldLabel: 'Legacy Headers', value: character.legacy_header_urls, isArray: true },
      // Exclude image_url as it's the P100 picture
    ];
  };

  const GroupedArtworks: React.FC<GroupedArtworksProps> = ({ killers, survivors, artists, onUpdateField, onDeleteFromArray, showPreviews = true, searchTerm = '' }) => {
    const [displayCount, setDisplayCount] = React.useState(20);
    
    const allCharacters = React.useMemo(() => {
      const chars: Array<{ type: 'killer' | 'survivor'; data: any }> = [];
      killers.forEach(k => chars.push({ type: 'killer', data: k }));
      survivors.forEach(s => chars.push({ type: 'survivor', data: s }));
      return chars
        .filter(({ data }) => {
          if (!searchTerm) return true;
          const hasMatchingName = data.name?.toLowerCase().includes(searchTerm.toLowerCase());
          const hasMatchingArtist = imageFields(data).some(f => {
            if (!f.value) return false;
            const urls = f.isArray ? (f.value as string[]) : [f.value as string];
            return urls.some(url => {
              const artistForUrl = artworkArtists[url];
              return artistForUrl && artistForUrl.toLowerCase().includes(searchTerm.toLowerCase());
            });
          });
          return hasMatchingName || hasMatchingArtist;
        })
        .sort((a, b) => (a.data.name || '').localeCompare(b.data.name || ''));
    }, [killers, survivors, searchTerm, artworkArtists]);

    const displayedCharacters = allCharacters.slice(0, displayCount);
    
    const imageFields = (character: any) => extractImageFields(character);

    if (!allCharacters.length) return <div className="text-gray-400 text-sm text-center py-8">No characters found matching "{searchTerm}"</div>;

    return (
      <div className="space-y-6">
        {displayedCharacters.map(({ type, data: character }) => {
          const fields = imageFields(character);
          const allArtworks: Array<{ url: string; fieldLabel: string; usageType: string; artworkId: string; characterArtworkId: string }> = [];
          
          // Use the full artwork data with IDs from _artworks
          if (character._artworks) {
            character._artworks.forEach((artwork: any) => {
              allArtworks.push({
                url: artwork.artwork_url,
                fieldLabel: artwork.usage_type,
                usageType: artwork.usage_type,
                artworkId: artwork.artwork_id,
                characterArtworkId: artwork.id, // This is the character_artworks.id for deletion
              });
            });
          }
          
          if (!allArtworks.length) return null;

          return (
            <div key={`${type}-${character.id}`} className="bg-black/40 border border-red-600/20 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-mono text-white">
                  {character.name}
                  <span className="text-sm text-gray-400 ml-2">({type})</span>
                </h2>
                <Button
                  onClick={() => setAddArtworkCharacter({ type, character })}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  + Add Artwork
                </Button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allArtworks.map((artwork, idx) => {
                  const artistName = artworkArtists[artwork.url];
                  return (
                    <div key={idx} className="space-y-2">
                      {/* Artwork Image */}
                      {showPreviews && (
                        <div className="relative aspect-square overflow-hidden rounded-lg bg-black/20 group">
                          <img
                            src={artwork.url}
                            alt={`Artwork by ${artistName || 'Unknown'}`}
                            className="w-full h-full object-contain transition-transform group-hover:scale-105"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {/* Usage Badge */}
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white">
                            {artwork.usageType}
                          </div>
                          {/* Delete Button */}
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete this ${artwork.usageType} artwork?`)) return;
                              
                              try {
                                const supabaseAdmin = createAdminClient();
                                
                                // Delete from character_artworks (this is the link)
                                const { error } = await supabaseAdmin
                                  .from('character_artworks')
                                  .delete()
                                  .eq('character_id', character.id)
                                  .eq('character_type', type)
                                  .eq('artwork_id', artwork.artworkId);
                                
                                if (error) throw error;
                                
                                toast({
                                  title: 'Deleted',
                                  description: 'Artwork removed successfully'
                                });
                                
                                await fetchAllCharacters();
                              } catch (err: any) {
                                console.error('Error deleting artwork:', err);
                                toast({
                                  title: 'Error',
                                  description: 'Failed to delete artwork',
                                  variant: 'destructive'
                                });
                              }
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete artwork"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Artist Dropdown */}
                      <Select
                        value={artists.find(a => a.name === artistName)?.id || 'none'}
                        onValueChange={async (value) => {
                          setUpdatingArtist(artwork.url);
                          
                          try {
                            const selectedArtist = value !== 'none' ? artists.find(a => a.id === value) : null;
                            
                            // Update or create artwork in database
                            const { error } = await supabase
                              .from('artworks')
                              .upsert({
                                artwork_url: artwork.url,
                                artist_name: selectedArtist?.name || null,
                                artist_url: selectedArtist ? (selectedArtist as any).url : null,
                                platform: selectedArtist ? (selectedArtist as any).platform : null,
                                updated_at: new Date().toISOString()
                              }, {
                                onConflict: 'artwork_url',
                                ignoreDuplicates: false
                              });
                            
                            if (error) {
                              console.error('Error updating artwork artist:', error);
                              toast({ 
                                title: 'Error', 
                                description: 'Failed to update artist',
                                variant: 'destructive'
                              });
                              setUpdatingArtist(null);
                              return;
                            }
                            
                            // Update local state
                            setArtworkArtists(prev => ({ ...prev, [artwork.url]: selectedArtist?.name || null }));
                            toast({ 
                              title: 'Updated', 
                              description: selectedArtist ? `Artist set to ${selectedArtist.name}` : 'Artist cleared'
                            });
                          } catch (err) {
                            console.error('Error updating artist:', err);
                            toast({ 
                              title: 'Error', 
                              description: 'Failed to update artist',
                              variant: 'destructive'
                            });
                          } finally {
                            setUpdatingArtist(null);
                          }
                        }}
                        disabled={updatingArtist === artwork.url}
                      >
                        <SelectTrigger className="w-full bg-black/40 border-red-600/20 text-white h-8 text-xs hover:border-red-600/40">
                          <SelectValue placeholder={updatingArtist === artwork.url ? 'Updating...' : 'Unknown Artist'} />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-red-600">
                          <SelectItem value="none" className="text-white">Unknown Artist</SelectItem>
                          {artists.map(artist => (
                            <SelectItem key={artist.id} value={artist.id} className="text-white">
                              {artist.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Artist Link */}
                      {artistName && (
                        <div className="text-xs text-blue-400 truncate" title={artistName}>
                          {artistName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {/* Load More Button */}
        {displayCount < allCharacters.length && (
          <div className="text-center py-8">
            <Button
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="bg-red-600 hover:bg-red-700 px-8"
            >
              Load More ({allCharacters.length - displayCount} remaining)
            </Button>
          </div>
        )}
        
        {displayedCharacters.length === 0 && allCharacters.length > 0 && (
          <div className="text-gray-400 text-center py-8">
            No characters to display
          </div>
        )}
      </div>
    );
  };

  const [submissionSort, setSubmissionSort] = useState<'newest' | 'oldest'>('newest');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [playerSort, setPlayerSort] = useState<'added_at_desc' | 'added_at_asc' | 'username_asc' | 'username_desc' | 'character_asc' | 'character_desc'>('added_at_desc');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('all');

  // Rate Limiting State
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempts>({ count: 0, lastAttempt: 0, isLocked: false });
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);

  // Pagination State for Submissions
  const [submissionsOffset, setSubmissionsOffset] = useState(0);
  const [hasMoreSubmissions, setHasMoreSubmissions] = useState(true);
  const [filteredSubmissionsCount, setFilteredSubmissionsCount] = useState(0);
  
  // Dialog and Editing States
  const [editingKiller, setEditingKiller] = useState<any>(null);
  const [editingSurvivor, setEditingSurvivor] = useState<any>(null);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [editingArtist, setEditingArtist] = useState<any>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // Comment state
  const [commentToShow, setCommentToShow] = useState<{ id: string; comment: string } | null>(null);
  
  // Management States
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [deletingScreenshotId, setDeletingScreenshotId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Storage Manager States
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string>('killerimages');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [uploadingToFolder, setUploadingToFolder] = useState<string | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ bucket: string; path: string; } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // File Picker States
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerBucket, setFilePickerBucket] = useState<string>('artworks');
  const [filePickerSearchTerm, setFilePickerSearchTerm] = useState('');
  const [filePickerMode, setFilePickerMode] = useState<{
    type: 'single' | 'multiple';
    field: 'header_url' | 'background_image_url' | 'artist_urls' | 'legacy_header_urls' | 'image_url';
    entityType: 'killer' | 'survivor';
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // List of available buckets
  const buckets = ['killerimages', 'backgrounds', 'survivorbackgrounds', 'survivors', 'screenshots', 'artworks'];

  // New Character Form States
  const [newCharacterForm, setNewCharacterForm] = useState<NewCharacterForm>({
    name: '',
    id: '',
    type: 'killer',
    image: null,
    backgroundImage: null,
    headerImage: null,
    artistImages: []
  });
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  
  // Artwork Upload Form States
  const [artworkUploadForm, setArtworkUploadForm] = useState<ArtworkUploadForm>({
    artworkFile: null,
    characterId: '',
    characterType: 'killer',
    artistName: '',
    artistId: '',
    placement: 'gallery'
  });
  const [uploadingArtwork, setUploadingArtwork] = useState(false);

  // Initial Auth Check and Data Fetch
  useEffect(() => {
    const isSessionAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
    if (isSessionAuthenticated) {
      setIsAuthenticated(true);
      fetchInitialData();
    }
    const attempts = localStorage.getItem('admin_login_attempts');
    if (attempts) {
      const parsedAttempts = JSON.parse(attempts) as LoginAttempts;
      const now = Date.now();
      if (parsedAttempts.isLocked && (now - parsedAttempts.lastAttempt) < LOCKOUT_DURATION) {
        setLoginAttempts(parsedAttempts);
        setLockoutTimeRemaining(Math.ceil((LOCKOUT_DURATION - (now - parsedAttempts.lastAttempt)) / 1000));
      } else {
        const resetAttempts = { count: 0, lastAttempt: 0, isLocked: false };
        setLoginAttempts(resetAttempts);
        localStorage.setItem('admin_login_attempts', JSON.stringify(resetAttempts));
      }
    }
  }, []);

  // Debounced effect to re-fetch players when filters change
  useEffect(() => {
      if (!isAuthenticated) return;
      const handler = setTimeout(() => {
          fetchP100Players();
      }, 300);
      return () => {
          clearTimeout(handler);
      };
  }, [playerSearchTerm, selectedCharacterId, playerSort, isAuthenticated]);

  // Re-fetch submissions when filters or sort order changes
  useEffect(() => {
      if (!isAuthenticated) return;
      // When filters change, always reset and fetch from the beginning
      fetchSubmissions(true);
  }, [submissionSort, filter, statusFilter, isAuthenticated]);

  // Re-fetch artworks when search changes
  useEffect(() => {
      if (!isAuthenticated) return;
      // Client-side filtering is applied via useMemo, but we could extend this
      // to reset pagination if server-side search is implemented later
  }, [debouncedArtworkSearch, isAuthenticated]);

  // Lockout Timer
  useEffect(() => {
    if (lockoutTimeRemaining > 0) {
      const timer = setTimeout(() => setLockoutTimeRemaining(lockoutTimeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    } else if (loginAttempts.isLocked && lockoutTimeRemaining <= 0) {
      const resetAttempts = { count: 0, lastAttempt: 0, isLocked: false };
      setLoginAttempts(resetAttempts);
      localStorage.setItem('admin_login_attempts', JSON.stringify(resetAttempts));
    }
  }, [lockoutTimeRemaining, loginAttempts.isLocked]);

  // Fetch storage items when bucket changes ONLY if storage tab active (defer heavy listing)
  useEffect(() => {
    if (isAuthenticated && activeTab === 'storage-manager') {
      fetchStorageItems(selectedBucket);
    }
  }, [selectedBucket, isAuthenticated, activeTab]);

  // Auto-expand folders in storage manager
  useEffect(() => {
    const folders = Array.from(
      new Set(
        storageItems.map((item) =>
          item.path.includes("/") ? item.path.split("/")[0] : "Root"
        )
      )
    );
    setExpandedFolders(folders);
  }, [storageItems]);

  // Re-fetch files in picker when bucket changes
  useEffect(() => {
      if (showFilePicker) {
          setFilePickerSearchTerm('');
          fetchStorageItems(filePickerBucket);
      }
  }, [filePickerBucket, showFilePicker]);

  // Computed variable for dropdown options
  const allCharactersForDropdown = useMemo(() => {
    const killerOptions = allKillers.map(k => ({ ...k, type: 'killer' as const }));
    const survivorOptions = allSurvivors.map(s => ({ ...s, type: 'survivor' as const }));
    return [...killerOptions, ...survivorOptions];
  }, [allKillers, allSurvivors]);

  // --- DATA FETCHING FUNCTIONS ---
  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSubmissions(true),
      fetchSubmissionStats(),
      fetchCharacters(),
      fetchAllCharacters(),
      fetchAllArtworks(),
      fetchArtists()
      // Intentionally skipping storage listing here for faster initial paint
    ]);
    setLoading(false);
  };

  const fetchSubmissionStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_submission_stats').single();
      if (error) throw error;
      if (data && typeof data === 'object' && 'total' in data) {
        setSubmissionStats(data as SubmissionStats);
      }
    } catch (error) {
      console.error('Error fetching submission stats:', error);
      toast({ title: 'Error', description: 'Failed to fetch submission statistics', variant: 'destructive' });
    }
  };
  
  const fetchCharacters = async () => {
    try { 
      const [killersRes, survivorsRes] = await Promise.all([
        supabase.from('killers').select('id, name, image_url').order('order'),
        supabase.from('survivors').select('id, name, image_url').order('order_num')
      ]);
      if (killersRes.error) throw killersRes.error;
      if (survivorsRes.error) throw survivorsRes.error;
      setKillers(killersRes.data || []);
      setSurvivors(survivorsRes.data || []);
    } catch (error) {
      console.error('Error fetching characters:', error);
      toast({ title: 'Error', description: 'Failed to fetch character data', variant: 'destructive' });
    }
  };

  const fetchAllCharacters = async () => {
    try {
      const supabaseAdmin = createAdminClient();
      const [killersRes, survivorsRes, artworksRes] = await Promise.all([
        supabase.from('killers').select('id, name, order').order('name'),
        supabase.from('survivors').select('id, name, order_num').order('name'),
        supabaseAdmin.from('v_character_artworks').select('*')
      ]);
      if (killersRes.error) throw killersRes.error;
      if (survivorsRes.error) throw survivorsRes.error;
      
      // Group artworks by character
      const artworksByCharacter: Record<string, any[]> = {};
      (artworksRes.data || []).forEach(artwork => {
        const key = `${artwork.character_type}-${artwork.character_id}`;
        if (!artworksByCharacter[key]) {
          artworksByCharacter[key] = [];
        }
        artworksByCharacter[key].push(artwork);
      });
      
      // Add artworks to characters
      const enrichedKillers = (killersRes.data || []).map(k => {
        const artworks = artworksByCharacter[`killer-${k.id}`] || [];
        return {
          ...k,
          header_url: artworks.find(a => a.usage_type === 'header')?.artwork_url || null,
          background_image_url: artworks.find(a => a.usage_type === 'background')?.artwork_url || null,
          artist_urls: artworks.filter(a => a.usage_type === 'gallery').map(a => a.artwork_url),
          legacy_header_urls: artworks.filter(a => a.usage_type === 'legacy_header').map(a => a.artwork_url),
          _artworks: artworks, // Store full artwork data with IDs
        };
      });
      
      const enrichedSurvivors = (survivorsRes.data || []).map(s => {
        const artworks = artworksByCharacter[`survivor-${s.id}`] || [];
        return {
          ...s,
          header_url: artworks.find(a => a.usage_type === 'header')?.artwork_url || null,
          background_image_url: artworks.find(a => a.usage_type === 'background')?.artwork_url || null,
          artist_urls: artworks.filter(a => a.usage_type === 'gallery').map(a => a.artwork_url),
          legacy_header_urls: artworks.filter(a => a.usage_type === 'legacy_header').map(a => a.artwork_url),
          _artworks: artworks, // Store full artwork data with IDs
        };
      });
      
      setAllKillers(enrichedKillers);
      setAllSurvivors(enrichedSurvivors);
      
      // Build artist map from character artworks view
      const artistMap: Record<string, string | null> = {};
      (artworksRes.data || []).forEach(artwork => {
        if (artwork.artwork_url) {
          artistMap[artwork.artwork_url] = artwork.artist_name || null;
        }
      });
      setArtworkArtists(artistMap);
    } catch (error) {
      console.error('Error fetching all characters:', error);
      toast({ title: 'Error', description: 'Failed to fetch character management data', variant: 'destructive' });
    }
  };

  // Fetch all files from artworks storage bucket
  const fetchStorageArtworks = async () => {
    setStorageLoading(true);
    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin.storage
        .from('artworks')
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const items: StorageItem[] = (data || []).map(file => {
        const publicUrl = supabaseAdmin.storage
          .from('artworks')
          .getPublicUrl(file.name).data.publicUrl;
        
        return {
          name: file.name,
          path: file.name,
          bucket: 'artworks',
          publicUrl,
          created_at: file.created_at || '',
          updated_at: file.updated_at || '',
          size: file.metadata?.size || 0
        };
      });

      setStorageArtworks(items);
      
      // Load artist info for each artwork from artworks table
      const { data: artworksData } = await supabaseAdmin
        .from('artworks')
        .select('artwork_url, artist_name');
      
      const artistMap: Record<string, string | null> = {};
      items.forEach(item => {
        const artwork = artworksData?.find(a => a.artwork_url === item.publicUrl);
        artistMap[item.publicUrl] = artwork?.artist_name || null;
      });
      setArtworkArtists(artistMap);
    } catch (err: any) {
      console.error('Failed to fetch storage artworks:', err);
      toast({ title: 'Error', description: 'Failed to load artworks from storage', variant: 'destructive' });
    } finally {
      setStorageLoading(false);
    }
  };

  // Find where an artwork is used and get current artist from artworks table
  const findArtworkUsage = async (publicUrl: string): Promise<{ characterType: 'killer' | 'survivor', characterId: string, characterName: string, artistId: string | null, artistName: string | null, fieldType: 'background' | 'header' | 'gallery' | 'legacy_header' | null } | null> => {
    try {
      // Get artist from artworks table
      const supabaseAdmin = createAdminClient();
      const { data: artworkData } = await supabaseAdmin
        .from('artworks')
        .select('artist_name')
        .eq('artwork_url', publicUrl)
        .single();
      
      const artistName = artworkData?.artist_name || null;
      const artistId = null; // We no longer use artist_id in this context

      // Check killers first
      const killer = allKillers.find(k => 
        k.background_image_url === publicUrl ||
        k.header_url === publicUrl ||
        k.artist_urls?.includes(publicUrl) ||
        k.legacy_header_urls?.includes(publicUrl)
      );
      
      if (killer) {
        let fieldType: 'background' | 'header' | 'gallery' | 'legacy_header' | null = null;
        
        if (killer.background_image_url === publicUrl) {
          fieldType = 'background';
        } else if (killer.header_url === publicUrl) {
          fieldType = 'header';
        } else if (killer.artist_urls?.includes(publicUrl)) {
          fieldType = 'gallery';
        } else if (killer.legacy_header_urls?.includes(publicUrl)) {
          fieldType = 'legacy_header';
        }
        
        return {
          characterType: 'killer',
          characterId: killer.id,
          characterName: killer.name,
          artistId,
          artistName,
          fieldType
        };
      }
      
      // Check survivors
      const survivor = allSurvivors.find(s => 
        s.background_image_url === publicUrl ||
        s.header_url === publicUrl ||
        s.artist_urls?.includes(publicUrl) ||
        s.legacy_header_urls?.includes(publicUrl)
      );
      
      if (survivor) {
        let fieldType: 'background' | 'header' | 'gallery' | 'legacy_header' | null = null;
        
        if (survivor.background_image_url === publicUrl) {
          fieldType = 'background';
        } else if (survivor.header_url === publicUrl) {
          fieldType = 'header';
        } else if (survivor.artist_urls?.includes(publicUrl)) {
          fieldType = 'gallery';
        } else if (survivor.legacy_header_urls?.includes(publicUrl)) {
          fieldType = 'legacy_header';
        }
        
        return {
          characterType: 'survivor',
          characterId: survivor.id,
          characterName: survivor.name,
          artistId,
          artistName,
          fieldType
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error finding artwork usage:', error);
      return null;
    }
  };

  // Update artist for an artwork using mapping table
  const updateArtworkArtist = async (publicUrl: string, artistId: string | null) => {
    setUpdatingArtist(publicUrl);
    try {
      const usage = await findArtworkUsage(publicUrl);
      if (!usage) {
        toast({ title: 'Error', description: 'Could not find where this artwork is used', variant: 'destructive' });
        return;
      }

      const supabaseAdmin = createAdminClient();
      
      // Get artist info
      let artistName: string | null = null;
      if (artistId) {
        const artist = artists.find(a => a.id === artistId);
        if (artist) {
          artistName = artist.name ?? null;
        }
      }

      // Upsert into mapping table
      if (artistId) {
        const { error } = await supabaseAdmin
          .from('artwork_artist_mappings')
          .upsert({
            artwork_url: publicUrl,
            artist_id: artistId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'artwork_url'
          });

        if (error) throw error;
      } else {
        // Remove mapping if no artist selected
        const { error } = await supabaseAdmin
          .from('artwork_artist_mappings')
          .delete()
          .eq('artwork_url', publicUrl);

        if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
      }

      // Also update background_credit fields if this is a background image
      if (usage.fieldType === 'background') {
        const table = usage.characterType === 'killer' ? 'killers' : 'survivors';
        const artist = artistId ? artists.find(a => a.id === artistId) : null;
        
        const { error: bgError } = await supabaseAdmin
          .from(table)
          .update({
            background_credit_name: artist?.name || null,
            background_credit_url: artist?.url || null
          })
          .eq('id', usage.characterId);

        if (bgError) console.error('Error updating background credit:', bgError);
      }

      toast({ 
        title: 'Success', 
        description: `Artist updated for ${usage.characterName} (${usage.fieldType})${artistName ? ` to ${artistName}` : ' (removed)'}` 
      });
      
      // Update local state
      setArtworkArtists(prev => ({ ...prev, [publicUrl]: artistName }));
      
      // Refresh characters if background was updated
      if (usage.fieldType === 'background') {
        await fetchAllCharacters();
      }
    } catch (error: any) {
      console.error('Error updating artist:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update artist', variant: 'destructive' });
    } finally {
      setUpdatingArtist(null);
    }
  };

  // Delete file from storage and clean up character references
  const deleteStorageArtwork = async (filePath: string, publicUrl: string) => {
    if (!confirm(`Delete ${filePath} from storage?\n\nThis will also remove it from all character pages that use it.`)) return;
    
    try {
      const supabaseAdmin = createAdminClient();
      
      // Remove from storage
      const { error: storageError } = await supabaseAdmin.storage
        .from('artworks')
        .remove([filePath]);
      
      if (storageError) throw storageError;

      // Remove from all character records that reference this URL
      // Check killers
      const { data: killers } = await supabaseAdmin
        .from('killers')
        .select('id, artist_urls, legacy_header_urls, header_url, background_image_url');

      for (const killer of killers || []) {
        let needsUpdate = false;
        const updates: any = {};

        // Check and update artist_urls array
        if (killer.artist_urls && Array.isArray(killer.artist_urls)) {
          const filtered = killer.artist_urls.filter((url: string) => url !== publicUrl);
          if (filtered.length !== killer.artist_urls.length) {
            updates.artist_urls = filtered;
            needsUpdate = true;
          }
        }

        // Check and update legacy_header_urls array
        if (killer.legacy_header_urls && Array.isArray(killer.legacy_header_urls)) {
          const filtered = killer.legacy_header_urls.filter((url: string) => url !== publicUrl);
          if (filtered.length !== killer.legacy_header_urls.length) {
            updates.legacy_header_urls = filtered;
            needsUpdate = true;
          }
        }

        // Check single-value fields
        if (killer.header_url === publicUrl) {
          updates.header_url = null;
          needsUpdate = true;
        }
        if (killer.background_image_url === publicUrl) {
          updates.background_image_url = null;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await supabaseAdmin.from('killers').update(updates).eq('id', killer.id);
        }
      }

      // Check survivors
      const { data: survivors } = await supabaseAdmin
        .from('survivors')
        .select('id, artist_urls, legacy_header_urls, header_url, background_image_url');

      for (const survivor of survivors || []) {
        let needsUpdate = false;
        const updates: any = {};

        if (survivor.artist_urls && Array.isArray(survivor.artist_urls)) {
          const filtered = survivor.artist_urls.filter((url: string) => url !== publicUrl);
          if (filtered.length !== survivor.artist_urls.length) {
            updates.artist_urls = filtered;
            needsUpdate = true;
          }
        }

        if (survivor.legacy_header_urls && Array.isArray(survivor.legacy_header_urls)) {
          const filtered = survivor.legacy_header_urls.filter((url: string) => url !== publicUrl);
          if (filtered.length !== survivor.legacy_header_urls.length) {
            updates.legacy_header_urls = filtered;
            needsUpdate = true;
          }
        }

        if (survivor.header_url === publicUrl) {
          updates.header_url = null;
          needsUpdate = true;
        }
        if (survivor.background_image_url === publicUrl) {
          updates.background_image_url = null;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await supabaseAdmin.from('survivors').update(updates).eq('id', survivor.id);
        }
      }

      toast({ title: 'Success', description: 'Artwork deleted from storage and all character pages' });
      
      // Refresh data
      await fetchStorageArtworks();
      await fetchAllCharacters();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to delete artwork', variant: 'destructive' });
    }
  };

  const fetchSubmissions = async (reset: boolean = false) => {
    if (reset) {
      setSubmissionsLoading(true);
      setSubmissions([]);
      setSubmissionsOffset(0);
      setHasMoreSubmissions(true);
    } else {
      setIsSubmissionsLoadingMore(true);
    }
  
    const currentOffset = reset ? 0 : submissionsOffset;
  
    try {
      let query = supabase
        .from('p100_submissions')
        .select('id, username, killer_id, survivor_id, screenshot_url, status, rejection_reason, submitted_at, reviewed_at, reviewed_by, comment, legacy', { count: 'exact' });
      
      // Apply server-side filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (filter === 'killer') {
        query = query.not('killer_id', 'is', null);
      } else if (filter === 'survivor') {
        query = query.not('survivor_id', 'is', null);
      }

      const { data, error, count } = await query
        .order('submitted_at', { ascending: submissionSort === 'oldest' })
        .range(currentOffset, currentOffset + SUBMISSIONS_PAGE_SIZE - 1);
      
      if (error) throw error;
  
      if (reset && count !== null) {
        setFilteredSubmissionsCount(count);
      }

      if (data) {
        if (reset) {
          setSubmissions(data);
        } else {
          setSubmissions(prev => [...prev, ...data]);
        }

        // Recompute last approved timestamps using all submissions (existing + new)
        const combined = reset ? data : [...submissions, ...data];
        const approved = combined.filter(s => s.status === 'approved' && s.reviewed_at);
        if (approved.length) {
          // Sort descending by reviewed_at
            approved.sort((a, b) => (a.reviewed_at > b.reviewed_at ? -1 : 1));
            setLastApprovedGlobal(approved[0].reviewed_at);
            const killerApproved = approved.find(a => a.killer_id);
            setLastApprovedKiller(killerApproved ? killerApproved.reviewed_at : null);
            const survivorApproved = approved.find(a => a.survivor_id);
            setLastApprovedSurvivor(survivorApproved ? survivorApproved.reviewed_at : null);
        } else if (reset) {
          setLastApprovedGlobal(null);
          setLastApprovedKiller(null);
          setLastApprovedSurvivor(null);
        }
        
        if (data.length < SUBMISSIONS_PAGE_SIZE) {
          setHasMoreSubmissions(false);
        } else {
          setSubmissionsOffset(currentOffset + SUBMISSIONS_PAGE_SIZE);
        }
      } else {
        setHasMoreSubmissions(false);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({ title: 'Error', description: 'Failed to fetch submissions', variant: 'destructive' });
    } finally {
      if (reset) {
        setSubmissionsLoading(false);
      } else {
        setIsSubmissionsLoadingMore(false);
      }
    }
  };

  const fetchP100Players = async () => {
    if (!isAuthenticated) return;
    setIsPlayersLoading(true);

    try {
        let query = supabase
            .from('p100_players')
            .select('*, killers(name), survivors(name)');

        // Filter by search term
        const searchTerm = playerSearchTerm.trim();
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        // Filter by specific character
        if (selectedCharacterId !== 'all') {
          const isKiller = allKillers.some(k => k.id === selectedCharacterId);
          if (isKiller) {
              query = query.eq('killer_id', selectedCharacterId);
          } else {
              query = query.eq('survivor_id', selectedCharacterId);
          }
        }
        
        // Apply sorting
        if (playerSort === 'username_asc' || playerSort === 'username_desc') {
            query = query.order('username', { ascending: playerSort === 'username_asc' });
        } else {
            // Default sort by date
            query = query.order('added_at', { ascending: playerSort === 'added_at_asc' });
        }

        const { data, error } = await query;
        if (error) throw error;
        setP100Players(data || []);
    } catch (error) {
        console.error('Error fetching P100 players:', error);
        toast({ title: 'Error', description: 'Failed to fetch P100 players.', variant: 'destructive' });
    } finally {
        setIsPlayersLoading(false);
    }
  };

  // Fetch first page of artworks (deprecated - now using character-based approach)
  const fetchAllArtworks = useCallback(async () => {
    // Artworks are now managed through characters, not a separate artworks table
    setArtworks([]);
    setArtworksOffset(0);
    setHasMoreArtworks(false);
  }, []);

  // Load more artworks (deprecated - now using character-based approach)
  const loadMoreArtworks = useCallback(async () => {
    // Artworks are now managed through characters, not a separate artworks table
    setHasMoreArtworks(false);
  }, []);

  // Fetch blacklisted users
  const fetchBlacklistedUsers = useCallback(async () => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('blacklisted_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBlacklistedUsers(data || []);
    } catch (e: any) {
      console.error('Error fetching blacklisted users', e);
      toast({ title: 'Error', description: 'Failed to fetch blacklist', variant: 'destructive' });
    }
  }, [toast]);

  // Add user to blacklist
  const addToBlacklist = useCallback(async () => {
    if (!newBlacklistUsername.trim()) {
      toast({ title: 'Error', description: 'Username is required', variant: 'destructive' });
      return;
    }
    
    setIsAddingToBlacklist(true);
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('blacklisted_users')
        .insert([{
          username: newBlacklistUsername.trim().toLowerCase(),
          reason: newBlacklistReason.trim() || null,
          created_by: 'admin',
          is_super: newBlacklistSuper
        }]);
      
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({ title: 'Error', description: 'User is already blacklisted', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }
      
      toast({ title: 'Success', description: 'User added to blacklist' });
      setNewBlacklistUsername('');
      setNewBlacklistReason('');
      setNewBlacklistSuper(false);
      await fetchBlacklistedUsers();
    } catch (e: any) {
      console.error('Error adding to blacklist', e);
      toast({ title: 'Error', description: 'Failed to add user to blacklist', variant: 'destructive' });
    } finally {
      setIsAddingToBlacklist(false);
    }
  }, [newBlacklistUsername, newBlacklistReason, newBlacklistSuper, toast, fetchBlacklistedUsers]);

  // Remove user from blacklist
  const removeFromBlacklist = useCallback(async (id: string, username: string) => {
    if (!confirm(`Remove ${username} from blacklist?`)) return;
    
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('blacklisted_users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'User removed from blacklist' });
      await fetchBlacklistedUsers();
    } catch (e: any) {
      console.error('Error removing from blacklist', e);
      toast({ title: 'Error', description: 'Failed to remove user from blacklist', variant: 'destructive' });
    }
  }, [toast, fetchBlacklistedUsers]);

  const toggleBlacklistSuper = useCallback(async (id: string, currentSuper: boolean) => {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('blacklisted_users')
        .update({ is_super: !currentSuper })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Updated', description: `Super blacklist ${!currentSuper ? 'enabled' : 'disabled'}.` });
      await fetchBlacklistedUsers();
    } catch (e: any) {
      console.error('Error toggling super blacklist', e);
      toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' });
    }
  }, [toast, fetchBlacklistedUsers]);


  const fetchStorageItems = async (bucket: string) => {
    setLoadingStorage(true);
    try {
        const supabase = createAdminClient();
        const allItems: StorageItem[] = [];
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

        const listItemsRecursively = async (pathPrefix = '') => {
            const { data, error } = await supabase.storage.from(bucket).list(pathPrefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
            
            if (error) {
                console.error(`Error listing items in bucket "${bucket}" at path "${pathPrefix}":`, error.message);
                return;
            }
            if (!data) return;

            const files = data.filter(item => item.id !== null);
            const folders = data.filter(item => item.id === null);

            for (const file of files) {
                const fullPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURI(fullPath)}`;
                
                allItems.push({
                    name: file.name,
                    path: fullPath,
                    bucket,
                    publicUrl,
                    created_at: file.created_at || new Date().toISOString(),
                    updated_at: file.updated_at || new Date().toISOString(),
                    size: file.metadata?.size || 0,
                });
            }

            const folderPromises = folders.map(folder => {
                const fullPath = pathPrefix ? `${pathPrefix}/${folder.name}` : folder.name;
                return listItemsRecursively(fullPath);
            });

            await Promise.all(folderPromises);
        };

        await listItemsRecursively();
        allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setStorageItems(allItems);
    } catch (error) {
        console.error(`Error fetching storage items from ${bucket}:`, error);
        toast({ title: 'Error', description: `Failed to fetch items from ${bucket}`, variant: 'destructive' });
    } finally {
        setLoadingStorage(false);
    }
  };

  // Deprecated: artworks are now managed through characters
  const filteredArtworks = useMemo(() => {
    return [];
  }, []);

  const refreshArtworks = useCallback(() => { void fetchAllArtworks(); }, [fetchAllArtworks]);


  // --- AUTHENTICATION FUNCTIONS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAttempts.isLocked) {
      toast({ title: 'Account Locked', description: `Try again in ${formatTime(lockoutTimeRemaining)}.`, variant: 'destructive' });
      return;
    }
    setAuthLoading(true);
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      const resetAttempts = { count: 0, lastAttempt: 0, isLocked: false };
      setLoginAttempts(resetAttempts);
      localStorage.setItem('admin_login_attempts', JSON.stringify(resetAttempts));
      await fetchInitialData();
      toast({ title: 'Success', description: 'Successfully logged in.' });
    } else {
      const newCount = loginAttempts.count + 1;
      const now = Date.now();
      const newAttempts: LoginAttempts = { count: newCount, lastAttempt: now, isLocked: newCount >= MAX_LOGIN_ATTEMPTS };
      setLoginAttempts(newAttempts);
      localStorage.setItem('admin_login_attempts', JSON.stringify(newAttempts));
      if (newAttempts.isLocked) {
        setLockoutTimeRemaining(Math.ceil(LOCKOUT_DURATION / 1000));
        toast({ title: 'Account Locked', description: `Too many failed attempts. Locked for 15 minutes.`, variant: 'destructive' });
      } else {
        toast({ title: 'Invalid Password', description: `${MAX_LOGIN_ATTEMPTS - newCount} attempts remaining.`, variant: 'destructive' });
      }
    }
    setAuthLoading(false);
    setPassword('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    setSubmissions([]);
    setKillers([]);
    setSurvivors([]);
    setAllKillers([]);
    setAllSurvivors([]);
    setP100Players([]);
    setArtists([]);
    setStorageItems([]);
    setArtworks([]);
    toast({ title: 'Logged Out' });
  };
  

  // --- CRUD & MANAGEMENT FUNCTIONS ---
  const updateSubmissionLegacyStatus = async (submissionId: string, legacyStatus: boolean) => {
    try {
      const supabase = createAdminClient();
      await supabase
        .from('p100_submissions')
        .update({ legacy: legacyStatus })
        .eq('id', submissionId)
        .throwOnError();
      
      setSubmissions(currentSubmissions =>
        currentSubmissions.map(s => s.id === submissionId ? { ...s, legacy: legacyStatus } : s)
      );
      
      toast({ 
        title: 'Success', 
        description: `Legacy status ${legacyStatus ? 'enabled' : 'disabled'} for submission.` 
      });
    } catch (error) {
      console.error('Error updating legacy status:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to update legacy status.', 
        variant: 'destructive' 
      });
    }
  };

  const updateSubmissionStatus = async (id: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const supabase = createAdminClient();
      const submission = submissions.find(s => s.id === id);
      if (!submission) return;

      const safeRejectionReason = rejectionReason ? sanitizeComment(rejectionReason) : null;
      
      await supabase.from('p100_submissions').update({ 
        status, 
        rejection_reason: status === 'rejected' ? safeRejectionReason : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin'
      }).eq('id', id).throwOnError();

      if (status === 'approved') {
        const characterColumn = submission.killer_id ? 'killer_id' : 'survivor_id';
        const characterId = submission.killer_id || submission.survivor_id;
        const sanitizedUsername = sanitizeComment(submission.username);
        
        const { data: existingPlayer } = await supabase.from('p100_players').select('id').eq('username', sanitizedUsername).eq(characterColumn, characterId).single();

        if (!existingPlayer) {
          await supabase.from('p100_players').insert({ 
            username: sanitizedUsername, 
            [characterColumn]: characterId, 
            p200: false,
            legacy: false,
            favorite: false
          }).throwOnError();
        }
      }
      toast({ title: 'Success', description: `Submission ${status}.` });
      await fetchSubmissions(true);
      await fetchSubmissionStats();
      await fetchP100Players();
    } catch (error) {
      console.error(`Error updating submission:`, error);
      toast({ title: 'Error', description: 'Failed to update submission.', variant: 'destructive' });
    }
  };

  const bulkUpdateSubmissions = async (status: 'approved' | 'rejected', rejectionReason?: string) => {
    if (selectedSubmissions.size === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedSubmissions) {
        await updateSubmissionStatus(id, status, rejectionReason);
      }
      toast({ title: 'Success', description: `${selectedSubmissions.size} submissions ${status}.` });
      setSelectedSubmissions(new Set());
      setBulkRejectOpen(false);
      setBulkRejectReason('');
    } catch (error) {
      console.error('Bulk update error:', error);
      toast({ title: 'Error', description: 'Some submissions failed to update.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleSubmissionSelection = (id: string) => {
    setSelectedSubmissions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSubmissionScreenshot = async (submission: Submission) => {
    if (!submission.screenshot_url) return;
    if (!confirm('Are you sure you want to delete this screenshot? This is irreversible.')) return;

    setDeletingScreenshotId(submission.id);

    try {
        const supabase = createAdminClient();
        const urlRegex = /storage\/v1\/object\/public\/([^/]+)\/(.*)/;
        const match = submission.screenshot_url.match(urlRegex);
        if (!match) throw new Error("Could not parse screenshot URL.");

        const bucketName = match[1];
        const filePath = decodeURIComponent(match[2]);

        const { error: storageError } = await supabase.storage.from(bucketName).remove([filePath]);
        if (storageError) throw storageError;
        
        const { error: dbError } = await supabase.from('p100_submissions').update({ screenshot_url: '' }).eq('id', submission.id);
        if (dbError) throw dbError;

        setSubmissions(currentSubmissions =>
            currentSubmissions.map(s => s.id === submission.id ? { ...s, screenshot_url: '' } : s)
        );
        toast({ title: 'Success', description: 'Screenshot deleted successfully.' });
    } catch (error: any) {
        console.error('Error deleting submission screenshot:', error);
        toast({ title: 'Error', description: error.message || 'Failed to delete screenshot.', variant: 'destructive' });
    } finally {
        setDeletingScreenshotId(null);
    }
  };

  const handleBulkDeleteScreenshots = async () => {
    setIsBulkDeleting(true);

    const submissionsToDelete = submissions.filter(s => 
        (s.status === 'approved' || s.status === 'rejected') && s.screenshot_url
    );

    if (submissionsToDelete.length === 0) {
        toast({ title: 'No Screenshots to Delete', description: 'There are no processed submissions with screenshots.' });
        setIsBulkDeleting(false);
        setShowBulkDeleteConfirm(false);
        return;
    }

    const pathsToDelete: string[] = [];
    const idsToUpdate: string[] = [];
    const urlRegex = /storage\/v1\/object\/public\/([^/]+)\/(.*)/;

    for (const sub of submissionsToDelete) {
        const match = sub.screenshot_url.match(urlRegex);
        if (match && match[1] === 'screenshots') {
            pathsToDelete.push(decodeURIComponent(match[2]));
            idsToUpdate.push(sub.id);
        }
    }

    if (pathsToDelete.length === 0) {
        toast({ title: 'No Valid Screenshots Found', description: 'Could not parse any valid screenshot paths to delete.' });
        setIsBulkDeleting(false);
        setShowBulkDeleteConfirm(false);
        return;
    }

    try {
        const supabase = createAdminClient();

        const { error: storageError } = await supabase.storage.from('screenshots').remove(pathsToDelete);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from('p100_submissions').update({ screenshot_url: '' }).in('id', idsToUpdate);
        if (dbError) throw dbError;
        
        toast({ title: 'Success', description: `Successfully deleted ${pathsToDelete.length} screenshots.` });
        await fetchSubmissions(true);
        await fetchSubmissionStats();

    } catch (error: any) {
        console.error('Error during bulk screenshot deletion:', error);
        toast({ title: 'Error', description: error.message || 'Failed to delete all screenshots.', variant: 'destructive' });
    } finally {
        setIsBulkDeleting(false);
        setShowBulkDeleteConfirm(false);
    }
  };
  
  const deleteCharacter = async (characterId: string, characterType: 'killer' | 'survivor') => {
    if (!confirm(`Are you sure you want to delete this ${characterType}? This is irreversible and will delete all associated P100 players and submissions.`)) {
      return;
    }
    setDeletingItem(characterId);
    try {
      const supabase = createAdminClient();
      const playerColumn = characterType === 'killer' ? 'killer_id' : 'survivor_id';
      const tableName = characterType === 'killer' ? 'killers' : 'survivors';
      
      await supabase.from('p100_players').delete().eq(playerColumn, characterId);
      await supabase.from('p100_submissions').delete().eq(playerColumn, characterId);
      await supabase.from(tableName).delete().eq('id', characterId);

      toast({ title: 'Success', description: `${characterType} deleted successfully.` });
      await fetchAllCharacters();
      await fetchCharacters();
    } catch (error) {
      console.error(`Error deleting ${characterType}:`, error);
      toast({ title: 'Error', description: `Failed to delete ${characterType}.`, variant: 'destructive' });
    } finally {
      setDeletingItem(null);
    }
  };

  const saveKiller = async (killerData: any) => {
    try {
      const supabase = createAdminClient();
      const { id, created_at, _artworks, header_url, background_image_url, artist_urls, legacy_header_urls, ...rest } = killerData;
      // Only send valid DB columns
      const updateData = { ...rest };
      if (header_url !== undefined) updateData.header_url = header_url;
      if (background_image_url !== undefined) updateData.background_image_url = background_image_url;
      if (artist_urls !== undefined) updateData.artist_urls = artist_urls;
      if (legacy_header_urls !== undefined) updateData.legacy_header_urls = legacy_header_urls;
      let killerId = id;
      if (id && allKillers.find(k => k.id === id)) {
        await supabase.from('killers').update(updateData).eq('id', id).throwOnError();
      } else {
        const { data: inserted, error: insertErr } = await supabase.from('killers').insert(updateData).select('id').single();
        if (insertErr) throw insertErr;
        killerId = inserted.id;
      }

      // --- ARTWORK SYSTEM SYNC ---
      if (background_image_url && killerId) {
        try {
          const { addArtworkToCharacter } = await import('@/lib/artwork-management');
          await addArtworkToCharacter(
            killerId,
            'killer',
            background_image_url,
            'background',
            undefined,
            supabase
          );
        } catch (artworkErr) {
          console.warn('Artwork sync failed (background still saved to killers table):', artworkErr);
        }
      }

      toast({ title: 'Success', description: 'Killer saved successfully.' });
      await fetchAllCharacters();
      setEditingKiller(null);
    } catch (error: any) {
      console.error('Error saving killer:', error);
      let details = '';
      if (error instanceof Error) {
        details = `\nStack: ${error.stack || ''}`;
      } else if (typeof error === 'object' && error !== null) {
        details = `\nError object: ${JSON.stringify(error)}`;
      }
      toast({ title: 'Error', description: `Failed to save killer: ${error.message || error} ${details}`, variant: 'destructive' });
    }
  };

  const saveSurvivor = async (survivorData: any) => {
    try {
      const supabase = createAdminClient();
      const { id, created_at, _artworks, header_url, background_image_url, artist_urls, legacy_header_urls, ...rest } = survivorData;
      // Only send valid DB columns
      const updateData = { ...rest };
      if (header_url !== undefined) updateData.header_url = header_url;
      if (background_image_url !== undefined) updateData.background_image_url = background_image_url;
      if (artist_urls !== undefined) updateData.artist_urls = artist_urls;
      if (legacy_header_urls !== undefined) updateData.legacy_header_urls = legacy_header_urls;
      let survivorId = id;
      if (id && allSurvivors.find(s => s.id === id)) {
        await supabase.from('survivors').update(updateData).eq('id', id).throwOnError();
      } else {
        const { data: inserted, error: insertErr } = await supabase.from('survivors').insert(updateData).select('id').single();
        if (insertErr) throw insertErr;
        survivorId = inserted.id;
      }

      // --- ARTWORK SYSTEM SYNC ---
      if (background_image_url && survivorId) {
        try {
          const { addArtworkToCharacter } = await import('@/lib/artwork-management');
          await addArtworkToCharacter(
            survivorId,
            'survivor',
            background_image_url,
            'background',
            undefined,
            supabase
          );
        } catch (artworkErr) {
          console.warn('Artwork sync failed (background still saved to survivors table):', artworkErr);
        }
      }

      toast({ title: 'Success', description: 'Survivor saved successfully.' });
      await fetchAllCharacters();
      setEditingSurvivor(null);
    } catch (error: any) {
      console.error('Error saving survivor:', error);
      let details = '';
      if (error instanceof Error) {
        details = `\nStack: ${error.stack || ''}`;
      } else if (typeof error === 'object' && error !== null) {
        details = `\nError object: ${JSON.stringify(error)}`;
      }
      toast({ title: 'Error', description: `Failed to save survivor: ${error.message || error} ${details}`, variant: 'destructive' });
    }
  };

  const savePlayer = async (playerData: any) => {
    if (!playerData.username || !playerData.username.trim()) {
        toast({ title: 'Validation Error', description: 'Username is required.', variant: 'destructive' });
        return;
    }
    if (!playerData.killer_id && !playerData.survivor_id) {
        toast({ title: 'Validation Error', description: 'A character must be selected.', variant: 'destructive' });
        return;
    }

    try {
      const supabase = createAdminClient();
      const { id, killers, survivors, ...updateData } = playerData;
      updateData.username = updateData.username.trim();

      if (id && p100Players.find(p => p.id === id)) {
        await supabase.from('p100_players').update(updateData).eq('id', id).throwOnError();
      } else {
        await supabase.from('p100_players').insert(updateData).throwOnError();
      }
      toast({ title: 'Success', description: 'Player saved successfully.' });
      await fetchP100Players();
      setEditingPlayer(null);
    } catch (error: any) {
      console.error('Error saving player:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save player.', variant: 'destructive' });
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player entry?')) return;
    try {
      const supabase = createAdminClient();
      await supabase.from('p100_players').delete().eq('id', playerId).throwOnError();
      toast({ title: 'Success', description: 'Player deleted successfully.' });
      await fetchP100Players();
    } catch (error) {
      console.error('Error deleting player:', error);
      toast({ title: 'Error', description: 'Failed to delete player.', variant: 'destructive' });
    }
  };
  
  const fetchArtists = async () => {
    try {
      const supabase = createAdminClient();
      const artistsData = await getArtists(supabase);
      setArtists(artistsData);
    } catch (error) {
      console.error('Error fetching artists:', error);
      toast({ title: 'Error', description: 'Failed to fetch artists data', variant: 'destructive' });
    }
  };

  const saveArtist = async (artistData: any) => {
    try {
        const supabase = createAdminClient();
        const { id, created_at, slug, ...updateData } = artistData; 
        
        if (id && artists.find(a => a.id === id)) {
            await updateArtist(supabase, id, updateData);
        } else {
            await createArtist(supabase, updateData);
        }
        
        toast({ title: 'Success', description: 'Artist saved successfully.' });
        await fetchArtists();
        setEditingArtist(null);
    } catch (error: any) {
        console.error('Error saving artist:', error);
        toast({ title: 'Error', description: error.message || 'Failed to save artist.', variant: 'destructive' });
    }
  };

  const handleDeleteArtist = async (artistId: string, artistName: string) => {
    if (!confirm(`Are you sure you want to delete the artist "${artistName}"?`)) return;
    try {
        const supabase = createAdminClient();
        await deleteArtist(supabase, artistId);
        toast({ title: 'Success', description: 'Artist deleted successfully.' });
        await fetchArtists();
    } catch (error: any) {
        console.error('Error deleting artist:', error);
        toast({ title: 'Error', description: error.message || 'Failed to delete artist.', variant: 'destructive' });
    }
  };

  // --- STORAGE & FILE FUNCTIONS ---
  const uploadImageToStorage = async (file: File, bucket: string, path: string): Promise<string> => {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  const handleFileUpload = async (files: File[], folder?: string) => {
    setUploadingFiles(files);
    try {
        const uploadPromises = files.map(file => {
            const sanitizedFilename = sanitizeFileName(file.name);
            const path = folder && folder !== 'Root'
                ? `${folder}/${Date.now()}-${sanitizedFilename}`
                : `${Date.now()}-${sanitizedFilename}`;
            return uploadImageToStorage(file, selectedBucket, path);
        });
        await Promise.all(uploadPromises);
        toast({ title: 'Success', description: `${files.length} file(s) uploaded successfully.` });
        await fetchStorageItems(selectedBucket);
    } catch (error: any) {
        console.error('Error uploading files:', error);
        const description = error.message ? `Upload failed: ${error.message}` : 'Failed to upload files.';
        toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
        setUploadingFiles([]);
    }
  };

  const handleFolderUploadClick = (folder: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        if (files.length > 0) {
            setUploadingToFolder(folder);
            await handleFileUpload(files, folder);
            setUploadingToFolder(null);
        }
    };
    input.click();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files, 'Root');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFileUpload(files, 'Root');
  };

  const createFolder = async () => {
    const folderName = prompt('Enter new folder name (e.g., character-id):');
    if (!folderName || folderName.trim() === '') return;
    const sanitizedFolderName = folderName.trim().replace(/[^a-zA-Z0-9-_\/]/g, '');
    if (!sanitizedFolderName) {
      toast({ title: 'Error', description: 'Invalid folder name.', variant: 'destructive' });
      return;
    }
    const placeholderFile = new File([''], '.placeholder', { type: 'text/plain' });
    const filePath = `${sanitizedFolderName}/.placeholder`;
    try {
        await uploadImageToStorage(placeholderFile, selectedBucket, filePath);
        toast({ title: 'Success', description: `Folder "${sanitizedFolderName}" created.` });
        await fetchStorageItems(selectedBucket);
    } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Failed to create folder.', variant: 'destructive' });
    }
  };

  const deleteStorageItem = async (bucket: string, path: string) => {
    if (!confirm(`Are you sure you want to delete "${path}" from the "${bucket}" bucket? This is irreversible.`)) return;
    setDeletingFile(path);
    try {
        const supabase = createAdminClient();
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
        toast({ title: 'Success', description: 'File deleted successfully.' });
        await fetchStorageItems(bucket);
    } catch (error) {
        console.error('Error deleting file:', error);
        toast({ title: 'Error', description: 'Failed to delete file.', variant: 'destructive' });
    } finally {
        setDeletingFile(null);
    }
  };

  const handleRename = async () => {
    if (!renamingItem || !newFileName.trim()) {
        toast({ title: 'Error', description: 'New file name cannot be empty.', variant: 'destructive' });
        return;
    }
    
    setIsRenaming(true);
    const { bucket, path: oldPath } = renamingItem;
    const oldName = oldPath.split('/').pop() || '';
    const fileExtension = oldName.includes('.') ? `.${oldName.split('.').pop()}` : '';
    let sanitizedNewName = sanitizeFileName(newFileName);

    if (fileExtension && !sanitizedNewName.endsWith(fileExtension)) {
        sanitizedNewName = sanitizedNewName.split('.')[0] + fileExtension;
    }
    
    if (sanitizedNewName === oldName) {
        setRenamingItem(null);
        setIsRenaming(false);
        return;
    }

    const pathParts = oldPath.split('/');
    pathParts.pop();
    const newPath = pathParts.length > 0 ? `${pathParts.join('/')}/${sanitizedNewName}` : sanitizedNewName;

    try {
        const supabaseAdmin = createAdminClient();
        const { error: moveError } = await supabaseAdmin.storage.from(bucket).move(oldPath, newPath);
        if (moveError) throw new Error(`Storage error: ${moveError.message}`);

        const { data: { publicUrl: oldPublicUrl } } = supabase.storage.from(bucket).getPublicUrl(oldPath);
        const { data: { publicUrl: newPublicUrl } } = supabase.storage.from(bucket).getPublicUrl(newPath);

        if (!oldPublicUrl || !newPublicUrl) throw new Error("Could not generate public URLs.");

        const tablesToUpdate = {
            'killers': ['image_url', 'background_image_url', 'header_url', 'artist_urls', 'legacy_header_urls'],
            'survivors': ['image_url', 'background_image_url', 'header_url', 'artist_urls', 'legacy_header_urls'],
        };
        const arrayFields = ['artist_urls', 'legacy_header_urls'];

        for (const [table, columns] of Object.entries(tablesToUpdate)) {
            for (const column of columns) {
                if (arrayFields.includes(column)) {
                    const { data, error } = await supabaseAdmin.from(table).select(`id, ${column}`).contains(column, [oldPublicUrl]);
                    if (error) {
                        console.error(`Error selecting from ${table} for array update:`, error);
                        continue;
                    }
                    if (data && data.length > 0) {
                        for (const row of data as unknown as { id: string; [key: string]: any }[]) {
                            const urls: string[] = Array.isArray(row[column]) ? row[column] : [];
                            const updatedArray = urls.map((url: string) => url === oldPublicUrl ? newPublicUrl : url);
                            const { error: updateError } = await supabaseAdmin.from(table).update({ [column]: updatedArray }).eq('id', row.id);
                            if (updateError) console.error(`Failed to update row ${row.id} in ${table}:`, updateError);
                        }
                    }
                } else {
                    const { error: updateError } = await supabaseAdmin.from(table).update({ [column]: newPublicUrl }).eq(column, oldPublicUrl);
                    if (updateError) console.error(`Failed to update ${column} in ${table}:`, updateError);
                }
            }
        }
        
        toast({ title: 'Success', description: `Renamed "${oldName}" to "${sanitizedNewName}". References updated.` });
        
        await fetchStorageItems(bucket);
        if (showFilePicker) {
            await fetchStorageItems(filePickerBucket);
        }
        await fetchAllCharacters();

    } catch (error: any) {
        console.error('Error renaming file:', error);
        toast({ title: 'Error', description: error.message || 'Failed to rename file.', variant: 'destructive' });
    } finally {
        setIsRenaming(false);
        setRenamingItem(null);
        setNewFileName('');
    }
  };
  
  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev =>
      prev.includes(folderName) ? prev.filter(f => f !== folderName) : [...prev, folderName]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: 'Success', description: 'URL copied to clipboard!' }))
      .catch(() => toast({ title: 'Error', description: 'Failed to copy URL.', variant: 'destructive' }));
  };

  // Function to upload artwork to character
  const uploadArtworkToCharacter = async () => {
    if (!artworkUploadForm.artworkFile || !artworkUploadForm.characterId || !artworkUploadForm.artistId) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setUploadingArtwork(true);
    try {
  const supabase = createAdminClient();
  const selectedArtist = artists.find(a => a.id === artworkUploadForm.artistId);
  const artistNameRaw = (selectedArtist?.name || 'unknown').trim();
  // Use a storage-safe base name, and URL-encode the artist identifier after "-by-".
  // This preserves special characters when analytics runs decodeURIComponent() on URLs.
  const timestamp = Date.now();
  const fileExtension = artworkUploadForm.artworkFile.name.split('.').pop();
  const baseSafe = sanitizeFileName(`${artworkUploadForm.characterId}-${timestamp}`);
  const artistIdentifier = encodeURIComponent(artistNameRaw);
  const fileName = `${baseSafe}-by-${artistIdentifier}.${fileExtension}`;
      
      const artworkUrl = await uploadImageToStorage(artworkUploadForm.artworkFile, 'artworks', fileName);
      
      const tableName = artworkUploadForm.characterType === 'killer' ? 'killers' : 'survivors';
      const { data: character, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', artworkUploadForm.characterId)
        .single();
      
      if (fetchError) throw fetchError;
      
      let updateData = {};
      
      if (artworkUploadForm.placement === 'gallery') {
        const currentUrls = character.artist_urls || [];
        updateData = { artist_urls: [...currentUrls, artworkUrl] };
      } else if (artworkUploadForm.placement === 'header') {
        updateData = { header_url: artworkUrl };
      } else if (artworkUploadForm.placement === 'legacy_header') {
        const currentUrls = character.legacy_header_urls || [];
        updateData = { legacy_header_urls: [...currentUrls, artworkUrl] };
      }
      
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', artworkUploadForm.characterId);
      
      if (updateError) throw updateError;
      
      toast({ title: 'Success', description: 'Artwork uploaded and added to character successfully!' });
      
      setArtworkUploadForm({
        artworkFile: null,
        characterId: '',
        characterType: 'killer',
        artistName: '',
        artistId: '',
        placement: 'gallery'
      });
      
      await fetchAllCharacters();
      
    } catch (error: any) {
      console.error('Error uploading artwork:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload artwork.', variant: 'destructive' });
    } finally {
      setUploadingArtwork(false);
    }
  };

  // Function to create new character
  const createNewCharacter = async () => {
    if (!newCharacterForm.name.trim() || !newCharacterForm.id.trim() || !newCharacterForm.image) {
      toast({ title: 'Validation Error', description: 'Name, ID, and character image are required.', variant: 'destructive' });
      return;
    }

    setCreatingCharacter(true);
    try {
      const supabase = createAdminClient();
      const timestamp = Date.now();
      
      const imageExtension = newCharacterForm.image.name.split('.').pop();
      const imageBucket = newCharacterForm.type === 'killer' ? 'killerimages' : 'survivors';
      const imagePath = `${newCharacterForm.id}.${imageExtension}`;
      const imageUrl = await uploadImageToStorage(newCharacterForm.image, imageBucket, imagePath);
      
      let backgroundImageUrl = '';
      if (newCharacterForm.backgroundImage) {
        const bgExtension = newCharacterForm.backgroundImage.name.split('.').pop();
        const bgBucket = newCharacterForm.type === 'killer' ? 'backgrounds' : 'survivorbackgrounds';
        const bgPath = `${newCharacterForm.id}.${bgExtension}`;
        backgroundImageUrl = await uploadImageToStorage(newCharacterForm.backgroundImage, bgBucket, bgPath);
      }
      
      let headerUrl = '';
      if (newCharacterForm.headerImage) {
        const headerExtension = newCharacterForm.headerImage.name.split('.').pop();
        const headerPath = `${newCharacterForm.id}-header.${headerExtension}`;
        headerUrl = await uploadImageToStorage(newCharacterForm.headerImage, 'backgrounds', headerPath);
      }
      
      let artistUrls: string[] = [];
      if (newCharacterForm.artistImages.length > 0) {
        const uploadPromises = newCharacterForm.artistImages.map(async (file, index) => {
          const extension = file.name.split('.').pop();
          const fileName = `${newCharacterForm.id}-artwork-${index + 1}-${timestamp}.${extension}`;
          return uploadImageToStorage(file, 'artworks', fileName);
        });
        artistUrls = await Promise.all(uploadPromises);
      }
      
      const tableName = newCharacterForm.type === 'killer' ? 'killers' : 'survivors';
      const orderField = newCharacterForm.type === 'killer' ? 'order' : 'order_num';
      const maxOrder = newCharacterForm.type === 'killer' 
        ? Math.max(...allKillers.map(k => k.order || 0), 0)
        : Math.max(...allSurvivors.map(s => s.order_num || 0), 0);
      
      const characterData = {
        id: newCharacterForm.id,
        name: newCharacterForm.name,
        image_url: imageUrl,
        background_image_url: backgroundImageUrl || null,
        header_url: headerUrl || null,
        artist_urls: artistUrls,
        legacy_header_urls: [],
        [orderField]: maxOrder + 1
      };
      
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(characterData);
      
      if (insertError) throw insertError;
      
      toast({ title: 'Success', description: `${newCharacterForm.type === 'killer' ? 'Killer' : 'Survivor'} "${newCharacterForm.name}" created successfully!` });
      
      setNewCharacterForm({
        name: '',
        id: '',
        type: 'killer',
        image: null,
        backgroundImage: null,
        headerImage: null,
        artistImages: []
      });
      
      await fetchAllCharacters();
      await fetchCharacters();
      
    } catch (error: any) {
      console.error('Error creating character:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create character.', variant: 'destructive' });
    } finally {
      setCreatingCharacter(false);
    }
  };
  
  // --- RENDER LOGIC ---
  const getCharacterName = (submission: Submission) => {
    if (submission.killer_id) {
      return killers.find(k => k.id === submission.killer_id)?.name || submission.killer_id;
    } else if (submission.survivor_id) {
      return survivors.find(s => s.id === submission.survivor_id)?.name || submission.survivor_id;
    }
    return 'Unknown';
  };

  const sortedPlayers = useMemo(() => {
    let players = [...p100Players];
    // Always primary sort: priority (higher first) if present
    players.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
    // Then apply requested sort (excluding priority which is implicit)
    if (playerSort === 'character_asc' || playerSort === 'character_desc') {
      players.sort((a, b) => {
        const nameA = a.killers?.name || a.survivors?.name || '';
        const nameB = b.killers?.name || b.survivors?.name || '';
        const cmp = nameA.localeCompare(nameB);
        return playerSort === 'character_asc' ? cmp : -cmp;
      });
      // Keep priority dominance by re-applying stable priority ordering
      players.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
    }
    return players;
  }, [p100Players, playerSort]);

  const filteredStorageItems = storageItems.filter(item => 
      item.path.toLowerCase().includes(filePickerSearchTerm.toLowerCase())
  );

  // --- FILE PICKER FUNCTIONS ---
  const openFilePicker = (type: 'single' | 'multiple', field: 'header_url' | 'background_image_url' | 'artist_urls' | 'legacy_header_urls' | 'image_url', entityType: 'killer' | 'survivor') => {
    let defaultBucket = 'artworks';
    
    if (entityType === 'survivor' && field === 'background_image_url') {
        defaultBucket = 'survivorbackgrounds';
    } else if (field === 'background_image_url' || field === 'header_url') {
        defaultBucket = 'backgrounds';
    } else if ((entityType === 'killer' || entityType === 'survivor') && field === 'image_url') {
        defaultBucket = entityType === 'killer' ? 'killerimages' : 'survivors';
    } else if (entityType === 'killer' && field === 'legacy_header_urls') {
        defaultBucket = 'killerimages';
    } else if (entityType === 'survivor' && field === 'legacy_header_urls') {
        defaultBucket = 'survivors';
    }
    
    setFilePickerBucket(defaultBucket);
    setFilePickerMode({ type, field, entityType });
    setSelectedFiles([]);
    setFilePickerSearchTerm('');
    setShowFilePicker(true);
  };

  const selectFileForPicker = (url: string) => {
    if (!filePickerMode) return;
    if (filePickerMode.type === 'single') {
      setSelectedFiles([url]);
    } else {
      setSelectedFiles(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
    }
  };

  const applySelectedFiles = () => {
    if (!filePickerMode || selectedFiles.length === 0) return;
    const { field, entityType } = filePickerMode;
    const targetEntity = entityType === 'killer' ? editingKiller : editingSurvivor;
    const setTargetEntity = entityType === 'killer' ? setEditingKiller : setEditingSurvivor;

    if (targetEntity) {
      if (filePickerMode.type === 'multiple') {
        const currentUrls = targetEntity[field] || [];
        const mergedUrls = Array.from(new Set([...currentUrls, ...selectedFiles]));
        setTargetEntity({ ...targetEntity, [field]: mergedUrls });
      } else {
        setTargetEntity({ ...targetEntity, [field]: selectedFiles[0] });
      }
    }
    setShowFilePicker(false);
    toast({ title: 'Success', description: `${selectedFiles.length} file(s) selected for ${field.replace(/_/g, ' ')}.` });
  };
  
  const removeUrlFromField = (urlToRemove: string, field: 'artist_urls' | 'legacy_header_urls', entityType: 'killer' | 'survivor') => {
    const targetEntity = entityType === 'killer' ? editingKiller : editingSurvivor;
    const setTargetEntity = entityType === 'killer' ? setEditingKiller : setEditingSurvivor;
    if (targetEntity) {
      const currentUrls = targetEntity[field] || [];
      const updatedUrls = currentUrls.filter((url: string) => url !== urlToRemove);
      setTargetEntity({ ...targetEntity, [field]: updatedUrls });
    }
  };

  if (!isAuthenticated) {
    return (
      <BackgroundWrapper backgroundUrl="/admin.png">
        <Navigation />
        <div className="container mx-auto px-4 py-8 max-w-md">
          <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-white text-center mb-8">Admin Login</h1>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <Label htmlFor="password" className="text-white block mb-2">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black border-red-600 text-white"
                  disabled={authLoading || loginAttempts.isLocked}
                  placeholder="Enter admin password..."
                />
              </div>
              
              {loginAttempts.isLocked && (
                <div className="bg-red-900/50 border border-red-500 rounded p-3">
                  <p className="text-red-200">Account locked</p>
                  <p className="text-red-300 text-sm mt-1">Try again in {formatTime(lockoutTimeRemaining)}</p>
                </div>
              )}
              
              <Button
                type="submit"
                disabled={authLoading || loginAttempts.isLocked || !password.trim()}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {authLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </div>
        </div>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper backgroundUrl="/admin.png">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <Button onClick={handleLogout} variant="outline" className="border-red-600 text-white hover:bg-red-900">Logout</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-black border border-red-600">
            <TabsTrigger value="submissions" className="data-[state=active]:bg-red-600">Submissions</TabsTrigger>
            <TabsTrigger value="quick-artwork" className="data-[state=active]:bg-red-600">Add Artwork</TabsTrigger>
            <TabsTrigger value="quick-character" className="data-[state=active]:bg-red-600">Add Character</TabsTrigger>
            <TabsTrigger value="killers-table" className="data-[state=active]:bg-red-600">Killers</TabsTrigger>
            <TabsTrigger value="survivors-table" className="data-[state=active]:bg-red-600">Survivors</TabsTrigger>
            <TabsTrigger value="players-table" className="data-[state=active]:bg-red-600">Players</TabsTrigger>
            <TabsTrigger value="artists-table" className="data-[state=active]:bg-red-600">Artists</TabsTrigger>
            <TabsTrigger value="storage-manager" className="data-[state=active]:bg-red-600" onClick={() => { if(!storageItems.length) fetchStorageItems(selectedBucket); }}>Storage</TabsTrigger>
            <TabsTrigger value="artworks" className="data-[state=active]:bg-red-600" onClick={() => { if(!artworks.length) refreshArtworks(); }}>Artworks</TabsTrigger>
            <TabsTrigger value="blacklist" className="data-[state=active]:bg-red-600" onClick={() => { if(!blacklistedUsers.length) fetchBlacklistedUsers(); }}>Blacklist</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
              <div className="mb-6 bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Submission Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-blue-300">Total Submissions</div>
                    <div className="text-white font-bold text-lg">{submissionStats.total}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-300">Pending</div>
                    <div className="text-white font-bold text-lg">{submissionStats.pending}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-300">Approved</div>
                    <div className="text-white font-bold text-lg">{submissionStats.approved}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-300">Rejected</div>
                    <div className="text-white font-bold text-lg">{submissionStats.rejected}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label className="text-white">Filter by Type</Label>
                    <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
                        <SelectTrigger className="bg-black border-red-600 text-white w-32 ml-2"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-black border-red-600"><SelectItem value="all">All</SelectItem><SelectItem value="killer">Killers</SelectItem><SelectItem value="survivor">Survivors</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Filter by Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                        <SelectTrigger className="bg-black border-red-600 text-white w-32 ml-2"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-black border-red-600"><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Sort by Date</Label>
                    <Select value={submissionSort} onValueChange={(value) => setSubmissionSort(value as any)}>
                        <SelectTrigger className="bg-black border-red-600 text-white w-32 ml-2"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-black border-red-600"><SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Search Username</Label>
                    <Input value={submissionSearch} onChange={(e) => setSubmissionSearch(e.target.value)} placeholder="Type to filter" className="bg-black border-red-600 text-white ml-2 w-44" />
                  </div>
                </div>
                <div className="text-xs text-gray-400 ml-auto">
                  {(() => {
                    const ts = filter === 'killer' ? lastApprovedKiller : filter === 'survivor' ? lastApprovedSurvivor : lastApprovedGlobal;
                    if (!ts) return 'No approvals yet';
                    try { return `Last approval: ${new Date(ts).toLocaleString()}`; } catch { return 'Last approval: (invalid date)'; }
                  })()}
                </div>
                <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="bg-red-800 hover:bg-red-700">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Bulk Delete Processed Screenshots
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-black border-red-600">
                        <DialogHeader>
                            <DialogTitle className="text-white">Confirm Bulk Deletion</DialogTitle>
                        </DialogHeader>
                        <div className="text-gray-300">
                            <p>
                                Are you sure you want to delete all screenshots from
                                <strong> approved</strong> and <strong>rejected</strong> submissions?
                            </p>
                            <p className="mt-2 font-bold text-yellow-400">
                                This will permanently delete {' '}
                                {
                                    submissions.filter(s => (s.status === 'approved' || s.status === 'rejected') && s.screenshot_url).length
                                }{' '}
                                files. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" className="border-gray-600 text-white" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isBulkDeleting}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDeleteScreenshots}
                                disabled={isBulkDeleting}
                            >
                                {isBulkDeleting ? 'Deleting...' : 'Yes, Delete Them All'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
              </div>

              {submissionsLoading ? <div className="text-center text-white py-8">Loading submissions...</div> : (
                <>
                <div className="overflow-x-auto">
                <div className="mb-4 text-sm text-gray-400">
                  Showing {submissions.length} of {filteredSubmissionsCount} submissions
                </div>
                <Table>
                  <TableHeader><TableRow className="border-red-600"><TableHead className="text-white w-10"><input type="checkbox" className="w-4 h-4 accent-red-600" checked={submissions.filter(s => s.status === 'pending' && (!submissionSearch || s.username.toLowerCase().includes(submissionSearch.toLowerCase()))).length > 0 && submissions.filter(s => s.status === 'pending' && (!submissionSearch || s.username.toLowerCase().includes(submissionSearch.toLowerCase()))).every(s => selectedSubmissions.has(s.id))} onChange={(e) => { const pendingIds = submissions.filter(s => s.status === 'pending' && (!submissionSearch || s.username.toLowerCase().includes(submissionSearch.toLowerCase()))).map(s => s.id); if (e.target.checked) { setSelectedSubmissions(prev => { const next = new Set(prev); pendingIds.forEach(id => next.add(id)); return next; }); } else { setSelectedSubmissions(prev => { const next = new Set(prev); pendingIds.forEach(id => next.delete(id)); return next; }); } }} /></TableHead><TableHead className="text-white">Username</TableHead><TableHead className="text-white">Character</TableHead><TableHead className="text-white">Date</TableHead><TableHead className="text-white">Status</TableHead><TableHead className="text-white">Screenshot</TableHead><TableHead className="text-white">Comment</TableHead><TableHead className="text-white">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {submissions.length > 0 ? submissions
                      .filter(s => !submissionSearch || s.username.toLowerCase().includes(submissionSearch.toLowerCase()))
                      .map((submission) => (
                      <TableRow key={submission.id} className="border-red-600/20">
                        <TableCell className="w-10">
                          {submission.status === 'pending' ? (
                            <input type="checkbox" className="w-4 h-4 accent-red-600" checked={selectedSubmissions.has(submission.id)} onChange={() => toggleSubmissionSelection(submission.id)} />
                          ) : <span />}
                        </TableCell>
                        <TableCell className="text-white">
                          {editingSubmissionUsername === submission.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingSubmissionValue}
                                onChange={(e) => setEditingSubmissionValue(e.target.value)}
                                className="bg-black border-red-600 text-white h-8"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-8"
                                onClick={async () => {
                                  const newName = editingSubmissionValue.trim();
                                  if (!newName) { toast({ title: 'Validation', description: 'Username cannot be empty.', variant: 'destructive' }); return; }
                                  try {
                                    const supabase = createAdminClient();
                                    const { error } = await supabase.from('p100_submissions').update({ username: newName }).eq('id', submission.id);
                                    if (error) throw error;
                                    toast({ title: 'Updated', description: 'Username updated.' });
                                    // reflect locally
                                    setSubmissions(prev => prev.map(p => p.id === submission.id ? { ...p, username: newName } : p));
                                    setEditingSubmissionUsername(null);
                                    setEditingSubmissionValue('');
                                  } catch (err) {
                                    console.error(err);
                                    toast({ title: 'Error', description: 'Failed to update username.', variant: 'destructive' });
                                  }
                                }}
                              >Save</Button>
                              <Button size="sm" variant="outline" className="h-8 border-red-600 text-white" onClick={() => { setEditingSubmissionUsername(null); setEditingSubmissionValue(''); }}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Decode legacy stored HTML entities (&lt; &gt;) so hearts like <3 render properly */}
                              <span>{submission.username.replace(/&lt;/g, '<').replace(/&gt;/g, '>')}</span>
                              {submission.status === 'pending' && (
                                <Button size="icon" variant="outline" className="h-6 w-6 border-blue-600 text-blue-400" onClick={() => { setEditingSubmissionUsername(submission.id); setEditingSubmissionValue(submission.username); }}>
                                  <Pencil size={12} />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-white">{getCharacterName(submission)}</TableCell>
                        <TableCell className="text-white">{new Date(submission.submitted_at).toLocaleDateString()}</TableCell>
                        <TableCell><span className={`px-2 py-1 rounded text-sm ${submission.status === 'pending' ? 'bg-yellow-600 text-black' : submission.status === 'approved' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{submission.status}</span></TableCell>
                        <TableCell>
                          {submission.screenshot_url ? (
                            <a href={submission.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">View</a>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {submission.comment ? (
                            <div className="text-gray-300 text-sm">
                              {submission.comment.length > 25 ? (
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[120px]" title={submission.comment}>
                                    {submission.comment.substring(0, 25)}...
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="p-1 h-6 w-6 text-blue-400 hover:text-blue-300"
                                    onClick={() => setCommentToShow({ id: submission.id, comment: submission.comment || '' })}
                                  >
                                    <Eye size={12} />
                                  </Button>
                                </div>
                              ) : (
                                <span>{submission.comment}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {submission.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => updateSubmissionStatus(submission.id, 'approved')} className="bg-green-600 hover:bg-green-700">Approve</Button>
                                <Dialog>
                                  <DialogTrigger asChild><Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700">Reject</Button></DialogTrigger>
                                  <DialogContent className="bg-black border-red-600">
                                    <DialogHeader><DialogTitle className="text-white">Reject Submission</DialogTitle></DialogHeader>
                                    <div className="space-y-4">
                                      {submission.comment && (
                                        <div className="bg-blue-900/20 border border-blue-500 rounded p-3">
                                          <Label className="text-blue-300 text-sm font-semibold">Submitter's Comment:</Label>
                                          <p className="text-white text-sm mt-1">{submission.comment}</p>
                                        </div>
                                      )}
                                      <Label className="text-white">Rejection Reason (Optional)</Label>
                                      <Input id={`rejection-${submission.id}`} placeholder="Enter reason..." className="bg-black border-red-600 text-white" />
                                      <Button onClick={() => { const reason = (document.getElementById(`rejection-${submission.id}`) as HTMLInputElement).value; updateSubmissionStatus(submission.id, 'rejected', reason); }} className="bg-red-600 hover:bg-red-700 w-full">Confirm Rejection</Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            {(submission.status === 'approved' || submission.status === 'rejected') && submission.screenshot_url && (
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/50 hover:text-yellow-300"
                                    onClick={() => handleDeleteSubmissionScreenshot(submission)}
                                    disabled={deletingScreenshotId === submission.id}
                                >
                                  {deletingScreenshotId === submission.id ? 'Deleting...' : 'Delete IMG'}
                                </Button>
                            )}
                            {submission.status === 'rejected' && submission.rejection_reason && <div className="text-sm text-gray-400">Reason: {submission.rejection_reason}</div>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No submissions found for the selected filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
                {hasMoreSubmissions && !submissionsLoading && (
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => fetchSubmissions(false)}
                      disabled={isSubmissionsLoadingMore}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isSubmissionsLoadingMore ? 'Loading More...' : 'Load More Submissions'}
                    </Button>
                  </div>
                )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="quick-artwork" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Add Artwork</h2>
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                  <h3 className="text-blue-300 font-semibold mb-2">How to Use:</h3>
                  <ol className="text-blue-100 text-sm space-y-1 list-decimal list-inside">
                    <li>Upload your artwork file</li>
                    <li>Select which character page it belongs to</li>
                    <li>Select the artist from the database</li>
                    <li>Choose where to place it (Gallery, Header, or Legacy Header)</li>
                    <li>Click "Upload Artwork" - Done!</li>
                  </ol>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="artwork-upload" className="text-white block mb-2">Artwork File *</Label>
                      <input
                        type="file"
                        id="artwork-upload"
                        accept="image/*"
                        onChange={(e) => setArtworkUploadForm({
                          ...artworkUploadForm,
                          artworkFile: e.target.files?.[0] || null
                        })}
                        className="w-full p-3 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Character *</Label>
                      <Select 
                        value={artworkUploadForm.characterId} 
                        onValueChange={(value) => {
                          const isKiller = allKillers.some(k => k.id === value);
                          const isSurvivor = allSurvivors.some(s => s.id === value);
                          setArtworkUploadForm({
                            ...artworkUploadForm,
                            characterId: value,
                            characterType: isKiller ? 'killer' : 'survivor'
                          });
                        }}
                      >
                        <SelectTrigger className="bg-black border-red-600 text-white">
                          <SelectValue placeholder="Select character..." />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-red-600">
                          <SelectGroup>
                            <SelectLabel>Killers</SelectLabel>
                            {allKillers.map(k => (
                              <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Survivors</SelectLabel>
                            {allSurvivors.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white block mb-2">Artist *</Label>
                      <Select 
                        value={artworkUploadForm.artistId} 
                        onValueChange={(value) => {
                          const selectedArtist = artists.find(a => a.id === value);
                          setArtworkUploadForm({
                            ...artworkUploadForm,
                            artistId: value,
                            artistName: selectedArtist?.name || ''
                          });
                        }}
                      >
                        <SelectTrigger className="bg-black border-red-600 text-white">
                          <SelectValue placeholder="Select artist..." />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-red-600">
                          {artists.map(artist => (
                            <SelectItem key={artist.id} value={artist.id}>
                              {artist.name}
                              <span className="text-gray-400 ml-2">({artist.platform})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Placement</Label>
                      <Select 
                        value={artworkUploadForm.placement} 
                        onValueChange={(value: 'gallery' | 'header' | 'legacy_header') => 
                          setArtworkUploadForm({ ...artworkUploadForm, placement: value })
                        }
                      >
                        <SelectTrigger className="bg-black border-red-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-red-600">
                          <SelectItem value="gallery">Gallery (Sidebar)</SelectItem>
                          <SelectItem value="header">Header Image</SelectItem>
                          <SelectItem value="legacy_header">Legacy Header</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {artworkUploadForm.artistId && (
                  <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
                    <h4 className="text-green-300 font-semibold mb-2">Selected Artist:</h4>
                    <div className="text-green-100">
                      <p><strong>Name:</strong> {artworkUploadForm.artistName}</p>
                      <p><strong>Platform:</strong> {artists.find(a => a.id === artworkUploadForm.artistId)?.platform}</p>
                      <p><strong>URL:</strong> <a href={artists.find(a => a.id === artworkUploadForm.artistId)?.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">{artists.find(a => a.id === artworkUploadForm.artistId)?.url}</a></p>
                    </div>
                  </div>
                )}

                <div className="text-center pt-4">
                  <Button
                    onClick={uploadArtworkToCharacter}
                    disabled={uploadingArtwork || !artworkUploadForm.artworkFile || !artworkUploadForm.characterId || !artworkUploadForm.artistId}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3"
                  >
                    {uploadingArtwork ? 'Uploading Artwork...' : 'Upload Artwork'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="quick-character" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Add New Character</h2>
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
                  <h3 className="text-green-300 font-semibold mb-2">Perfect for TWD or New Chapter Releases!</h3>
                  <ol className="text-green-100 text-sm space-y-1 list-decimal list-inside">
                    <li>Enter character name and unique ID</li>
                    <li>Choose if it's a Killer or Survivor</li>
                    <li>Upload the main character image (required)</li>
                    <li>Optionally upload background, header, and artwork files</li>
                    <li>Click "Create Character" - The page will be ready!</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white block mb-2">Character Name *</Label>
                      <Input
                        value={newCharacterForm.name}
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          name: e.target.value
                        })}
                        placeholder="e.g., The Governor"
                        className="bg-black border-red-600 text-white"
                      />
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Character ID * (URL slug)</Label>
                      <Input
                        value={newCharacterForm.id}
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                        })}
                        placeholder="e.g., the-governor"
                        className="bg-black border-red-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">This will be the URL: /killers/the-governor</p>
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Character Type *</Label>
                      <Select 
                        value={newCharacterForm.type} 
                        onValueChange={(value: 'killer' | 'survivor') => 
                          setNewCharacterForm({ ...newCharacterForm, type: value })
                        }
                      >
                        <SelectTrigger className="bg-black border-red-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-red-600">
                          <SelectItem value="killer">Killer</SelectItem>
                          <SelectItem value="survivor">Survivor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-white block mb-2">Character Image * (Portrait)</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          image: e.target.files?.[0] || null
                        })}
                        className="w-full p-2 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-600 file:text-white text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Background Image (Optional)</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          backgroundImage: e.target.files?.[0] || null
                        })}
                        className="w-full p-2 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-600 file:text-white text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Header Image (Optional)</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          headerImage: e.target.files?.[0] || null
                        })}
                        className="w-full p-2 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-600 file:text-white text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-white block mb-2">Artwork Files (Optional)</Label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setNewCharacterForm({
                          ...newCharacterForm,
                          artistImages: Array.from(e.target.files || [])
                        })}
                        className="w-full p-2 border border-red-600 rounded-lg bg-black text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-red-600 file:text-white text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">You can select multiple files</p>
                    </div>
                  </div>
                </div>

                {newCharacterForm.artistImages.length > 0 && (
                  <div className="bg-black/50 rounded-lg p-4">
                    <h4 className="text-white mb-2">Selected Artwork Files:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from(newCharacterForm.artistImages).map((file, index) => (
                        <div key={index} className="text-sm text-gray-300 truncate">
                          {index + 1}. {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center pt-4">
                  <Button
                    onClick={createNewCharacter}
                    disabled={creatingCharacter}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3"
                  >
                    {creatingCharacter ? 'Creating Character...' : 'Create Character'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="killers-table" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Killers Database</h2>
                <Button onClick={() => setEditingKiller({ name: '', id: '', image_url: '', background_image_url: '', header_url: '', artist_urls: [], legacy_header_urls: [], order: allKillers.length + 1, background_credit_name: '', background_credit_url: '' })} className="bg-green-600 hover:bg-green-700">Add New Killer</Button>
              </div>
              {loading ? <div className="text-white text-center py-8">Loading...</div> : (
                <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-red-600/50"><TableHead className="text-white">Image</TableHead><TableHead className="text-white">Name</TableHead><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Order</TableHead><TableHead className="text-white">Actions</TableHead></TableRow></TableHeader><TableBody>
                  {allKillers.map((killer) => (<TableRow key={killer.id} className="border-red-600/30">
                    <TableCell>{killer.image_url && <img src={killer.image_url} alt={killer.name} className="w-12 h-12 object-cover rounded"/>}</TableCell>
                    <TableCell className="text-white">{killer.name}</TableCell><TableCell className="text-gray-400">{killer.id}</TableCell><TableCell className="text-gray-400">{killer.order || 0}</TableCell>
                    <TableCell><div className="flex gap-2"><Button onClick={() => {
                      // Only pass valid DB fields to the editing dialog
                      const { _artworks, ...dbFields } = killer;
                      setEditingKiller(dbFields);
                    }} size="sm" className="bg-blue-600 hover:bg-blue-700">Edit</Button><Button onClick={() => deleteCharacter(killer.id, 'killer')} disabled={deletingItem === killer.id} size="sm" variant="destructive">{deletingItem === killer.id ? 'Deleting...' : 'Delete'}</Button></div></TableCell>
                  </TableRow>))}
                </TableBody></Table></div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="survivors-table" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Survivors Database</h2>
                    <Button onClick={() => setEditingSurvivor({ name: '', id: '', image_url: '', background_image_url: '', header_url: '', artist_urls: [], legacy_header_urls: [], order_num: allSurvivors.length + 1, background_credit_name: '', background_credit_url: '' })} className="bg-green-600 hover:bg-green-700">Add New Survivor</Button>
                </div>
                {loading ? <div className="text-white text-center py-8">Loading...</div> : (
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-red-600/50"><TableHead className="text-white">Image</TableHead><TableHead className="text-white">Name</TableHead><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Order</TableHead><TableHead className="text-white">Actions</TableHead></TableRow></TableHeader><TableBody>
                        {allSurvivors.map((survivor) => (<TableRow key={survivor.id} className="border-red-600/30">
                            <TableCell>{survivor.image_url && <img src={survivor.image_url} alt={survivor.name} className="w-12 h-12 object-cover rounded"/>}</TableCell>
                            <TableCell className="text-white">{survivor.name}</TableCell><TableCell className="text-gray-400">{survivor.id}</TableCell><TableCell className="text-gray-400">{survivor.order_num || 0}</TableCell>
                            <TableCell><div className="flex gap-2"><Button onClick={() => {
                              const { _artworks, ...dbFields } = survivor;
                              setEditingSurvivor(dbFields);
                            }} size="sm" className="bg-blue-600 hover:bg-blue-700">Edit</Button><Button onClick={() => deleteCharacter(survivor.id, 'survivor')} disabled={deletingItem === survivor.id} size="sm" variant="destructive">{deletingItem === survivor.id ? 'Deleting...' : 'Delete'}</Button></div></TableCell>
                        </TableRow>))}
                    </TableBody></Table></div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="players-table" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">P100 Players Database</h2>
                    <Button onClick={() => setEditingPlayer({ username: '', killer_id: null, survivor_id: null, p200: false, legacy: false, favorite: false })} className="bg-green-600 hover:bg-green-700">Add New Player</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Input 
                        type="text" 
                        placeholder="Search players by username..." 
                        className="bg-black border-red-600 text-white md:col-span-1" 
                        value={playerSearchTerm} 
                        onChange={(e) => setPlayerSearchTerm(e.target.value)} 
                    />
                    <div className="md:col-span-1">
                        <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
                            <SelectTrigger className="bg-black border-red-600 text-white w-full">
                                <SelectValue placeholder="Filter by character..." />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-red-600">
                                <SelectItem value="all">All Characters</SelectItem>
                                <SelectGroup>
                                    <SelectLabel>Killers</SelectLabel>
                                    {allKillers.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>Survivors</SelectLabel>
                                    {allSurvivors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-1">
                        <Select value={playerSort} onValueChange={(value) => setPlayerSort(value as any)}>
                            <SelectTrigger className="bg-black border-red-600 text-white w-full">
                                <SelectValue placeholder="Select sort order" />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-red-600">
                                <SelectItem value="added_at_desc">Newest First</SelectItem>
                                <SelectItem value="added_at_asc">Oldest First</SelectItem>
                                <SelectItem value="username_asc">Username (A-Z)</SelectItem>
                                <SelectItem value="username_desc">Username (Z-A)</SelectItem>
                                <SelectItem value="character_asc">Character (A-Z)</SelectItem>
                                <SelectItem value="character_desc">Character (Z-A)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="overflow-x-auto relative rounded-lg border border-red-900/50">
                    {isPlayersLoading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
                        </div>
                    )}
                    <Table>
                      <TableHeader><TableRow className="border-red-600/50"><TableHead className="text-white">Username</TableHead><TableHead className="text-white">Character</TableHead><TableHead className="text-white">Type</TableHead><TableHead className="text-white">P200</TableHead><TableHead className="text-white">Legacy</TableHead><TableHead className="text-white">Favorite</TableHead><TableHead className="text-white">Priority</TableHead><TableHead className="text-white">Added</TableHead><TableHead className="text-white">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sortedPlayers.length > 0 ? sortedPlayers.map((player) => (<TableRow key={player.id} className="border-red-600/30">
                            <TableCell className="text-white font-medium">{player.username}</TableCell>
                            <TableCell className="text-gray-400">{player.killers?.name || player.survivors?.name}</TableCell>
                            <TableCell className="text-gray-400">{player.killer_id ? 'Killer' : 'Survivor'}</TableCell>
                            <TableCell><span className={`px-2 py-1 rounded text-xs text-white ${player.p200 ? 'bg-purple-600' : 'bg-gray-600'}`}>{player.p200 ? 'P200' : 'P100'}</span></TableCell>
                            <TableCell><span className={`px-2 py-1 rounded text-xs text-white ${player.legacy ? 'bg-orange-600' : 'bg-gray-600'}`}>{player.legacy ? 'Legacy' : 'Standard'}</span></TableCell>
                            <TableCell><span className={`px-2 py-1 rounded text-xs text-white ${player.favorite ? 'bg-pink-600' : 'bg-gray-600'}`}>{player.favorite ? 'Favorite' : 'Standard'}</span></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  defaultValue={player.priority ?? 0}
                                  min={0}
                                  className="w-16 bg-black border border-red-600 text-white text-xs rounded px-1 py-0.5"
                                  onBlur={async (e) => {
                                    const newVal = parseInt(e.target.value, 10);
                                    if (isNaN(newVal)) return;
                                    try {
                                      const res = await fetch('/admin-panel-x8k2m9p7/update-priority', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: player.id, priority: newVal })
                                      });
                                      const json = await res.json();
                                      if (!json.success) {
                                        console.error('Priority update failed:', json.message);
                                      } else {
                                        fetchP100Players();
                                      }
                                    } catch(err) {
                                      console.error('Priority update error', err);
                                    }
                                  }}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-400">{new Date(player.added_at).toLocaleDateString()}</TableCell>
                            <TableCell><div className="flex gap-2"><Button onClick={() => setEditingPlayer(player)} size="sm" className="bg-blue-600 hover:bg-blue-700">Edit</Button><Button onClick={() => deletePlayer(player.id)} disabled={deletingItem === player.id} size="sm" variant="destructive">{deletingItem === player.id ? 'Deleting...' : 'Delete'}</Button></div></TableCell>
                        </TableRow>)) : (
                            <TableRow><TableCell colSpan={9} className="text-center text-gray-400 py-8">No players found for the current filters.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="artists-table" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Artists Database</h2>
                    <Button onClick={() => setEditingArtist({ name: '', url: '', platform: 'twitter' })} className="bg-green-600 hover:bg-green-700">Add New Artist</Button>
                </div>
                {loading ? <div className="text-white text-center py-8">Loading...</div> : (
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-red-600/50"><TableHead className="text-white">Name</TableHead><TableHead className="text-white">Platform</TableHead><TableHead className="text-white">URL</TableHead><TableHead className="text-white">Actions</TableHead></TableRow></TableHeader><TableBody>
                        {artists.map((artist) => (<TableRow key={artist.id} className="border-red-600/30">
                            <TableCell className="text-white">{artist.name}</TableCell>
                            <TableCell className="text-gray-400 capitalize">{artist.platform}</TableCell>
                            <TableCell><a href={artist.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-xs block">{artist.url}</a></TableCell>
                            <TableCell><div className="flex gap-2"><Button onClick={() => setEditingArtist(artist)} size="sm" className="bg-blue-600 hover:bg-blue-700">Edit</Button><Button onClick={() => handleDeleteArtist(artist.id, artist.name)} disabled={deletingItem === artist.id} size="sm" variant="destructive">{deletingItem === artist.id ? 'Deleting...' : 'Delete'}</Button></div></TableCell>
                        </TableRow>))}
                    </TableBody></Table></div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="storage-manager" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Storage Manager</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div><Label className="text-white">Storage Bucket</Label><Select value={selectedBucket} onValueChange={setSelectedBucket}><SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue/></SelectTrigger><SelectContent className="bg-black border-red-600">{buckets.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-white">Upload Files to Root</Label><div className="border-2 border-dashed border-red-600/50 rounded-lg p-6 text-center cursor-pointer hover:border-red-600" onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} onClick={() => document.getElementById('file-upload')?.click()}><input id="file-upload" type="file" multiple onChange={handleFileSelect} className="hidden"/><p className="text-gray-400">{uploadingFiles.length > 0 ? `Uploading ${uploadingFiles.length} file(s)...` : 'Drag & drop or click to upload'}</p></div></div>
                    <div><Label className="text-white">Quick Actions</Label><div className="space-y-2"><Button onClick={createFolder} className="w-full bg-green-600 hover:bg-green-700">Create Folder</Button></div></div>
                </div>
                
                {loadingStorage ? (
                  <div className="text-center py-8">
                    <p className="text-white">Loading files...</p>
                  </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(storageItems.reduce((acc: { [key: string]: StorageItem[] }, item) => {
                            const folder = item.path.includes('/') ? item.path.split('/')[0] : 'Root';
                            if (!acc[folder]) acc[folder] = [];
                            acc[folder].push(item);
                            return acc;
                        }, {})).map(([folder, items]) => (
                            <div key={folder} className="bg-black/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-white text-lg font-medium">{folder} ({items.length})</h4>
                                    <div className="flex items-center gap-2">
                                        <Button onClick={() => handleFolderUploadClick(folder)} size="sm" className="bg-green-600 hover:bg-green-700 text-xs" disabled={uploadingToFolder === folder}>
                                            {uploadingToFolder === folder ? 'Uploading...' : 'Upload to folder'}
                                        </Button>
                                        <Button onClick={() => toggleFolder(folder)} size="sm" variant="outline" className="text-white border-red-600">{expandedFolders.includes(folder) ? 'Collapse' : 'Expand'}</Button>
                                    </div>
                                </div>
                                {expandedFolders.includes(folder) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {items.map(item => (
                                            <div key={item.path} className="bg-black/60 border border-red-600/30 rounded p-3 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="text-white text-sm font-medium break-all pr-2">{item.name}</h4>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <Button onClick={() => { setRenamingItem({ bucket: item.bucket, path: item.path }); setNewFileName(item.name); }} size="icon" variant="outline" className="h-6 w-6 border-blue-600 text-blue-400 hover:bg-blue-900/50"><Pencil size={12} /></Button>
                                                            <Button onClick={() => deleteStorageItem(item.bucket, item.path)} size="icon" variant="destructive" className="h-6 w-6" disabled={deletingFile === item.path}><Trash2 size={12} /></Button>
                                                        </div>
                                                    </div>
                                                    {item.publicUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) && <img src={item.publicUrl} alt={item.name} className="w-full h-20 object-cover rounded mb-2" loading="lazy"/>}
                                                    <p className="text-xs text-gray-400 truncate">Path: {item.path}</p>
                                                    <p className="text-xs text-gray-400">Size: {formatFileSize(item.size)}</p>
                                                </div>
                                                <Button onClick={() => copyToClipboard(item.publicUrl)} size="sm" className="w-full mt-2 bg-blue-600/80 hover:bg-blue-600 text-xs">Copy URL</Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </TabsContent>

          {/* ARTWORKS TAB - Character Images Manager */}
          <TabsContent value="artworks" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6 space-y-6">
              {/* Character Selector - Must select first */}
              <div className="bg-red-900/20 border border-red-600 rounded-lg p-6">
                <h3 className="text-white font-semibold mb-4">Select a Character</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Killers</Label>
                    <Select 
                      value={selectedArtworkCharacter?.type === 'killer' && selectedArtworkCharacter?.id ? selectedArtworkCharacter.id : ''}
                      onValueChange={(value) => {
                        setSelectedArtworkCharacter({ type: 'killer', id: value });
                      }}
                    >
                      <SelectTrigger className="bg-black border-red-600 text-white mt-1">
                        <SelectValue placeholder="Select a killer..." />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-red-600">
                        {allKillers.map(k => (
                          <SelectItem key={k.id} value={k.id} className="text-white">
                            {k.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Survivors</Label>
                    <Select 
                      value={selectedArtworkCharacter?.type === 'survivor' && selectedArtworkCharacter?.id ? selectedArtworkCharacter.id : ''}
                      onValueChange={(value) => {
                        setSelectedArtworkCharacter({ type: 'survivor', id: value });
                      }}
                    >
                      <SelectTrigger className="bg-black border-red-600 text-white mt-1">
                        <SelectValue placeholder="Select a survivor..." />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-red-600">
                        {allSurvivors.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-white">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedArtworkCharacter && (
                  <Button
                    onClick={() => setSelectedArtworkCharacter(null)}
                    variant="outline"
                    className="border-red-600 text-red-400 hover:bg-red-600/20 mt-4"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>

              {/* Content only shows if character is selected */}
              {selectedArtworkCharacter ? (
                <>
                  {/* Search and Controls */}
                  <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm p-4 border border-red-600/20 rounded-lg">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <input 
                          id="toggle-previews" 
                          type="checkbox" 
                          className="accent-red-600" 
                          checked={showArtworkPreviews} 
                          onChange={(e)=> setShowArtworkPreviews(e.target.checked)} 
                        />
                        <Label htmlFor="toggle-previews" className="text-white text-sm">Show thumbnails</Label>
                      </div>
                      <Button 
                        variant="outline" 
                        className="border-blue-600 text-blue-300 hover:bg-blue-600/20" 
                        onClick={() => fetchAllCharacters()} 
                        disabled={artworksLoading}
                      >
                        Refresh
                      </Button>
                      <div className="text-xs text-gray-400">
                        Character artwork management
                      </div>
                    </div>
                  </div>

                  {artworksLoading && <div className="text-white text-center py-8">Loading...</div>}

                  {/* Show only the selected character's artworks */}
                  {(() => {
                    const selectedCharacter = selectedArtworkCharacter.type === 'killer' 
                      ? allKillers.find(k => k.id === selectedArtworkCharacter.id)
                      : allSurvivors.find(s => s.id === selectedArtworkCharacter.id);
                    
                    if (!selectedCharacter) return null;
                    
                    return (
                      <div className="space-y-6">
                        <div className="bg-black/40 border border-red-600/20 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-mono text-white">
                              {selectedCharacter.name}
                              <span className="text-sm text-gray-400 ml-2">({selectedArtworkCharacter.type})</span>
                            </h2>
                            <Button
                              onClick={() => setAddArtworkCharacter({ type: selectedArtworkCharacter.type, character: selectedCharacter })}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              + Add Artwork
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {selectedCharacter._artworks && selectedCharacter._artworks.length > 0 ? (
                              selectedCharacter._artworks.map((artwork: any, idx: number) => {
                                const artistName = artworkArtists[artwork.artwork_url];
                                return (
                                  <div key={idx} className="space-y-2">
                                    {/* Artwork Image */}
                                    {showArtworkPreviews && (
                                      <div className="relative aspect-square overflow-hidden rounded-lg bg-black/20 group">
                                        <img
                                          src={artwork.artwork_url}
                                          alt={`Artwork by ${artistName || 'Unknown'}`}
                                          className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        {/* Usage Badge */}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white">
                                          {artwork.usage_type}
                                        </div>
                                        {/* Delete Button */}
                                        <button
                                          onClick={async () => {
                                            if (!confirm(`Delete this ${artwork.usage_type} artwork?`)) return;
                                            
                                            try {
                                              const supabaseAdmin = createAdminClient();
                                              
                                              // Delete from character_artworks (this is the link)
                                              const { error } = await supabaseAdmin
                                                .from('character_artworks')
                                                .delete()
                                                .eq('character_id', selectedCharacter.id)
                                                .eq('character_type', selectedArtworkCharacter.type)
                                                .eq('artwork_id', artwork.artwork_id);
                                              
                                              if (error) throw error;
                                              
                                              toast({
                                                title: 'Deleted',
                                                description: 'Artwork removed successfully'
                                              });
                                              
                                              await fetchAllCharacters();
                                            } catch (err: any) {
                                              console.error('Error deleting artwork:', err);
                                              toast({
                                                title: 'Error',
                                                description: 'Failed to delete artwork',
                                                variant: 'destructive'
                                              });
                                            }
                                          }}
                                          className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Delete artwork"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                    
                                    {/* Artist Dropdown - NO RELOAD ON UPDATE */}
                                    <Select
                                      value={artists.find(a => a.name === artistName)?.id || 'none'}
                                      onValueChange={async (value) => {
                                        setUpdatingArtist(artwork.artwork_url);
                                        
                                        try {
                                          const selectedArtist = value !== 'none' ? artists.find(a => a.id === value) : null;
                                          const supabaseAdmin = createAdminClient();
                                          
                                          // Update artwork in database (without reloading page)
                                          const { error } = await supabaseAdmin
                                            .from('artworks')
                                            .upsert({
                                              artwork_url: artwork.artwork_url,
                                              artist_name: selectedArtist?.name || null,
                                              artist_url: selectedArtist ? (selectedArtist as any).url : null,
                                              platform: selectedArtist ? (selectedArtist as any).platform : null,
                                              updated_at: new Date().toISOString()
                                            }, {
                                              onConflict: 'artwork_url',
                                              ignoreDuplicates: false
                                            });
                                          
                                          if (error) {
                                            console.error('Error updating artwork artist:', error);
                                            toast({ 
                                              title: 'Error', 
                                              description: 'Failed to update artist',
                                              variant: 'destructive'
                                            });
                                            setUpdatingArtist(null);
                                            return;
                                          }
                                          
                                          // Update local state ONLY - NO RELOAD
                                          setArtworkArtists(prev => ({ ...prev, [artwork.artwork_url]: selectedArtist?.name || null }));
                                          toast({ 
                                            title: 'Updated', 
                                            description: selectedArtist ? `Artist set to ${selectedArtist.name}` : 'Artist cleared'
                                          });
                                          setUpdatingArtist(null);
                                        } catch (err) {
                                          console.error('Error updating artist:', err);
                                          toast({ 
                                            title: 'Error', 
                                            description: 'Failed to update artist',
                                            variant: 'destructive'
                                          });
                                          setUpdatingArtist(null);
                                        }
                                      }}
                                      disabled={updatingArtist === artwork.artwork_url}
                                    >
                                      <SelectTrigger className="w-full bg-black/40 border-red-600/20 text-white h-8 text-xs hover:border-red-600/40">
                                        <SelectValue placeholder={updatingArtist === artwork.artwork_url ? 'Updating...' : 'Unknown Artist'} />
                                      </SelectTrigger>
                                      <SelectContent className="bg-black border-red-600">
                                        <SelectItem value="none" className="text-white">Unknown Artist</SelectItem>
                                        {artists.map(artist => (
                                          <SelectItem key={artist.id} value={artist.id} className="text-white">
                                            {artist.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    
                                    {/* Artist Link */}
                                    {artistName && (
                                      <div className="text-xs text-blue-400 truncate" title={artistName}>
                                        {artistName}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="col-span-full text-center text-gray-400 py-8">
                                No artworks for this character
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center text-gray-400 py-12">
                  <p className="text-lg">👆 Select a character to view and manage their artworks</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Blacklist Tab */}
          {/* Floating bulk action bar */}
          {selectedSubmissions.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-red-600 rounded-lg px-6 py-3 flex items-center gap-4 shadow-2xl backdrop-blur-sm">
              <span className="text-white font-semibold">{selectedSubmissions.size} selected</span>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={isBulkProcessing} onClick={() => bulkUpdateSubmissions('approved')}>
                {isBulkProcessing ? 'Processing...' : 'Accept All'}
              </Button>
              <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700" disabled={isBulkProcessing}>Decline All</Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-red-600">
                  <DialogHeader><DialogTitle className="text-white">Reject {selectedSubmissions.size} Submissions</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Label className="text-white">Rejection Reason (Optional)</Label>
                    <Input value={bulkRejectReason} onChange={(e) => setBulkRejectReason(e.target.value)} placeholder="Enter reason..." className="bg-black border-red-600 text-white" />
                    <Button onClick={() => bulkUpdateSubmissions('rejected', bulkRejectReason)} className="bg-red-600 hover:bg-red-700 w-full" disabled={isBulkProcessing}>
                      {isBulkProcessing ? 'Processing...' : 'Confirm Rejection'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <button onClick={() => setSelectedSubmissions(new Set())} className="text-gray-400 hover:text-white ml-2 text-lg font-bold" title="Clear selection">✕</button>
            </div>
          )}

          <TabsContent value="blacklist" className="space-y-6">
            <div className="bg-black/80 backdrop-blur-sm border border-red-600 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">User Blacklist</h2>
              
              {/* Add to Blacklist */}
              <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
                <h3 className="text-white font-semibold mb-3">Add User to Blacklist</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white">Username</Label>
                    <Input
                      value={newBlacklistUsername}
                      onChange={(e) => setNewBlacklistUsername(e.target.value)}
                      placeholder="Enter username"
                      className="bg-black border-red-600 text-white mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-white">Reason (Optional)</Label>
                    <Input
                      value={newBlacklistReason}
                      onChange={(e) => setNewBlacklistReason(e.target.value)}
                      placeholder="e.g., Farming, Spam, etc."
                      className="bg-black border-red-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBlacklistSuper}
                      onChange={(e) => setNewBlacklistSuper(e.target.checked)}
                      className="w-4 h-4 accent-red-600"
                    />
                    <span className="text-red-300 text-sm font-semibold">Super Blacklist</span>
                    <span className="text-gray-400 text-xs">(blocks any name containing this username)</span>
                  </label>
                  <Button
                    onClick={addToBlacklist}
                    disabled={isAddingToBlacklist || !newBlacklistUsername.trim()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isAddingToBlacklist ? 'Adding...' : 'Add to Blacklist'}
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <Input
                  value={blacklistSearch}
                  onChange={(e) => setBlacklistSearch(e.target.value)}
                  placeholder="Search blacklisted users..."
                  className="bg-black border-red-600 text-white"
                />
              </div>

              {/* Blacklist Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-red-600">
                      <th className="text-left text-white p-3">Username</th>
                      <th className="text-center text-white p-3">Super</th>
                      <th className="text-left text-white p-3">Reason</th>
                      <th className="text-left text-white p-3">Added</th>
                      <th className="text-left text-white p-3">Added By</th>
                      <th className="text-right text-white p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklistedUsers
                      .filter((user) =>
                        blacklistSearch
                          ? user.username.toLowerCase().includes(blacklistSearch.toLowerCase()) ||
                            (user.reason && user.reason.toLowerCase().includes(blacklistSearch.toLowerCase()))
                          : true
                      )
                      .map((user) => (
                        <tr key={user.id} className="border-b border-red-600/30">
                          <td className="text-white p-3 font-mono">
                            {user.username}
                            {user.is_super && <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-xs rounded font-sans">SUPER</span>}
                          </td>
                          <td className="text-center p-3">
                            <input
                              type="checkbox"
                              checked={user.is_super || false}
                              onChange={() => toggleBlacklistSuper(user.id, user.is_super || false)}
                              className="w-4 h-4 accent-red-600 cursor-pointer"
                              title={user.is_super ? 'Disable super blacklist' : 'Enable super blacklist'}
                            />
                          </td>
                          <td className="text-gray-300 p-3">{user.reason || '-'}</td>
                          <td className="text-gray-400 p-3 text-sm">
                            {new Date(user.created_at).toLocaleString()}
                          </td>
                          <td className="text-gray-400 p-3 text-sm">{user.created_by || '-'}</td>
                          <td className="text-right p-3">
                            <Button
                              onClick={() => removeFromBlacklist(user.id, user.username)}
                              variant="outline"
                              size="sm"
                              className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {blacklistedUsers.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No blacklisted users yet.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* DIALOGS (MODALS) */}
        {editingKiller && (
            <Dialog open={!!editingKiller} onOpenChange={() => setEditingKiller(null)}>
                <DialogContent className="bg-black border-red-600 max-w-2xl h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0"><DialogTitle className="text-white">{editingKiller.id ? 'Edit Killer' : 'Add New Killer'}</DialogTitle></DialogHeader>
                    <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                        <div><Label className="text-white">Name</Label><Input value={editingKiller.name} onChange={(e) => setEditingKiller({...editingKiller, name: e.target.value})} className="bg-black border-red-600 text-white"/></div>
                        <div><Label className="text-white">ID</Label><Input value={editingKiller.id} onChange={(e) => setEditingKiller({...editingKiller, id: e.target.value})} className="bg-black border-red-600 text-white" disabled={!!editingKiller.created_at}/></div>
                        <div><Label className="text-white">Image URL</Label><div className="flex gap-2"><Input value={editingKiller.image_url || ''} onChange={(e) => setEditingKiller({...editingKiller, image_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'image_url', 'killer')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div><Label className="text-white">Background URL</Label><div className="flex gap-2"><Input value={editingKiller.background_image_url || ''} onChange={(e) => setEditingKiller({...editingKiller, background_image_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'background_image_url', 'killer')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div><Label className="text-white">Header URL</Label><div className="flex gap-2"><Input value={editingKiller.header_url || ''} onChange={(e) => setEditingKiller({...editingKiller, header_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'header_url', 'killer')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-white">Background Credit Name</Label>
                            <Input value={editingKiller.background_credit_name || ''} onChange={(e) => setEditingKiller({...editingKiller, background_credit_name: e.target.value})} placeholder="e.g. ArtistName" className="bg-black border-red-600 text-white"/>
                          </div>
                          <div>
                            <Label className="text-white">Background Credit URL</Label>
                            <Input value={editingKiller.background_credit_url || ''} onChange={(e) => setEditingKiller({...editingKiller, background_credit_url: e.target.value})} placeholder="https://..." className="bg-black border-red-600 text-white"/>
                            {editingKiller.background_credit_url && !/^https?:\/\//i.test(editingKiller.background_credit_url) && (
                              <p className="text-xs text-amber-400 mt-1">URL should start with http:// or https://</p>
                            )}
                          </div>
                        </div>
                        <div><Label className="text-white">Artist URLs</Label><Button onClick={() => openFilePicker('multiple', 'artist_urls', 'killer')} className="bg-blue-600 hover:bg-blue-700 w-full mb-2" type="button">Add Artist URLs</Button><div className="max-h-32 overflow-y-auto space-y-1 rounded border border-red-800 p-2 bg-black/50">{(editingKiller.artist_urls || []).map((url: string, i: number) => <div key={i} className="flex items-center gap-2 text-sm text-gray-300"><span className="truncate flex-1">{url}</span><Button onClick={() => removeUrlFromField(url, 'artist_urls', 'killer')} size="sm" variant="destructive" className="h-6 w-6 p-0">X</Button></div>)}</div></div>
                        <div><Label className="text-white">Legacy Header URLs</Label><Button onClick={() => openFilePicker('multiple', 'legacy_header_urls', 'killer')} className="bg-blue-600 hover:bg-blue-700 w-full mb-2" type="button">Add Legacy URLs</Button><div className="max-h-32 overflow-y-auto space-y-1 rounded border border-red-800 p-2 bg-black/50">{(editingKiller.legacy_header_urls || []).map((url: string, i: number) => <div key={i} className="flex items-center gap-2 text-sm text-gray-300"><span className="truncate flex-1">{url}</span><Button onClick={() => removeUrlFromField(url, 'legacy_header_urls', 'killer')} size="sm" variant="destructive" className="h-6 w-6 p-0">X</Button></div>)}</div></div>
                        <div><Label className="text-white">Order</Label><Input type="number" value={editingKiller.order || 0} onChange={(e) => setEditingKiller({...editingKiller, order: parseInt(e.target.value)})} className="bg-black border-red-600 text-white"/></div>
                    </div>
                    <div className="flex-shrink-0 pt-4 border-t border-red-600/50">
                        <div className="flex gap-2"><Button onClick={() => saveKiller(editingKiller)} className="bg-green-600 hover:bg-green-700">Save</Button><Button onClick={() => setEditingKiller(null)} variant="outline" className="border-red-600 text-white hover:bg-red-900">Cancel</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {editingSurvivor && (
            <Dialog open={!!editingSurvivor} onOpenChange={() => setEditingSurvivor(null)}>
                <DialogContent className="bg-black border-red-600 max-w-2xl h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0"><DialogTitle className="text-white">{editingSurvivor.id ? 'Edit Survivor' : 'Add New Survivor'}</DialogTitle></DialogHeader>
                    <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                        <div><Label className="text-white">Name</Label><Input value={editingSurvivor.name} onChange={(e) => setEditingSurvivor({...editingSurvivor, name: e.target.value})} className="bg-black border-red-600 text-white"/></div>
                        <div><Label className="text-white">ID</Label><Input value={editingSurvivor.id} onChange={(e) => setEditingSurvivor({...editingSurvivor, id: e.target.value})} className="bg-black border-red-600 text-white" disabled={!!editingSurvivor.created_at}/></div>
                        <div><Label className="text-white">Image URL</Label><div className="flex gap-2"><Input value={editingSurvivor.image_url || ''} onChange={(e) => setEditingSurvivor({...editingSurvivor, image_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'image_url', 'survivor')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div><Label className="text-white">Background URL</Label><div className="flex gap-2"><Input value={editingSurvivor.background_image_url || ''} onChange={(e) => setEditingSurvivor({...editingSurvivor, background_image_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'background_image_url', 'survivor')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div><Label className="text-white">Header URL</Label><div className="flex gap-2"><Input value={editingSurvivor.header_url || ''} onChange={(e) => setEditingSurvivor({...editingSurvivor, header_url: e.target.value})} className="bg-black border-red-600 text-white flex-1"/><Button onClick={() => openFilePicker('single', 'header_url', 'survivor')} className="bg-blue-600 hover:bg-blue-700" type="button">Browse</Button></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-white">Background Credit Name</Label>
                            <Input value={editingSurvivor.background_credit_name || ''} onChange={(e) => setEditingSurvivor({...editingSurvivor, background_credit_name: e.target.value})} placeholder="e.g. ArtistName" className="bg-black border-red-600 text-white"/>
                          </div>
                          <div>
                            <Label className="text-white">Background Credit URL</Label>
                            <Input value={editingSurvivor.background_credit_url || ''} onChange={(e) => setEditingSurvivor({...editingSurvivor, background_credit_url: e.target.value})} placeholder="https://..." className="bg-black border-red-600 text-white"/>
                            {editingSurvivor.background_credit_url && !/^https?:\/\//i.test(editingSurvivor.background_credit_url) && (
                              <p className="text-xs text-amber-400 mt-1">URL should start with http:// or https://</p>
                            )}
                          </div>
                        </div>
                        <div><Label className="text-white">Artist URLs</Label><Button onClick={() => openFilePicker('multiple', 'artist_urls', 'survivor')} className="bg-blue-600 hover:bg-blue-700 w-full mb-2" type="button">Add Artist URLs</Button><div className="max-h-32 overflow-y-auto space-y-1 rounded border border-red-800 p-2 bg-black/50">{(editingSurvivor.artist_urls || []).map((url: string, i: number) => <div key={i} className="flex items-center gap-2 text-sm text-gray-300"><span className="truncate flex-1">{url}</span><Button onClick={() => removeUrlFromField(url, 'artist_urls', 'survivor')} size="sm" variant="destructive" className="h-6 w-6 p-0">X</Button></div>)}</div></div>
                        <div><Label className="text-white">Legacy Header URLs</Label><Button onClick={() => openFilePicker('multiple', 'legacy_header_urls', 'survivor')} className="bg-blue-600 hover:bg-blue-700 w-full mb-2" type="button">Add Legacy URLs</Button><div className="max-h-32 overflow-y-auto space-y-1 rounded border border-red-800 p-2 bg-black/50">{(editingSurvivor.legacy_header_urls || []).map((url: string, i: number) => <div key={i} className="flex items-center gap-2 text-sm text-gray-300"><span className="truncate flex-1">{url}</span><Button onClick={() => removeUrlFromField(url, 'legacy_header_urls', 'survivor')} size="sm" variant="destructive" className="h-6 w-6 p-0">X</Button></div>)}</div></div>
                        <div><Label className="text-white">Order</Label><Input type="number" value={editingSurvivor.order_num || 0} onChange={(e) => setEditingSurvivor({...editingSurvivor, order_num: parseInt(e.target.value)})} className="bg-black border-red-600 text-white"/></div>
                    </div>
                     <div className="flex-shrink-0 pt-4 border-t border-red-600/50">
                        <div className="flex gap-2"><Button onClick={() => saveSurvivor(editingSurvivor)} className="bg-green-600 hover:bg-green-700">Save</Button><Button onClick={() => setEditingSurvivor(null)} variant="outline" className="border-red-600 text-white hover:bg-red-900">Cancel</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {editingPlayer && (
            <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
                <DialogContent className="bg-black border-red-600 max-w-lg"><DialogHeader><DialogTitle className="text-white">{editingPlayer.id ? 'Edit Player' : 'Add New Player'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label className="text-white">Username</Label><Input value={editingPlayer.username} onChange={(e) => setEditingPlayer({...editingPlayer, username: e.target.value})} className="bg-black border-red-600 text-white"/></div>
                        <div><Label className="text-white">Character</Label>
                            <Select 
                                value={editingPlayer.killer_id || editingPlayer.survivor_id || ''} 
                                onValueChange={(value) => {
                                    const isKiller = allKillers.some(k => k.id === value);
                                    setEditingPlayer({
                                        ...editingPlayer, 
                                        killer_id: isKiller ? value : null, 
                                        survivor_id: !isKiller ? value : null
                                    });
                                }}
                            >
                                <SelectTrigger className="bg-black border-red-600 text-white"><SelectValue placeholder="Select character"/></SelectTrigger>
                                <SelectContent className="bg-black border-red-600">
                                    <SelectGroup>
                                        <SelectLabel>Killers</SelectLabel>
                                        {allKillers.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectGroup>
                                        <SelectLabel>Survivors</SelectLabel>
                                        {allSurvivors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-2"><input type="checkbox" id="p200" checked={!!editingPlayer.p200} onChange={(e) => setEditingPlayer({...editingPlayer, p200: e.target.checked})} /><Label htmlFor="p200" className="text-white">P200 Status</Label></div>
                        <div className="flex items-center space-x-2"><input type="checkbox" id="legacy" checked={!!editingPlayer.legacy} onChange={(e) => setEditingPlayer({...editingPlayer, legacy: e.target.checked})} /><Label htmlFor="legacy" className="text-white">Legacy Status</Label></div>
                        <div className="flex items-center space-x-2"><input type="checkbox" id="favorite" checked={!!editingPlayer.favorite} onChange={(e) => setEditingPlayer({...editingPlayer, favorite: e.target.checked})} /><Label htmlFor="favorite" className="text-white">Favorite Status</Label></div>
                        <div className="flex gap-2"><Button onClick={() => savePlayer(editingPlayer)} className="bg-green-600 hover:bg-green-700">Save</Button><Button onClick={() => setEditingPlayer(null)} variant="outline" className="border-red-600 text-white hover:bg-red-900">Cancel</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {editingArtist && (
            <Dialog open={!!editingArtist} onOpenChange={() => setEditingArtist(null)}>
                <DialogContent className="bg-black border-red-600 max-w-lg"><DialogHeader><DialogTitle className="text-white">{editingArtist.id ? 'Edit Artist' : 'Add New Artist'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label className="text-white">Name</Label><Input value={editingArtist.name} onChange={(e) => setEditingArtist({...editingArtist, name: e.target.value})} className="bg-black border-red-600 text-white"/></div>
                        <div><Label className="text-white">Platform</Label>
                            <Select value={editingArtist.platform} onValueChange={(value) => setEditingArtist({...editingArtist, platform: value})}>
                                <SelectTrigger className="bg-black border-red-600 text-white"><SelectValue/></SelectTrigger>
                                <SelectContent className="bg-black border-red-600"><SelectItem value="twitter">Twitter</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="youtube">YouTube</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-white">URL</Label><Input value={editingArtist.url} onChange={(e) => setEditingArtist({...editingArtist, url: e.target.value})} className="bg-black border-red-600 text-white"/></div>
                        <div className="flex gap-2"><Button onClick={() => saveArtist(editingArtist)} className="bg-green-600 hover:bg-green-700">Save</Button><Button onClick={() => setEditingArtist(null)} variant="outline" className="border-red-600 text-white hover:bg-red-900">Cancel</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {/* Removed orphaned Artworks TabsContent (now inside <Tabs>) */}

        {showFilePicker && filePickerMode && (
          <Dialog open={showFilePicker} onOpenChange={() => setShowFilePicker(false)}>
            <DialogContent className="bg-black border-red-600 max-w-6xl w-full h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-white">Select Files: {filePickerMode.field.replace(/_/g, ' ')}</DialogTitle>
                </DialogHeader>
                <div className="flex-shrink-0 p-4 border-b border-red-600/50 space-y-4">
                    <div>
                      <Label className="text-white">Bucket</Label>
                      <Select value={filePickerBucket} onValueChange={setFilePickerBucket}>
                          <SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-black border-red-600">{buckets.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white">Search Files</Label>
                      <Input 
                          type="text" 
                          placeholder="Search by name or path..." 
                          className="bg-black border-red-600 text-white mt-1 w-full" 
                          value={filePickerSearchTerm} 
                          onChange={(e) => setFilePickerSearchTerm(e.target.value)} 
                      />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {loadingStorage ? (
                      <div className="text-center py-8">
                        <p className="text-white">Loading files...</p>
                      </div>
                    ) : (
                      Object.entries(filteredStorageItems.reduce((acc, item) => {
                          const folder = item.path.includes('/') ? item.path.split('/')[0] : 'Root';
                          if (!acc[folder]) acc[folder] = [];
                          acc[folder].push(item);
                          return acc;
                      }, {} as { [key: string]: StorageItem[] })).map(([folder, items]) => (
                          <div key={folder}>
                              <h4 className="text-white text-lg font-medium mb-2 sticky top-0 bg-black/80 backdrop-blur-sm py-1">{folder}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {items.map((item) => {
                                      const isSelected = selectedFiles.includes(item.publicUrl);
                                      return (
                                          <div key={item.path} onClick={() => selectFileForPicker(item.publicUrl)} className={`p-2 rounded border-2 cursor-pointer transition-all relative group ${isSelected ? 'border-green-500 bg-green-900/40' : 'border-red-600/30 bg-black/60 hover:border-red-500'}`}>
                                              {item.publicUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) && <img src={item.publicUrl} alt={item.name} className="w-full h-24 object-cover rounded mb-2"/>}
                                              <h4 className="text-white text-xs font-medium truncate" title={item.name.split('/').pop() || item.name}>{item.name.split('/').pop() || item.name}</h4>
                                              <Button onClick={(e) => { e.stopPropagation(); setRenamingItem({ bucket: item.bucket, path: item.path }); setNewFileName(item.name); }} size="icon" variant="outline" className="absolute top-1 right-1 h-6 w-6 border-blue-600 text-blue-400 hover:bg-blue-900/50 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12} /></Button>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ))
                    )}
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-red-600/50 flex-shrink-0">
                    <Button onClick={() => setShowFilePicker(false)} variant="outline" className="border-red-600 text-white hover:bg-red-900">Cancel</Button>
                    <Button onClick={applySelectedFiles} className="bg-green-600 hover:bg-green-700" disabled={selectedFiles.length === 0}>Apply Selection ({selectedFiles.length})</Button>
                </div>
            </DialogContent>
          </Dialog>
        )}

        {renamingItem && (
            <Dialog open={!!renamingItem} onOpenChange={() => setRenamingItem(null)}>
                <DialogContent className="bg-black border-red-600 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-white">Rename File</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-white">Current Path</Label>
                            <p className="text-sm text-gray-400 break-all">{renamingItem.path}</p>
                        </div>
                        <div>
                            <Label htmlFor="new-filename" className="text-white">New File Name</Label>
                            <Input id="new-filename" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className="bg-black border-red-600 text-white" onKeyDown={(e) => e.key === 'Enter' && !isRenaming && handleRename()}/>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setRenamingItem(null)} variant="outline" className="border-red-600 text-white hover:bg-red-900" disabled={isRenaming}>Cancel</Button>
                            <Button onClick={handleRename} className="bg-blue-600 hover:bg-blue-700" disabled={isRenaming}>{isRenaming ? 'Renaming...' : 'Rename'}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )}

        {commentToShow && (
            <Dialog open={!!commentToShow} onOpenChange={() => setCommentToShow(null)}>
                <DialogContent className="bg-black border-red-600 max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Full Comment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 max-h-80 overflow-y-auto">
                            <p className="text-white whitespace-pre-wrap break-words leading-relaxed">
                                {commentToShow.comment}
                            </p>
                        </div>
                        <div className="flex justify-end">
                            <Button 
                                onClick={() => setCommentToShow(null)} 
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )}
        {showNewArtworkDialog && (
          <Dialog open={showNewArtworkDialog} onOpenChange={() => { if(!isCreatingArtwork) { setShowNewArtworkDialog(false); } }}>
            <DialogContent className="bg-black border-red-600 max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Artwork</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Artwork File *</Label>
                  <input type="file" accept="image/*" onChange={(e)=> setNewArtworkFile(e.target.files?.[0] || null)} className="mt-1 text-white" />
                  {newArtworkFile && <p className="text-xs text-gray-400 mt-1">Selected: {newArtworkFile.name}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Artist</Label>
                    <Select value={newArtworkArtistId || '__none'} onValueChange={(v)=> setNewArtworkArtistId(v === '__none' ? '' : v)}>
                      <SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue placeholder="(None)" /></SelectTrigger>
                      <SelectContent className="bg-black border-red-600 max-h-72 overflow-y-auto">
                        <SelectItem value="__none">(None)</SelectItem>
                        {artists.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Character Type</Label>
                    <Select value={newArtworkCharacterType} onValueChange={(v)=> { setNewArtworkCharacterType(v as 'killer'|'survivor'); setNewArtworkCharacterId(''); }}>
                      <SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-black border-red-600">
                        <SelectItem value="killer">Killer</SelectItem>
                        <SelectItem value="survivor">Survivor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-white">Character *</Label>
                  <Select value={newArtworkCharacterId} onValueChange={setNewArtworkCharacterId}>
                    <SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue placeholder="Select character" /></SelectTrigger>
                    <SelectContent className="bg-black border-red-600 max-h-72 overflow-y-auto">
                      {(newArtworkCharacterType === 'killer' ? allKillers : allSurvivors).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-white">Placement *</Label>
                  <Select value={newArtworkPlacement} onValueChange={(v)=> setNewArtworkPlacement(v as any)}>
                    <SelectTrigger className="bg-black border-red-600 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-black border-red-600">
                      <SelectItem value="gallery">Gallery (artist_urls)</SelectItem>
                      <SelectItem value="header">Header (header_url)</SelectItem>
                      <SelectItem value="legacy_header">Legacy Header (legacy_header_urls)</SelectItem>
                      <SelectItem value="background">Background (background_image_url)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="border-red-600 text-white" disabled={isCreatingArtwork} onClick={()=> {
                    setShowNewArtworkDialog(false);
                    setNewArtworkFile(null);
                    setNewArtworkCharacterId('');
                    setNewArtworkPlacement('gallery');
                  }}>Cancel</Button>
                  <Button className="bg-green-600 hover:bg-green-700" disabled={isCreatingArtwork || !newArtworkFile || !newArtworkCharacterId} onClick={async ()=> {
                    setIsCreatingArtwork(true);
                    try {
                      const supabaseAdmin = createAdminClient();
                      const tableName = newArtworkCharacterType === 'killer' ? 'killers' : 'survivors';
                      const { data: character, error: fetchErr } = await supabaseAdmin.from(tableName).select('*').eq('id', newArtworkCharacterId).single();
                      if (fetchErr) throw fetchErr;
                      // Confirm overwrite for single-value placements
                      if ((newArtworkPlacement === 'header' && character.header_url) || (newArtworkPlacement === 'background' && character.background_image_url)) {
                        const proceed = confirm(`This will replace the existing ${newArtworkPlacement} image. Continue?`);
                        if(!proceed) { setIsCreatingArtwork(false); return; }
                      }
                      const timestamp = Date.now();
                      const ext = newArtworkFile!.name.split('.').pop();
                      const fileName = `${newArtworkCharacterId}-${timestamp}.${ext}`;
                      const publicUrl = await uploadImageToStorage(newArtworkFile!, 'artworks', fileName);
                      // Update character field
                      let updatePayload: any = {};
                      if (newArtworkPlacement === 'gallery') {
                        const arr = character.artist_urls || [];
                        updatePayload.artist_urls = [...arr, publicUrl];
                      } else if (newArtworkPlacement === 'legacy_header') {
                        const arr = character.legacy_header_urls || [];
                        updatePayload.legacy_header_urls = [...arr, publicUrl];
                      } else if (newArtworkPlacement === 'header') {
                        updatePayload.header_url = publicUrl;
                      } else if (newArtworkPlacement === 'background') {
                        updatePayload.background_image_url = publicUrl;
                      }
                      if (Object.keys(updatePayload).length) {
                        const { error: updErr } = await supabaseAdmin.from(tableName).update(updatePayload).eq('id', newArtworkCharacterId);
                        if (updErr) throw updErr;
                      }
                      toast({ title: 'Success', description: 'Artwork added successfully!' });
                      // Reset and close
                      setNewArtworkFile(null);
                      setNewArtworkCharacterId('');
                      setNewArtworkPlacement('gallery');
                      setShowNewArtworkDialog(false);
                      await fetchAllCharacters();
                    } catch(err:any) {
                      console.error(err);
                      toast({ title: 'Error', description: err.message || 'Failed to add artwork', variant: 'destructive'});
                    } finally { setIsCreatingArtwork(false); }
                  }}>{isCreatingArtwork ? 'Uploading...' : 'Add Artwork'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Add Artwork to Character Dialog */}
        {addArtworkCharacter && (
          <Dialog open={!!addArtworkCharacter} onOpenChange={() => {
            if (!isAddingArtwork) {
              setAddArtworkCharacter(null);
              setNewArtworkUrl('');
              setNewArtworkUsageType('gallery');
              setNewArtworkArtist('none');
            }
          }}>
            <DialogContent className="bg-black border-red-600 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Add Artwork to {addArtworkCharacter.character.name}
                </DialogTitle>
                <p className="text-gray-400 text-sm">
                  {addArtworkCharacter.type === 'killer' ? 'Killer' : 'Survivor'}
                </p>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Upload Method *</Label>
                  <p className="text-xs text-gray-400 mb-2">Choose to upload a file or provide a URL</p>
                </div>
                
                <div>
                  <Label className="text-white">Upload File</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setNewArtworkFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) {
                        setNewArtworkUrl(''); // Clear URL if file is selected
                      }
                    }}
                    className="mt-1 text-white w-full"
                  />
                  {newArtworkFile && (
                    <p className="text-xs text-green-400 mt-1">
                      Selected: {newArtworkFile.name}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-600"></div>
                  <span className="text-gray-400 text-sm">OR</span>
                  <div className="flex-1 border-t border-gray-600"></div>
                </div>
                
                <div>
                  <Label className="text-white">Artwork URL</Label>
                  <Input
                    value={newArtworkUrl}
                    onChange={(e) => {
                      setNewArtworkUrl(e.target.value);
                      if (e.target.value.trim()) {
                        setNewArtworkFile(null); // Clear file if URL is entered
                      }
                    }}
                    placeholder="https://..."
                    className="bg-black border-red-600 text-white mt-1"
                    disabled={!!newArtworkFile}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter the full URL of the artwork image
                  </p>
                </div>
                
                <div>
                  <Label className="text-white">Usage Type *</Label>
                  <Select value={newArtworkUsageType} onValueChange={(v) => setNewArtworkUsageType(v as any)}>
                    <SelectTrigger className="bg-black border-red-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-red-600">
                      <SelectItem value="gallery">Gallery</SelectItem>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="legacy_header">Legacy Header</SelectItem>
                      <SelectItem value="background">Background</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-white">Artist</Label>
                  <Select value={newArtworkArtist} onValueChange={setNewArtworkArtist}>
                    <SelectTrigger className="bg-black border-red-600 text-white mt-1">
                      <SelectValue placeholder="Select artist (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-red-600 max-h-72 overflow-y-auto">
                      <SelectItem value="none">Unknown Artist</SelectItem>
                      {artists.map(artist => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="border-red-600 text-white"
                    onClick={() => {
                      setAddArtworkCharacter(null);
                      setNewArtworkUrl('');
                      setNewArtworkFile(null);
                      setNewArtworkUsageType('gallery');
                      setNewArtworkArtist('none');
                    }}
                    disabled={isAddingArtwork}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isAddingArtwork || (!newArtworkUrl.trim() && !newArtworkFile)}
                    onClick={async () => {
                      setIsAddingArtwork(true);
                      try {
                        const supabaseAdmin = createAdminClient();
                        const selectedArtist = newArtworkArtist !== 'none' ? artists.find(a => a.id === newArtworkArtist) : null;
                        
                        let artworkUrl = newArtworkUrl.trim();
                        
                        // If file is selected, upload it first
                        if (newArtworkFile) {
                          const timestamp = Date.now();
                          const fileExt = newArtworkFile.name.split('.').pop();
                          const characterFolder = addArtworkCharacter.character.id;
                          const artistSuffix = selectedArtist ? `-by-${selectedArtist.name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
                          const fileName = `${characterFolder}/${characterFolder}-${timestamp}${artistSuffix}.${fileExt}`;
                          
                          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                            .from('artworks')
                            .upload(fileName, newArtworkFile, {
                              cacheControl: '3600',
                              upsert: false
                            });
                          
                          if (uploadError) throw uploadError;
                          
                          const { data: { publicUrl } } = supabaseAdmin.storage
                            .from('artworks')
                            .getPublicUrl(fileName);
                          
                          artworkUrl = publicUrl;
                        }
                        
                        if (!artworkUrl) {
                          throw new Error('No artwork URL or file provided');
                        }
                        
                        // 1. Upsert into artworks table
                        const { data: artworkData, error: artworkError } = await supabaseAdmin
                          .from('artworks')
                          .upsert({
                            artwork_url: artworkUrl,
                            artist_name: selectedArtist?.name || null,
                            artist_url: selectedArtist ? (selectedArtist as any).url : null,
                            platform: selectedArtist ? (selectedArtist as any).platform : null,
                            updated_at: new Date().toISOString()
                          }, {
                            onConflict: 'artwork_url',
                            ignoreDuplicates: false
                          })
                          .select()
                          .single();
                        
                        if (artworkError) throw artworkError;
                        
                        // 2. Create character_artworks link
                        const { error: linkError } = await supabaseAdmin
                          .from('character_artworks')
                          .insert({
                            character_id: addArtworkCharacter.character.id,
                            character_type: addArtworkCharacter.type,
                            artwork_id: artworkData.id,
                            usage_type: newArtworkUsageType
                          });
                        
                        if (linkError) {
                          // Check if it's a duplicate error
                          if (linkError.code === '23505') {
                            toast({
                              title: 'Already exists',
                              description: 'This artwork is already linked to this character',
                              variant: 'destructive'
                            });
                          } else {
                            throw linkError;
                          }
                        } else {
                          toast({
                            title: 'Success',
                            description: 'Artwork added successfully!'
                          });
                        }
                        
                        // Reset and close
                        setAddArtworkCharacter(null);
                        setNewArtworkUrl('');
                        setNewArtworkFile(null);
                        setNewArtworkUsageType('gallery');
                        setNewArtworkArtist('none');
                        await fetchAllCharacters();
                      } catch (err: any) {
                        console.error('Error adding artwork:', err);
                        toast({
                          title: 'Error',
                          description: err.message || 'Failed to add artwork',
                          variant: 'destructive'
                        });
                      } finally {
                        setIsAddingArtwork(false);
                      }
                    }}
                  >
                    {isAddingArtwork ? 'Adding...' : 'Add Artwork'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </BackgroundWrapper>
  );
}

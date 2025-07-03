export interface Artist {
  name: string;
  url: string;
  platform: 'twitter' | 'instagram' | 'youtube';
}

export const artists: Artist[] = [
  {
    name: 'Emilu',
    url: 'https://x.com/HavesomePotat0',
    platform: 'twitter'
  },
  {
    name: 'Enigma',
    url: 'https://x.com/enigma_system',
    platform: 'twitter'
  },
  {
    name: 'DECO',
    url: 'https://x.com/you_blender3d',
    platform: 'twitter'
  },
  {
    name: 'Verihihi',
    url: 'https://x.com/HiiriVeri',
    platform: 'twitter'
  },
  {
    name: 'tori si ro',
    url: 'https://x.com/tori_si_ro',
    platform: 'twitter'
  },
  {
    name: 'Vivi',
    url: 'https://x.com/vivi_llain',
    platform: 'twitter'
  },
  {
    name: 'Davood',
    url: 'https://x.com/davoodisatwat',
    platform: 'twitter'
  },
  {
    name: 'CIII',
    url: 'https://x.com/C3_laTooth',
    platform: 'twitter'
  },
  {
    name: 'Polina Butterfly',
    url: 'https://x.com/LePapillonPo',
    platform: 'twitter'
  },
  {
    name: 'RAZZ',
    url: 'https://www.instagram.com/razz_pazazz/',
    platform: 'instagram'
  },
  {
    name: 'あなご',
    url: 'https://x.com/yuzukan02',
    platform: 'twitter'
  },
  {
    name: 'ZozosDarkRoom',
    url: 'https://x.com/ZozosDarkRoom',
    platform: 'twitter'
  },
  {
    name: 'Riversknife',
    url: 'https://x.com/riversknife',
    platform: 'twitter'
  },
  {
    name: 'Horceror',
    url: 'https://x.com/horceror',
    platform: 'twitter'
  },
  {
    name: 'Angelolo',
    url: 'https://x.com/angelolooTW',
    platform: 'twitter'
  },
  {
    name: 'eefernal',
    url: 'https://x.com/eefernal',
    platform: 'twitter'
  },
  {
    name: 'ZMPixie',
    url: 'https://x.com/zmpixie',
    platform: 'twitter'
  },
  {
    name: 'SadakosPuppy',
    url: 'https://x.com/SadakosPuppy',
    platform: 'twitter'
  },
  {
    name: 'BUMBLEBI!',
    url: 'https://x.com/bumblebi713',
    platform: 'twitter'
  },
  {
    name: 'Genpac',
    url: 'https://x.com/Genn_pacc',
    platform: 'twitter'
  },
  {
    name: 'koi boi',
    url: 'https://x.com/itkoi',
    platform: 'twitter'
  },
  {
    name: 'Rohguu',
    url: 'https://x.com/Rohguu',
    platform: 'twitter'
  },
  {
    name: 'Julcanda',
    url: 'https://x.com/julcanda',
    platform: 'twitter'
  },
  {
    name: 'Dessa',
    url: 'https://x.com/Dessa_nya',
    platform: 'twitter'
  },
  {
    name: 'YM',
    url: 'https://x.com/_kabo66',
    platform: 'twitter'
  },
  {
    name: 'AKA',
    url: 'https://x.com/akanothere',
    platform: 'twitter'
  },
  {
    name: 'DATA',
    url: 'https://x.com/data_key00',
    platform: 'twitter'
  },
  {
    name: 'Luds',
    url: 'https://x.com/SplendidSneb',
    platform: 'twitter'
  },
  {
    name: 'Esskay',
    url: 'https://x.com/EsskayAU',
    platform: 'twitter'
  },
  {
    name: 'Diet Soda',
    url: 'https://x.com/diet_soda13',
    platform: 'twitter'
  },
  {
    name: 'FeverDBD',
    url: 'https://x.com/FeverDBD',
    platform: 'twitter'
  },
  {
    name: 'Kayaya',
    url: 'https://x.com/kayadesu_yo',
    platform: 'twitter'
  },
  {
    name: 'YoCyanide',
    url: 'https://x.com/YoCyanide_',
    platform: 'twitter'
  },
  {
    name: 'YoichiBear',
    url: 'https://x.com/yoichibear',
    platform: 'twitter'
  },
  {
    name: 'Kingsleykys',
    url: 'https://x.com/kingsleykys',
    platform: 'twitter'
  },
  {
    name: 'RatLivers',
    url: 'https://x.com/RatLivers',
    platform: 'twitter'
  },
  {
    name: 'Bubba Dreemurr',
    url: 'https://x.com/BubbaDreemurr/media',
    platform: 'twitter'
  },
  {
    name: 'Shaggy',
    url: 'https://x.com/HaddieTh3Baddie',
    platform: 'twitter'
  },
  {
    name: 'RaspberryRipley',
    url: 'https://www.instagram.com/RaspberryRipley/',
    platform: 'instagram'
  },
  {
    name: 'AVA',
    url: 'https://youtube.com/@cupidbirds?si=6j71WgiOg6sJJRyJ',
    platform: 'youtube'
  }
];

// Helper functions
export const getArtistByName = (name: string): Artist | undefined => {
  return artists.find(artist => artist.name.toLowerCase() === name.toLowerCase());
};

export const getArtistsByPlatform = (platform: Artist['platform']): Artist[] => {
  return artists.filter(artist => artist.platform === platform);
};

export const getTotalArtistCount = (): number => {
  return artists.length;
};

// Artist URL extraction utilities with detailed logging
export const extractArtistFromFilename = (url: string, enableLogging: boolean = false): { artistName: string; artist: Artist | undefined } => {
  try {
    if (enableLogging) {
      console.log(`    🔍 Extracting artist from URL: ${url}`);
    }
    
    // Extract filename from URL
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    if (enableLogging) {
      console.log(`    📁 Extracted filename: ${filename}`);
    }
    
    // Decode URL encoding
    const decodedFilename = decodeURIComponent(filename);
    
    if (enableLogging && decodedFilename !== filename) {
      console.log(`    🔓 Decoded filename: ${decodedFilename}`);
    }
    
    // Remove file extension
    const nameWithoutExtension = decodedFilename.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
    
    if (enableLogging) {
      console.log(`    ✂️ Without extension: ${nameWithoutExtension}`);
    }
    
    // Extract artist name - look for patterns like "art by {artist}" or "by {artist}"
    const patterns = [
      { regex: /art\s+by\s+(.+)$/i, name: '"art by artist_name"' },
      { regex: /by\s+(.+)$/i, name: '"by artist_name"' },
      { regex: /(.+)$/, name: 'fallback - whole name' }
    ];
    
    let extractedName = '';
    let usedPattern = '';
    
    for (const pattern of patterns) {
      const match = nameWithoutExtension.match(pattern.regex);
      if (match) {
        extractedName = match[1].trim();
        usedPattern = pattern.name;
        break;
      }
    }
    
    if (enableLogging) {
      console.log(`    🎯 Pattern matched: ${usedPattern}`);
      console.log(`    📝 Raw extracted name: "${extractedName}"`);
    }
    
    // Clean up the extracted name (remove common prefixes/suffixes)
    const originalExtracted = extractedName;
    extractedName = extractedName
      .replace(/^(art\s+by\s+|by\s+)/i, '')  // Remove "art by" or "by" prefixes
      .replace(/[_-]/g, ' ')                  // Replace underscores and hyphens with spaces
      .trim();
    
    if (enableLogging && originalExtracted !== extractedName) {
      console.log(`    🧹 Cleaned name: "${extractedName}"`);
    }
    
    // Try to find the artist in our database
    const artist = getArtistByName(extractedName);
    
    if (enableLogging) {
      console.log(`    🔍 Database lookup result: ${artist ? `FOUND (${artist.name} -> ${artist.url})` : 'NOT FOUND'}`);
    }
    
    return {
      artistName: extractedName,
      artist: artist
    };
  } catch (error) {
    console.error('Error extracting artist from filename:', error);
    return {
      artistName: 'Unknown Artist',
      artist: undefined
    };
  }
};

// Get artist info from artwork URL with optional detailed logging
export const getArtistInfoFromUrl = (url: string, enableLogging: boolean = false): {
  artistName: string;
  artistUrl: string | null;
  platform: Artist['platform'] | null;
} => {
  const { artistName, artist } = extractArtistFromFilename(url, enableLogging);
  
  return {
    artistName: artistName,
    artistUrl: artist?.url || null,
    platform: artist?.platform || null
  };
};

// Utility function for debugging artist extraction
export const debugArtistExtraction = (urls: string[]): void => {
  console.log('\n🔧 DEBUGGING ARTIST EXTRACTION');
  console.log('='.repeat(50));
  
  urls.forEach((url, index) => {
    console.log(`\n${index + 1}. Testing URL: ${url}`);
    console.log('-'.repeat(40));
    const result = getArtistInfoFromUrl(url, true);
    console.log(`Final result: "${result.artistName}" -> ${result.artistUrl || 'NOT LINKED'}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('END DEBUGGING\n');
};

// Get all artists as a formatted list for debugging
export const getArtistsList = (): string => {
  return artists.map((artist, index) => 
    `${index + 1}. ${artist.name} (${artist.platform}) -> ${artist.url}`
  ).join('\n');
};

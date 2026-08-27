// components/BackgroundWrapper.tsx

"use client";

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';

interface BackgroundWrapperProps {
  children: ReactNode;
  characterId?: string;
  backgroundUrl?: string;
  creditName?: string;
  creditUrl?: string;
}

// Artist credit for the fixed page backgrounds above.
// Keyed the same way as defaultBackgrounds so the two stay in step.
const defaultCredits: Record<string, { name: string; url: string }> = {
  '/submission': { name: 'Epic Edster', url: 'https://x.com/Epic_Edster' },
};

const defaultBackgrounds = {
  '/': 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.0.3',
  '/killers': '/killerpage.png',
  '/survivors': '/survivorpage.png',
  '/credits': 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
  '/search': '/search.png',
  '/submission': '/art140526.png',
};

export default function BackgroundWrapper({ children, characterId, backgroundUrl, creditName, creditUrl }: BackgroundWrapperProps) {
  const pathname = usePathname();
  const [background, setBackground] = useState<string>('');
  const [credit, setCredit] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    if (backgroundUrl) {
      setBackground(backgroundUrl);
      return;
    }

    const basePath = 
        pathname.startsWith('/killers') ? '/killers' :
        pathname.startsWith('/survivors') ? '/survivors' :
        pathname === '/credits' ? '/credits' :
        pathname === '/search' ? '/search' :
        pathname === '/submission' ? '/submission' : '/';
        
    const resolvedUrl = defaultBackgrounds[basePath as keyof typeof defaultBackgrounds] || defaultBackgrounds['/'];
    setBackground(resolvedUrl);

  }, [pathname, characterId, backgroundUrl]);

  // Resolve the artist credit: explicit props win, otherwise fall back to the map.
  useEffect(() => {
    if (creditName) {
      setCredit({ name: creditName, url: creditUrl || '' });
      return;
    }
    const basePath = pathname === '/submission' ? '/submission' : pathname;
    setCredit(defaultCredits[basePath] || null);
  }, [pathname, creditName, creditUrl]);

  return (
    // FIX: The root is now a DIV that creates a new stacking context.
    // 'relative isolate' contains all children and prevents them from covering siblings.
    <div className="relative isolate min-h-screen">
      
      <div className="fixed inset-0 -z-10">
        {background && (
          <Image
            src={background}
            alt="Page background"
            fill
            className="object-cover object-center"
            style={{ opacity: 0.5 }}
            quality={80}
            priority
            sizes="100vw"
            onError={() => {
              // Fallback: remove background to stop infinite error loops if URL invalid / domain not allowed
              setBackground('');
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* The page content is now safely rendered INSIDE the container div. */}
      {children}

      {credit && (
        <div className="fixed bottom-2 right-3 z-20 text-[11px] font-mono text-gray-300/70 bg-black/50 rounded px-2 py-1 backdrop-blur-sm pointer-events-auto">
          Background art by{' '}
          {credit.url ? (
            <a href={credit.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-300">
              {credit.name}
            </a>
          ) : (
            credit.name
          )}
        </div>
      )}
    </div>
  );
}
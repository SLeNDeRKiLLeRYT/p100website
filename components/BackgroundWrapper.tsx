// components/BackgroundWrapper.tsx

"use client";

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';

interface BackgroundWrapperProps {
  children: ReactNode;
  characterId?: string;
  backgroundUrl?: string;
}

const defaultBackgrounds = {
  '/': 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.0.3',
  '/killers': '/killerpage.png',
  '/survivors': '/survivorpage.png',
  '/credits': 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
  '/search': '/search.png',
  '/submission': '/p100submissions.png',
};

export default function BackgroundWrapper({ children, characterId, backgroundUrl }: BackgroundWrapperProps) {
  const pathname = usePathname();
  const [background, setBackground] = useState<string>('');

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
          />
        )}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* The page content is now safely rendered INSIDE the container div. */}
      {children}
    </div>
  );
}
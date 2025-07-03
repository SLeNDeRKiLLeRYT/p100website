// princegrid-p100-website/components/BackgroundWrapper.tsx

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
  '/killers': 'killerpage.png',
  '/survivors': '/survivorpage.png',
  '/credits': 'https://images.unsplash.com/photo-1519638399535-1b036603ac77?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3',
  '/search': '/search.png',
};

export default function BackgroundWrapper({ children, characterId, backgroundUrl }: BackgroundWrapperProps) {
  const pathname = usePathname();
  const [background, setBackground] = useState<string>('');

  useEffect(() => {
    // If we have a direct background URL from the database, use it immediately
    if (backgroundUrl) {
      setBackground(backgroundUrl);
      return;
    }

    // Otherwise, determine which default background to use based on the current path
    const basePath = pathname.startsWith('/killers') ? '/killers' :
                     pathname.startsWith('/survivors') ? '/survivors' :
                     pathname === '/credits' ? '/credits' :
                     pathname === '/search' ? '/search' : '/';
    const resolvedUrl = defaultBackgrounds[basePath as keyof typeof defaultBackgrounds] || defaultBackgrounds['/'];
    setBackground(resolvedUrl);

  }, [pathname, characterId, backgroundUrl]);

  return (
    // Use a React Fragment as the wrapper is no longer a layout container.
    // It just provides the background and renders the children on top.
    <>
      {/* 
        This div is now FIXED to the viewport. It covers the entire screen (inset-0)
        and sits behind all other content (-z-10). It does NOT scroll with the page.
        This ensures the background image covers the screen perfectly without zooming
        in, regardless of the page content's length.
      */}
      <div className="fixed inset-0 -z-10">
        {background && (
          <Image
            src={background}
            alt="Page background"
            fill
            className="object-cover object-center"
            style={{ opacity: 0.5 }}
            quality={80} // Adjust quality for performance
            priority // Load background images quickly
            sizes="100vw" // The image will span the full viewport width
          />
        )}
        {/* The dark overlay is now ABSOLUTE within the FIXED container, achieving the same effect. */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* 
        The page content is rendered here. It will have its own scrolling behavior
        and will appear ON TOP of the fixed background.
      */}
      {children}
    </>
  );
}
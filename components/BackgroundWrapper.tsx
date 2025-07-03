// princegrid-p100-website/components/BackgroundWrapper.tsx

"use client";

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image'; // Import the Next.js Image component

interface BackgroundWrapperProps {
  children: ReactNode;
  characterId?: string; // For character-specific pages
  backgroundUrl?: string; // Direct background URL override
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
    // If we have a direct background URL, use it immediately
    if (backgroundUrl) {
      setBackground(backgroundUrl);
      return;
    }

    // Determine which default background to use based on the current path
    const basePath = pathname.startsWith('/killers') ? '/killers' :
                     pathname.startsWith('/survivors') ? '/survivors' :
                     pathname === '/credits' ? '/credits' :
                     pathname === '/search' ? '/search' : '/';
    const resolvedUrl = defaultBackgrounds[basePath as keyof typeof defaultBackgrounds] || defaultBackgrounds['/'];
    setBackground(resolvedUrl);

  }, [pathname, characterId, backgroundUrl]);

  return (
    <div className="relative min-h-screen">
      {/* Background image layer using Next/Image */}
      {background && (
        <Image
          src={background}
          alt="Page background"
          fill
          className="object-cover object-center -z-10"
          style={{ opacity: 0.5 }}
          quality={80} // Adjust quality for performance
          priority // Load background images quickly
          sizes="100vw" // The image will span the full viewport width
        />
      )}

      {/* Dark overlay for better text readability */}
      <div className="fixed inset-0 z-[-1] bg-black/50" />

      {/* Page Content */}
      {children}
    </div>
  );
}
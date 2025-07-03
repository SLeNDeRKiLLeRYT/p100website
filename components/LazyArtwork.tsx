'use client';

import { useState } from 'react';
import Image from 'next/image';

interface LazyArtworkProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  children?: React.ReactNode;
}

export default function LazyArtwork({
  src,
  alt,
  className = "object-cover",
  containerClassName = "relative w-full h-full",
  sizes = "288px",
  children
}: LazyArtworkProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={containerClassName}>
      {!hasError ? (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
              <div className="text-gray-500 text-sm">Loading...</div>
            </div>
          )}
          <Image
            src={src}
            alt={alt}
            fill
            className={`${className} transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            sizes={sizes}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-sm">Failed to load</div>
        </div>
      )}
      {children}
    </div>
  );
}

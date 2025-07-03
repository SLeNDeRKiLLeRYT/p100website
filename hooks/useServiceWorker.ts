'use client';

import { useEffect } from 'react';

export function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  const preloadImagesWithSW = (imageUrls: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'PRELOAD_COMPLETE') {
            resolve();
          }
        };

        navigator.serviceWorker.controller.postMessage({
          type: 'PRELOAD_IMAGES',
          urls: imageUrls
        }, [messageChannel.port2]);
      } else {
        // Fallback to regular preloading if SW is not available
        const promises = imageUrls.map(url => {
          return new Promise<void>((imgResolve, imgReject) => {
            const img = new Image();
            img.onload = () => imgResolve();
            img.onerror = () => imgReject(new Error(`Failed to load ${url}`));
            img.src = url;
          });
        });

        Promise.all(promises).then(() => resolve()).catch(reject);
      }
    });
  };

  return { preloadImagesWithSW };
}

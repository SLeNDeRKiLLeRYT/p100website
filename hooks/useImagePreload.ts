'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UseImagePreloadOptions {
  enabled?: boolean;
  preloadOnHover?: boolean;
  preloadDelay?: number;
}

/**
 * Hook for predictive image preloading based on user interactions
 */
export function useImagePreload(options: UseImagePreloadOptions = {}) {
  const {
    enabled = true,
    preloadOnHover = true,
    preloadDelay = 100
  } = options;

  const router = useRouter();
  const preloadedUrls = useRef(new Set<string>());
  const hoverTimers = useRef(new Map<string, NodeJS.Timeout>());

  const preloadImage = (src: string): Promise<void> => {
    if (!enabled || preloadedUrls.current.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        preloadedUrls.current.add(src);
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`));
      };
      
      if (src.startsWith('http')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.src = src;
    });
  };

  const preloadRouteImages = async (route: string) => {
    if (!enabled) return;

    try {
      // Import the createClient function dynamically to avoid SSR issues
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();

      if (route === '/killers') {
        const { data } = await supabase
          .from('killers')
          .select('image_url')
          .order('order')
          .limit(12);

        if (data) {
          data.forEach(killer => {
            if (killer.image_url) {
              preloadImage(killer.image_url).catch(console.error);
            }
          });
        }

      } else if (route === '/survivors') {
        const { data } = await supabase
          .from('survivors')
          .select('image_url')
          .order('order_num')
          .limit(12);

        if (data) {
          data.forEach(survivor => {
            if (survivor.image_url) {
              preloadImage(survivor.image_url).catch(console.error);
            }
          });
        }      } else if (route.startsWith('/killers/')) {
        const characterId = route.split('/').pop();
        if (characterId) {
          const characterResponse = await supabase
            .from('killers')
            .select('image_url, background_image_url, header_url, legacy_header_urls')
            .eq('id', characterId)
            .single();

          if (characterResponse.data) {
            [
              characterResponse.data.image_url,
              characterResponse.data.background_image_url,
              characterResponse.data.header_url
            ].forEach(url => {
              if (url) preloadImage(url).catch(console.error);
            });
            
            // Preload legacy header URLs
            if (characterResponse.data.legacy_header_urls && Array.isArray(characterResponse.data.legacy_header_urls)) {
              characterResponse.data.legacy_header_urls.forEach(url => {
                if (url && typeof url === 'string') {
                  preloadImage(url).catch(console.error);
                }
              });
            }
          }
        }      } else if (route.startsWith('/survivors/')) {
        const characterId = route.split('/').pop();
        if (characterId) {
          const characterResponse = await supabase
            .from('survivors')
            .select('image_url, background_image_url, legacy_header_urls')
            .eq('id', characterId)
            .single();

          if (characterResponse.data) {
            [
              characterResponse.data.image_url,
              characterResponse.data.background_image_url
            ].forEach(url => {
              if (url) preloadImage(url).catch(console.error);
            });
            
            // Preload legacy header URLs
            if (characterResponse.data.legacy_header_urls && Array.isArray(characterResponse.data.legacy_header_urls)) {
              characterResponse.data.legacy_header_urls.forEach(url => {
                if (url && typeof url === 'string') {
                  preloadImage(url).catch(console.error);
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error preloading route images:', error);
    }
  };

  const handleLinkHover = (href: string) => {
    if (!preloadOnHover || !enabled) return;

    // Clear any existing timer for this URL
    const existingTimer = hoverTimers.current.get(href);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set a new timer
    const timer = setTimeout(() => {
      preloadRouteImages(href);
      router.prefetch(href);
    }, preloadDelay);

    hoverTimers.current.set(href, timer);
  };

  const handleLinkLeave = (href: string) => {
    const timer = hoverTimers.current.get(href);
    if (timer) {
      clearTimeout(timer);
      hoverTimers.current.delete(href);
    }
  };

  // Setup global link hover listeners
  useEffect(() => {
    if (!preloadOnHover || !enabled) return;    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Element)) return;
      
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          handleLinkHover(url.pathname);
        }
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Element)) return;
      
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          handleLinkLeave(url.pathname);
        }
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      
      // Clear all timers
      hoverTimers.current.forEach(timer => clearTimeout(timer));
      hoverTimers.current.clear();
    };
  }, [preloadOnHover, enabled, preloadDelay]);

  return {
    preloadImage,
    preloadRouteImages,
    preloadedUrls: preloadedUrls.current
  };
}

// princegrid-p100-website/public/sw.js

// Increment the cache version numbers to force an update for all users.
const CACHE_NAME = 'p100-images-v2';
const STATIC_CACHE_NAME = 'p100-static-v2';

// URLs to cache on install (this list is fine)
const STATIC_URLS_TO_CACHE = [
  '/homepage.png',
  '/killerpage.png',
  '/survivorpage.png',
  '/search.png',
  '/p100submissions.png',
  '/admin.png',
  '/favicon.ico'
];

// External domains to cache (this list is fine)
const EXTERNAL_DOMAINS = [
  'ddejzyoxrbccpickqakz.supabase.co',
  'images.unsplash.com',
  'images.pexels.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_URLS_TO_CACHE);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old cache versions to clean up storage.
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tell the active service worker to take control of the page immediately.
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy: Cache first, then network for images
  // This is the main fix for the "refresh to load" issue.
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          // If a valid response is in the cache, return it.
          if (cachedResponse) {
            return cachedResponse;
          }

          // Otherwise, fetch from the network.
          return fetch(request).then(networkResponse => {
            // Only cache valid, successful (200 OK) responses.
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              cache.put(request, responseToCache);
            }
            return networkResponse;
          }).catch(err => {
            // If the fetch fails, do not create a fake 404.
            // Let the browser handle the network error naturally.
            console.error('Service Worker: Fetch failed for', request.url, err);
            throw err; // Propagate the error.
          });
        });
      })
    );
  } else if (STATIC_URLS_TO_CACHE.includes(url.pathname)) {
    // Strategy: Cache first for static assets
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request);
      })
    );
  }
});

// The message listener for preloading images is fine as is.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PRELOAD_IMAGES') {
    const imageUrls = event.data.urls;
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        const promises = imageUrls.map(url => {
          return cache.match(url).then(cachedResponse => {
            if (cachedResponse) return; // Already cached
            return fetch(url).then(response => {
              if (response.status === 200) {
                return cache.put(url, response);
              }
            }).catch(error => {
              console.error('Service Worker: Failed to preload image:', url, error);
            });
          });
        });

        return Promise.all(promises);
      }).then(() => {
        if (event.ports[0]) {
          event.ports[0].postMessage({ type: 'PRELOAD_COMPLETE' });
        }
      })
    );
  }
});
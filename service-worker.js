/**
 * دار الضيافة بالمنصورة - Service Worker
 * Dar Al Diyafa Mansoura - Hotel Management System
 * Offline Support | PWA | Cache Strategy
 */

const CACHE_NAME = 'dar-aldiyafa-v1.0.0';
const STATIC_CACHE = 'dar-aldiyafa-static-v1';
const DYNAMIC_CACHE = 'dar-aldiyafa-dynamic-v1';

// Files to cache immediately on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/firebase.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&family=Playfair+Display:wght@400;700;900&display=swap',
];

// Firebase CDN files to cache
const FIREBASE_FILES = [
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js',
];

// ============================================================
// INSTALL EVENT - Cache static assets
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES).catch(err => {
          console.warn('[SW] Some static files failed to cache:', err);
        });
      }),
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('[SW] Caching Firebase files');
        return cache.addAll(FIREBASE_FILES).catch(err => {
          console.warn('[SW] Some Firebase files failed to cache:', err);
        });
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// ============================================================
// ACTIVATE EVENT - Clean old caches
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH EVENT - Cache Strategy
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase Realtime Database requests (always need fresh data)
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('firebase.googleapis.com')) return;

  // For navigation requests (HTML pages) - Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clonedResponse));
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For Google Fonts - Cache first strategy
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // For Firebase SDK files - Cache first
  if (url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // For all other static assets - Cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Return cached, but also update in background
        const networkFetch = fetch(request).then(response => {
          caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => {});
        return cached;
      }

      // Not in cache - fetch from network
      return fetch(request).then(response => {
        if (response.ok) {
          const clonedResponse = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clonedResponse));
        }
        return response;
      }).catch(() => {
        // Return offline fallback for images
        if (request.destination === 'image') {
          return caches.match('/assets/icon-192.png');
        }
      });
    })
  );
});

// ============================================================
// BACKGROUND SYNC - Sync offline operations when online
// ============================================================
self.addEventListener('sync', event => {
  console.log('[SW] Background Sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  try {
    // Notify all clients to sync their offline queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OFFLINE_QUEUE' });
    });
    console.log('[SW] Offline queue sync triggered');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-72.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'دار الضيافة', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data.url || '/';
      
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ============================================================
// MESSAGE HANDLER - Communicate with main app
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service Worker loaded:', CACHE_NAME);

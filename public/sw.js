const CACHE_NAME = "voice-ai-groq-v1"
const STATIC_ASSETS = ["/", "/manifest.json", "/workers/tts-worker.js"]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...")
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Caching static assets...")
        // Cache each asset individually to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(async (url) => {
            try {
              const response = await fetch(url)
              if (response.ok) {
                await cache.put(url, response)
                console.log(`Cached: ${url}`)
              } else {
                console.warn(`Failed to cache ${url}: ${response.status}`)
              }
            } catch (error) {
              console.warn(`Failed to fetch ${url}:`, error)
            }
          }),
        )
      })
      .then(() => {
        console.log("Static assets caching completed")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("Service Worker installation failed:", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("Service Worker activated")
        return self.clients.claim()
      })
      .catch((error) => {
        console.error("Service Worker activation failed:", error)
      }),
  )
})

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  // Skip API calls - these need to go through network
  if (event.request.url.includes("/api/")) {
    return
  }

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith("http")) {
    return
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return (
          response ||
          fetch(event.request).catch(() => {
            // If both cache and network fail, return a fallback
            if (event.request.destination === "document") {
              return caches.match("/")
            }
            // For other resources, return a simple response
            return new Response("Resource not available offline", {
              status: 404,
              statusText: "Not Found",
            })
          })
        )
      })
      .catch((error) => {
        console.error("Cache match failed:", error)
        return fetch(event.request)
      }),
  )
})

// Service worker — cache em runtime (stale-while-revalidate) para uso offline.
// Bump a versão para forçar limpeza do cache em mudanças grandes.
const CACHE = 'caravan-ex-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return // não cacheia CDNs externas
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const network = fetch(req).then(res => {
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    }).catch(() => cached)
    return cached || network
  })())
})

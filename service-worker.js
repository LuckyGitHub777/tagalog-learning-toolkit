const CACHE = 'tagalog-academy-v4.0.0';
const SHELL = [
  './','index.html','404.html','privacy.html','language-notes.html','content-use.html','manifest.webmanifest','assets/css/styles.css','assets/js/theme.js','assets/js/core.js','assets/js/app.js',
  'assets/icons/favicon.svg','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/icon-maskable-512.png','assets/images/social-card.png',
  'data/catalog.json','data/lesson.schema.json',
  'data/lessons/greetings-introductions.json','data/lessons/people-family.json','data/lessons/colors-preferences.json','data/lessons/food-drinks.json',
  'data/lessons/home-location.json','data/lessons/numbers-quantities.json','data/lessons/fruit-market.json','data/lessons/days-time.json','data/lessons/daily-routine.json',
  'downloads/Tagalog-Academy-Beginner-Guide.pdf','downloads/Tagalog-Academy-Practice-Pack.pdf','downloads/Tagalog-Academy-Answer-Guide.pdf'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(SHELL.map(asset => cache.add(asset)))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  const fresh = await update;
  return cached || fresh || new Response('Unavailable', {status: 503});
}

async function navigationResponse(request) {
  try {
    return await fetch(request);
  } catch {
    const url = new URL(request.url);
    const scopePath = new URL(self.registration.scope).pathname;
    const rootPaths = new Set([scopePath, `${scopePath}index.html`]);
    return await caches.match(rootPaths.has(url.pathname) ? 'index.html' : '404.html')
      || new Response('Unavailable', {status: 503});
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Unavailable', {status: 503});
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationResponse(event.request));
    return;
  }
  if (url.pathname.includes('/data/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

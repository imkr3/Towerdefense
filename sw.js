/* 막대 왕국 전쟁 - 오프라인 캐시 */
const CACHE = 'stick-kingdom-v11';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/audio.js', './js/data.js', './js/save-store.js', './js/game.js', './js/render.js', './js/main.js',
  './manifest.json', './icon.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('stick-kingdom-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

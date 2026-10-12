/* 막대 왕국 전쟁 - 오프라인 캐시 */
const CACHE = 'stick-kingdom-v60';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/settings.js', './js/audio.js', './js/music.js', './js/data.js', './js/i18n.js', './js/gl-fx.js', './js/save-store.js', './js/game.js', './js/render.js', './js/main.js', './js/formation.js',
  './manifest.json', './icon.svg'
];
self.addEventListener('install', e => {
  // cache: 'reload' — 브라우저 HTTP 캐시의 옛 파일을 새 판에 섞어 담지 않는다
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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

// Water Clicker Service Worker
// 方針: 同一オリジンのGETだけを扱う（Supabaseランキング等の外部通信・POSTには一切触らない）
// ネット優先 → 失敗/3秒超過ならキャッシュ。HTMLを更新してpushするだけで最新版が配信される。
const CACHE = 'water-clicker-v1';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(handle(e, req));
});

async function handle(e, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  const network = fetch(req).then(res => {
    if (res.ok) {
      e.waitUntil(cache.put(req, res.clone()));
      return res;
    }
    return cached || res;
  });

  // キャッシュが無い（初回など）ときはネットワークの結果をそのまま待つ
  if (!cached) return network;

  // キャッシュがあるときは、通信失敗や3秒超過でキャッシュを返す（電波が悪くても起動が遅くならない）
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 3000));
  return Promise.race([network.catch(() => cached), timeout]);
}

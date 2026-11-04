// 수작 서비스 워커: 한 번 연 뒤에는 인터넷 없이도 열리게 (앱 설치용)
// - 화면(HTML): 인터넷 먼저, 안 되면 저장해 둔 것 → 고친 판이 바로 보임
// - 앱 파일(/assets)·아이콘·설명서·글꼴: 저장해 둔 것 먼저 (파일 이름에 판 번호가 붙어 있어 안전)
const CACHE = 'sujak-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()).then(() => syncAssets(true)));
});

// 앱 파일 맞추기: 목록의 파일은 모두 미리 받아 두고(인터넷 없이도 워드·한글 저장·QR 등이 되게),
// 목록에 없는 옛 판 /assets 파일은 지운다. 그림·보관함(브라우저 저장소)은 건드리지 않는다
let lastSync = 0, syncing = null;
function syncAssets(force) {
  if (syncing) return syncing;
  if (!force && Date.now() - lastSync < 60 * 1000) return Promise.resolve();
  lastSync = Date.now();
  syncing = (async () => {
    const r = await fetch('/asset-list.json', { cache: 'no-store' });
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) return;
    const keep = new Set(list);
    const c = await caches.open(CACHE);
    for (const req of await c.keys()) {
      const p = new URL(req.url).pathname;
      if (p.startsWith('/assets/') && !keep.has(p)) await c.delete(req);
    }
    for (const p of list) { if (!(await c.match(p, { ignoreVary: true }))) { try { await c.add(p); } catch (e) { /* 다음에 다시 */ } } }
  })().catch(() => {}).finally(() => { syncing = null; });
  return syncing;
}
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'sync-assets') e.waitUntil(syncAssets(true).then(() => e.source && e.source.postMessage({ type: 'assets-synced' }))); });

const isFont = (u) => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin && !isFont(u)) return; // AI 연결 등 바깥 요청은 건드리지 않음
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(u.pathname === '/' ? '/' : req, copy)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))));
    if (u.pathname === '/') e.waitUntil(syncAssets(false)); // 인터넷이 될 때 앱 파일을 새 판에 맞춘다
    return;
  }
  // ignoreVary: 미리 받아 둔 파일(요청 머리말이 조금 다름)도 같은 파일로 찾는다
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && (r.type === 'basic' || r.type === 'cors')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});

// 불멍 캠핑장 서비스워커
// - 빌드된 정적 파일(/assets/*)은 캐시 우선 → 두 번째 실행부터 빠르게 로딩
// - 페이지는 네트워크 우선 (멀티플레이 게임이라 항상 최신 서버에 붙도록)
// - 서버가 꺼져 있으면 안내 화면
const CACHE = 'campfire-v2';
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>불멍 캠핑장</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e24;font-family:system-ui,sans-serif;color:#fff3dc;text-align:center}
.c{background:#fff8e8;color:#6b4a2b;border-radius:28px;padding:28px 30px;max-width:320px}b{font-size:22px}button{margin-top:16px;border:0;border-radius:16px;padding:12px 22px;font-size:16px;color:#fff;background:#f0782a}</style></head>
<body><div class="c"><div style="font-size:44px">🌙</div><b>캠핑장 서버에 연결할 수 없어요</b><p>인터넷 연결을 확인하고,<br>잠시 후 다시 시도해 주세요.<br><small>(서버가 잠들어 있었다면 깨어나는 데 30초~1분 걸려요)</small></p><button onclick="location.reload()">다시 시도</button></div></body></html>`;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('/', res.clone())); return res; })
        .catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
    return;
  }

  // 해시가 붙은 빌드 파일 & 아이콘 & 폰트: 캐시 우선
  if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});

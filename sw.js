// KAMAGAKU MATCH LOG Service Worker：アプリ本体を端末に保存し、電波がなくても起動できるようにする
// 更新を配るときは VERSION を上げる（古いキャッシュは自動で消える）
const VERSION = 'pn-v35';
const CORE = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/01-constants.js', './js/02-store.js', './js/03-utils.js', './js/04-render.js', './js/05-teams.js', './js/06-home.js',
  './js/07-roster.js', './js/08-record.js', './js/09-sheets.js', './js/10-stats.js', './js/11-data.js', './js/12-events.js', './js/13-live.js', './js/14-flow.js', './js/15-rules.js', './js/16-draw.js', './js/17-analysis.js', './js/18-review.js', './media/awake.mp4',
  './icons/icon-180.png', './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png',
];
// 新しい版は、ブラウザの一時保存を使わずに取り直す（古いファイルが混ざらないように）
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache:'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type:'window' })).then(cs => cs.forEach(c => c.postMessage({ type:'sw-ready', version:VERSION }))));   // 開いている画面に「新しい版が届いた」と知らせる
});
// アプリ本体：キャッシュを先に使い、裏で新しい版を取りに行く（次回起動時に反映）
// Google Fonts：一度読めたら保存しておく。GAS への通信はキャッシュしない
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.hostname.includes('script.google')) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch:true });
    const net = fetch(e.request).then(res => { if(res.ok || res.type === 'opaque') cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

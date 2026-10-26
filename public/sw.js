// 폰에 앱으로 설치하려면 서비스 워커가 필요해요.
// 이 서비스 워커는 일부러 아무것도 저장(캐시)하지 않아요.
// 그래서 다시 배포하면 폰 앱에도 바로 새 화면이 보여요.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));

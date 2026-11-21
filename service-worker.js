const CACHE = 'contentbatch-shell-v1';
const ASSETS = ["./", "./index.html", "./styles.css", "./manifest.webmanifest", "./src/app.js", "./src/ui/homeView.js", "./src/ui/editorView.js", "./src/ui/navigation.js", "./src/ui/templatesView.js", "./src/ui/dom.js", "./src/ui/planView.js", "./src/ui/dataTools.js", "./src/ui/contentView.js", "./src/ui/batchesView.js", "./src/storage/db.js", "./src/storage/dataRepository.js", "./src/storage/contentRepository.js", "./src/storage/batchRepository.js", "./src/storage/templateRepository.js", "./src/domain/portability.js", "./src/domain/backup.js", "./src/domain/tags.js", "./src/domain/batches.js", "./src/domain/dates.js", "./src/domain/content.js", "./src/domain/templates.js", "./src/domain/search.js", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('contentbatch-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
 event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

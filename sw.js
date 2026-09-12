// DİKKAT: Her güncellemede bu numarayı artırın (Örn: v2.0.0, v2.0.1)
const CACHE_NAME = 'gitar-atolyesi-v2.3.12'; 

// Çevrimdışı (offline) çalışabilmesi için cihazda tutulacak dosyalar
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './lang.js',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './bg-click.jpg',
    './bg-rock.jpg',
    './bg-funk.jpg',
    './bg-lofi.jpg',
    './yilan.html',
    './pacman.html',
    './riverraid.html',
    './tetris.html',
    './gizlilik.html',
    './blues-backing.mp3',
    './rock-backing.mp3',
    './lofi-backing.mp3',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
];

// 1. KURULUM: İner inmez beklemeden aktif ol!
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// 2. AKTİVASYON: Eski sürümleri acımasızca yok et!
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(() => self.clients.claim()) // Açık sayfaların kontrolünü anında ele geçir
    );
});

// 3. GETİR (Fetch): AKILLI STRATEJİ (Medya için Cache-First, Kod için Network-First)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    if (event.request.url.match(/\.(mp3|wav|png|jpg|jpeg|svg|gif)$/i) || event.request.url.match(/(yilan|pacman|riverraid|tetris)\.html$/i)) {
        event.respondWith(
            caches.match(event.request).then((cachedRes) => {
                return cachedRes || fetch(event.request).then((netRes) => {
                    const responseToCache = netRes.clone(); // Tarayıcı okumadan önce klonla!
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    return netRes;
                });
            })
        );
    } else {
        event.respondWith(
            fetch(event.request).then((netRes) => {
                if (netRes && netRes.status === 200 && netRes.type === 'basic') {
                    const responseToCache = netRes.clone(); // Tarayıcı okumadan önce klonla!
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return netRes;
            }).catch(() => caches.match(event.request))
        );
    }
});
const assetPrefix = '/__hltv_assets__/';
let mountedAssets = new Map();

const normalize = (value) =>
  decodeURIComponent(value)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'mount-assets') return;

  mountedAssets = new Map(
    event.data.entries.map((entry) => [normalize(entry.path), entry.source]),
  );

  event.ports[0]?.postMessage({ count: mountedAssets.size });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(assetPrefix)) return;

  const key = normalize(url.pathname.slice(assetPrefix.length));
  const source = mountedAssets.get(key);

  if (!source) {
    event.respondWith(new Response(`Missing local asset: ${key}`, { status: 404 }));
    return;
  }

  if (source.kind === 'url') {
    event.respondWith(fetch(source.url));
    return;
  }

  event.respondWith(
    new Response(source.file, {
      status: 200,
      headers: {
        'Content-Length': String(source.file.size),
        'Content-Type': 'application/octet-stream',
      },
    }),
  );
});

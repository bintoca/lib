import { decodeSync } from '@bintoca/cbor/core'
import { apiVersion, indexHtml, indexHtmlHeaders, PageConfig, PlatformManifest } from '@bintoca/package/shared'
const _self: ServiceWorkerGlobalScope = self as any
const selfOrigin = new URL(_self.location.href).origin

const pageConfig: PageConfig = {} as any
const manifest: PlatformManifest = {}
const cachedURLs = Object.keys(manifest).map(x => manifest[x].path)

_self.addEventListener('install', function (event) {
    _self.skipWaiting();
    event.waitUntil(
        self.caches.open('cache1')
            .then(function (cache) {
                return Promise.all(cachedURLs.map(x => cache.match(x).then(m => m ? undefined : cache.add(x))))
            })
    );
});
_self.addEventListener('activate', event => {
    event.waitUntil(_self.clients.claim().then(x => {
        return _self.clients.matchAll().then(x => {
            for (let c of x) {
                c.postMessage({ apiVersion, force: pageConfig.isDev })
            }
        })
    }));
});

_self.addEventListener('fetch', function (event) {
    if (cachedURLs.some(x => x == event.request.url)) {
        event.respondWith(caches.match(event.request))
    }
    else {
        event.respondWith(Promise.resolve(0).then(() => {
            const u = new URL(event.request.url)
            if (u.origin == selfOrigin) {
                if (u.pathname.startsWith('/api/')) {
                    switch (u.pathname) {
                        case '/api/ss': {
                            break
                        }
                    }
                }
                else {
                    const isAppProcess = event.request.referrer && new URL(event.request.referrer).origin == selfOrigin
                    //return new Response(indexHtml(pageConfig, null, [], manifest, { isAppProcess }), { headers: indexHtmlHeaders() })
                }
            }
            return fetch(event.request);
        }))
    }
});
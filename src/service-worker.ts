import { createWebTransportHttpProxy, sendReqOverWebTransport } from "./webTransportHttpProxy";
import { cacheName } from './cache';

// // const addr = 'https://127.0.0.1:4430';
// const addr = "https://104.193.58.243:4430";

// console.log({ addr });
let wtProxy = createWebTransportHttpProxy({});

self.addEventListener('install', event => {
    const urlsToPrecache = [
        "/",
    ];

    // @ts-ignore-line
    event.waitUntil(caches.open(cacheName).then(function (cache) {
        return cache.addAll(urlsToPrecache);
    }));

    // console.log('installed!');
    // // @ts-ignore-line
    // self.skipWaiting()
});

// self.addEventListener('activate', event => {
//     console.log('V1 now ready to handle fetches!');
// });

// console.log("starting service worker");

// Listen for request events
self.addEventListener('fetch', async (event) => {
    console.log('fetch event!!')

    // Get the request
    let req: Request = (event as any).request;
    const url = new URL(req.url);

    // Bug fix
    // https://stackoverflow.com/a/49719964
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    // // Cache-busting urls add hashes between the filename and the extension (eg. "file_name.hash.js") so to check
    // // for bootstrap files they need to be split into a cache-busting hash prefixing and suffixing portion.
    // const bootstrapFiles = [
    //     "/service-worker.js",
    // ].map(f => {
    //     let extensionDot = f.lastIndexOf(".");
    //     return {
    //         path: f.slice(0, extensionDot) + '.',
    //         ext: f.slice(extensionDot),
    //     }
    // });

    // const isBootstrapFile = bootstrapFiles.some(f => url.pathname.startsWith(f.path) && url.pathname.endsWith(f.ext));

    // @ts-ignore-line
    event.respondWith((async () => {
        // Respond to document requests with a cached copy of the static html
        if (req.destination === "document") {
            console.log("Load document from cache: ", url.pathname)

            const cache = await caches.open(cacheName);

            return cache.match(req, {
                ignoreSearch: true,
                ignoreMethod: true,
                ignoreVary: true
            });
        }

        // Send all other requests over Web Transport
        const res = await sendReqOverWebTransport(wtProxy, req);

        // console.log({ req, res })

        return res;
    })())
});

const bootstrap = async () => {
    // // @ts-ignore-line
    // if (process.env.NODE_ENV === 'development') {
    //     // Always fully unload and replace the service worker when in development contexts
    //     let registration = await navigator.serviceWorker.getRegistration('/');
    //     if (registration != null) {
    //         await registration.unregister();
    //         console.log("Dev: Service Worker unregistered");
    //         location.reload();
    //         return
    //     }
    // }

    if (!(navigator && navigator.serviceWorker)) {
        alert("Error: No Service Worker support found in your browser.")
    }

    const registration = await navigator.serviceWorker.register(
        new URL('service-worker.ts', import.meta.url),
        // '/service-worker.ts',
        { type: 'module', scope: '/' }
    );
    // console.log({ registration });

    // Wait till the service worker is installed and then reload to activate it
    if (registration.installing) {
        const installingSW = registration.installing || registration.waiting;
        await new Promise((resolve) => installingSW.onstatechange = () => {
            if (installingSW.state === 'installed') {
                resolve(null)
            }
        });

        // SW installed. Refresh page so SW can respond with SW-enabled page.
        // This does not work in development because parcel appends a Date-based suffix to each service worker url, so every 
        // reload is a new service worker
        // @ts-ignore-line
        if (process.env.NODE_ENV !== 'development') {
            window.location.reload();
        }
    }

    // // @ts-ignore-line
    // if (process.env.NODE_ENV === 'development') {
    //     console.log("Dev: Service Worker is active");
    // }
    // registration.update();

    // console.log("READY!")

    // Loading the application javascript (not to be confused with this bootstrapping index.ts which is inlined into index.html)
    const appScript = document.createElement('script');
    appScript.setAttribute('src', '/index.js');

    document.head.appendChild(appScript);
}

import { createWebTransportHttpProxy } from "./webTransportHttpProxy";

const testWebTransit = async () => {
    // Fully unload and replace the service worker
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (registration != null) {
        await registration.unregister();
        console.log("Dev: Service Worker unregistered");
        location.reload();
        return
    }

    console.log("Start!");
    const conn = createWebTransportHttpProxy();
    const transport = await conn.getTransport();
    console.log("Done!");
}

// testWebTransit();
bootstrap();

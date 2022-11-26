import serializeHttpReq from "./serializeHttpReq";
import { HeadersStreamingParser as HeadersParser, mergeUint8Arrays } from "./headersParser";
import { cacheName } from "./cache";

const signallingServer = "http://localhost:8080/graphql"

export const createWebTransportHttpProxy = ({ ...args } = {}) => {
    const wtProxy = { getTransport: async () => { }, transport: null, closed: true, openPromise: null as null | Promise<null> };
    let errored = false

    const openTransport = async () => {
        const startedAt = performance.now();

        // Attempt get the signalling from the network but fall-back to the cached copy
        let cacheKey = new Request("/signalling-graphql.json");
        const cache = await caches.open(cacheName);

        try {
            const res = await fetch(signallingServer, ({
                method: "POST",
                body: JSON.stringify({
                    query:
                        "query($subdomain: String!) { hosts(subdomain: $subdomain) {\n" +
                        "   webTransportRoutes { url, isIpv6, isLocal }\n" +
                        "   ephemeralKeyFingerprints\n" +
                        "} }",
                    variables: {
                        // subdomain: globalThis.location.hostname
                        subdomain: "iMdbSQp7pfNLcU1YYNRHm29YQdKvsrBZdk2djrCdARt3.printspool.io"
                    },
                }),
            }));
            await cache.put(cacheKey, res);
        } catch { }

        const signallingRes = await cache.match(cacheKey, {
            ignoreSearch: true,
            ignoreMethod: true,
            ignoreVary: true
        });


        if (!signallingRes.ok) {
            throw new Error(`Signalling returned status ${signallingRes.status}`)
        }

        const signalling = await signallingRes.json();

        if (signalling.errors != null) {
            throw new Error("Signalling Error: " + JSON.stringify(signalling.errors));
        }

        const hosts = [...signalling.data.hosts];

        if (hosts.length === 0) {
            throw new Error('Signalling: Host record not found. Please try restarting your device.');
        }

        console.log("Signalling Received");

        const popRandomHost = () => {
            if (hosts.length === 0) return null;
            const index = Math.floor(Math.random() * hosts.length);
            const host = hosts[index];
            delete hosts[index];
            return host
        }

        // Try opening every routing option at once on up to 2 randomly choosen hosts and connect to the one that returns quickest
        const choosenHosts = [popRandomHost(), popRandomHost()].filter(host => host != null);

        const connectedTransport = await Promise.any(choosenHosts.map((host) => {
            const { ephemeralKeyFingerprints, webTransportRoutes } = host;
            console.log({ ephemeralKeyFingerprints, webTransportRoutes });

            return Promise.any(webTransportRoutes.filter(r => !r.isIpv6).filter((r, i) => i === 0).map(async ({ url }) => {
                // url = "https://127.0.0.1:4430";
                console.log("Trying WebTransport at", url);
                /* @ts-ignore */
                // eslint-disable-next-line no-undef
                const transport = new WebTransport(url, {
                    ...args,
                    serverCertificateHashes: ephemeralKeyFingerprints
                        .map((fingerprint) => {
                            let bytes = fingerprint.split(':').map((el) => parseInt(el, 16));
                            let u8Array = new Uint8Array(bytes.length);
                            bytes.forEach((v, i) => u8Array[i] = v);

                            return {
                                algorithm: 'sha-256',
                                value: u8Array,
                            }
                        })
                });
                console.log({ transport })

                await transport.ready

                console.log(`Connected to WebTransport at "${url}"`, transport, (performance.now() - startedAt).toFixed(1), "ms")

                transport.closed
                    .then(() => {
                        console.log('The WebTransport connection to ', url, 'closed gracefully.')
                    })
                    .catch((error) => {
                        errored = true
                        console.error(
                            'The WebTransport connection to',
                            url,
                            'closed due to ',
                            error,
                            '.'
                        )
                    })
                wtProxy.closed = false;
                wtProxy.transport = transport;

                return transport
            }));
        }));

        return connectedTransport;
    };

    // Opens a new WebTransport socket or returns a previously opened one
    const getTransport = async () => {
        if (!wtProxy.closed && !errored) {
            return wtProxy.transport
        }

        // Prevent multiple calls to getTransport from starting multiple connection processes in parallel
        wtProxy.openPromise ||= openTransport();

        await wtProxy.openPromise
        return wtProxy.transport
    }

    wtProxy.getTransport = getTransport;

    return wtProxy
}

export const sendReqOverWebTransport = async ({ getTransport }, req: Request) => {
    console.log({ req })
    const transport = await getTransport();
    // console.log({ transport });

    const startedAt = performance.now();
    // some echo tests for testing the webtransport library, not for production
    const stream = await transport.createBidirectionalStream()
    const writer = stream.writable.getWriter()
    console.log('stream opened', (performance.now() - startedAt).toFixed(1), "ms")

    const buf = await serializeHttpReq(req);
    writer.write(buf)

    const dec = new TextDecoder();
    console.log("TX", dec.decode(buf));

    // console.log('req sent', (performance.now() - startedAt).toFixed(1), "ms")

    const reader = stream.readable.getReader()

    // Parse the headers
    const headersParser = new HeadersParser();
    let headers: null | Headers = null;

    while (headers == null) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        const finished_headers = headersParser.parse(value);

        if (finished_headers != null) {
            headers = finished_headers;
        }
    }

    // Parse the content length
    const contentLengthStr = (headers as Headers).get("content-length");
    if (contentLengthStr == null) {
        throw new Error("Invalid HTTP response: A content-length header is required");
    }
    const contentLength = parseInt(contentLengthStr);

    // Parse the body
    let body = headersParser.unparsedBytes;
    while (body.length < contentLength) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }

        // Merge each response packet into the response bytes array
        body = mergeUint8Arrays(body, value);
    }

    // Cleanup
    try {
        await writer.close()
    } catch (error) {
        console.error(`Error closing WT writer: ${error}`)
    }

    try {
        await reader.cancel(0)
    } catch (error) {
        console.error(`Error closing WT reader: ${error}`)
    }

    // Combine the headers and the body
    return new Response(new Uint8Array(body), {
        status: 200,
        statusText: "OK",
        headers: headers as Headers,
    });
}

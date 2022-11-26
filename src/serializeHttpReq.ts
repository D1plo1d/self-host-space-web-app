const serializeHttpReq = async (req: Request): Promise<ArrayBuffer> => {
    // const startedAt = performance.now();
    // console.log("begin: " + (performance.now() - startedAt).toFixed(0) + " ms");

    const bodyPromise = req.arrayBuffer()
    // console.log("body promise started: " + (performance.now() - startedAt).toFixed(0) + " ms");

    const startLine = `${req.method} ${req.url} HTTP/1.1\r\n`
    // console.log("startLine: " + (performance.now() - startedAt).toFixed(0) + " ms");
    // @ts-ignore-line
    let headers = (Array.from(req.headers.entries()) as [string, string][])
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');

    // console.log("Headers: " + (performance.now() - startedAt).toFixed(0) + " ms");

    if (!("TextEncoder" in globalThis)) {
        throw new Error("This browser does not support TextEncoder");
    }

    // console.log({ startLine, headers })

    const enc = new TextEncoder();
    const startLineBytes = enc.encode(startLine);

    // console.log("Headers and Start Line: " + (performance.now() - startedAt).toFixed(0) + " ms");

    const body = await bodyPromise;
    const bodySize = body.byteLength;
    // console.log("Await Body: " + (performance.now() - startedAt).toFixed(0) + " ms");

    headers += `Content-length: ${bodySize}\r\n`;
    headers += "\r\n";
    const headerBytes = enc.encode(headers);

    const buf = new Uint8Array(startLineBytes.byteLength + headerBytes.byteLength + body.byteLength);
    // console.log("Alloc: " + (performance.now() - startedAt).toFixed(0) + " ms");
    let i = 0;
    buf.set(startLineBytes, i);
    i += startLineBytes.byteLength;
    buf.set(headerBytes, i);
    i += headerBytes.byteLength;
    buf.set(new Uint8Array(body), i);

    // console.log("Total Serialization Time: " + (performance.now() - startedAt).toFixed(0) + "ms for " + (bodySize / 1000 / 1000).toFixed(1) + "MB");

    return buf.buffer;
}

export default serializeHttpReq;
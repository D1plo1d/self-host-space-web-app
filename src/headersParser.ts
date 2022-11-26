const CR = 0x0D;
const LF = 0x0A;

export const mergeUint8Arrays = (a: Uint8Array, b: Uint8Array) => {
    const mergedArray = new Uint8Array(a.length + b.length);
    mergedArray.set(a);
    mergedArray.set(b, a.length);
    return mergedArray;
}

export class HeadersStreamingParser {
    statusLine: null | String;
    headers: Headers;
    unparsedBytes: Uint8Array;
    decoder: TextDecoder;
    contentLength: null | number;

    constructor() {
        this.statusLine = null;
        this.headers = new Headers();
        this.unparsedBytes = new Uint8Array();
        this.contentLength = null;

        if (!("TextDecoder" in globalThis)) {
            throw new Error("This browser does not support TextDecoder");
        }
        this.decoder = new TextDecoder();
    }

    parse(incomingBytes: ArrayBuffer): Headers | null {
        this.unparsedBytes = mergeUint8Arrays(this.unparsedBytes, new Uint8Array(incomingBytes));

        while (true) {
            // Find the next CRLF
            let newlineIndex = this.unparsedBytes.findIndex((_, index, b) => index < b.length - 1 && b[index] == CR && b[index + 1] == LF);

            if (newlineIndex == -1) {
                this.unparsedBytes = this.unparsedBytes;
                return null;
            }

            // Decode and remove a line of text from the incoming bytes
            let line = this.decoder.decode(this.unparsedBytes.slice(0, newlineIndex));
            this.unparsedBytes = this.unparsedBytes.slice(newlineIndex + 2);

            if (this.statusLine == null) {
                this.statusLine = line;
                return null;
            }

            // A double CRLF marks the end of the headers - if an empty line is reached then return the final headers object
            if (line.length == 0) {
                return this.headers;
            }

            // Add the header
            const colonIndex = line.indexOf(": ");
            const name = line.slice(0, colonIndex);
            const value = line.slice(colonIndex + 2);
            console.log({ name, value });
            this.headers.append(name, value);
        }
    }
}

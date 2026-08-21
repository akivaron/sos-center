// Link-layer codec shared by the BLE and Wi-Fi Direct mesh transports.
//
// Mesh envelopes are JSON strings. BLE characteristics carry only a few hundred
// bytes per write (ATT MTU), so we base64-encode each envelope and, when it
// exceeds the link MTU, split it into reassembled chunks. Wi-Fi Direct sockets
// are streamed, so the same framing works there too.
//
// Implemented with a self-contained base64 codec (no btoa/Buffer globals) so it
// works identically on web, iOS and Android.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = B64.indexOf(clean[i]);
    const e1 = B64.indexOf(clean[i + 1]);
    const e2 = clean.length > i + 2 ? B64.indexOf(clean[i + 2]) : -1;
    const e3 = clean.length > i + 3 ? B64.indexOf(clean[i + 3]) : -1;
    bytes.push((e0 << 2) | (e1 >> 4));
    if (e2 >= 0) bytes.push(((e1 & 15) << 4) | (e2 >> 2));
    if (e3 >= 0) bytes.push(((e2 & 3) << 6) | e3);
  }
  return new Uint8Array(bytes);
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToText(b64: string): string {
  return new TextDecoder().decode(base64ToBytes(b64));
}

// Frame prefixes keep the wire format self-describing.
//   "Q0:" + base64          -> complete envelope in a single frame
//   "Q1:" + id:idx:total: + base64-piece -> one chunk of a multi-frame envelope
const WHOLE = "Q0:";
const CHUNK = "Q1:";

/** Split a base64 envelope into link frames that fit within `chunkSize` bytes. */
export function splitForLink(payloadB64: string, chunkSize: number): string[] {
  if (payloadB64.length <= chunkSize) return [`${WHOLE}${payloadB64}`];
  const id = Math.random().toString(36).slice(2, 10);
  const total = Math.ceil(payloadB64.length / chunkSize);
  const frames: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const piece = payloadB64.slice(index * chunkSize, (index + 1) * chunkSize);
    frames.push(`${CHUNK}${id}:${index}:${total}:${piece}`);
  }
  return frames;
}

/** Reassembles link frames back into complete base64 envelopes, per peer. */
export class LinkReassembler {
  private buffers = new Map<string, { total: number; parts: string[] }>();

  push(raw: string): string | null {
    if (raw.startsWith(WHOLE)) return raw.slice(WHOLE.length);
    if (!raw.startsWith(CHUNK)) return null;
    const rest = raw.slice(CHUNK.length);
    const sep1 = rest.indexOf(":");
    const sep2 = rest.indexOf(":", sep1 + 1);
    const sep3 = rest.indexOf(":", sep2 + 1);
    if (sep1 < 0 || sep2 < 0 || sep3 < 0) return null;
    const id = rest.slice(0, sep1);
    const index = Number(rest.slice(sep1 + 1, sep2));
    const total = Number(rest.slice(sep2 + 1, sep3));
    const piece = rest.slice(sep3 + 1);
    const entry = this.buffers.get(id) ?? { total, parts: new Array(total) };
    entry.parts[index] = piece;
    this.buffers.set(id, entry);
    if (entry.parts.every((p) => typeof p === "string")) {
      this.buffers.delete(id);
      return entry.parts.join("");
    }
    return null;
  }

  forget(peerId: string): void {
    this.buffers.delete(peerId);
  }
}

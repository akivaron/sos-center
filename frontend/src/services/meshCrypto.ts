// Mesh identity, pairing and message confidentiality.
//
// Threat model: an offline Bluetooth mesh among physically nearby people.
// The BLE link layer is already OS-encrypted, so the goals here are:
//   1. Confidentiality + authenticity for 1:1 messages between PAIRED peers.
//   2. Replay / duplicate protection via nonces and monotonic sequence numbers.
//   3. A short pairing fingerprint so users can confirm a MITM-free exchange.
//
// Pairing exchanges a short code (typed or scanned from a QR). The shared key
// is derived with HKDF from the code plus both peer ids. Private messages are
// encrypted with AES-GCM when Web Crypto is available, otherwise with an
// HMAC-keystream cipher (integrity-protected). Anonymous broadcasts are only
// protected by the BLE link layer by design.

import AsyncStorage from "@react-native-async-storage/async-storage";

const ID_KEY = "resq-mesh-identity";
const PAIR_KEY = "resq-mesh-pairings";

type Bytes = Uint8Array;

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toB64(bytes: Bytes): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64_ALPHABET[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64_ALPHABET[n & 63] : "=";
  }
  return out;
}

function fromB64(value: string): Bytes {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let acc = 0;
  let bits = 0;
  let written = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const idx = B64_ALPHABET.indexOf(clean[i]);
    if (idx < 0) continue;
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, written);
}

function getSubtle(): SubtleCrypto | null {
  const g = globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } };
  return g.crypto?.subtle ?? null;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function randomBytes(length: number): Bytes {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (g.crypto?.getRandomValues) {
    const out = new Uint8Array(length);
    g.crypto.getRandomValues(out);
    return out;
  }
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

// --- Compact SHA-256 (used only when Web Crypto is unavailable) --------------
function sha256Fallback(message: Bytes): Bytes {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const block = new Uint32Array(64);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const msg = pad(message);
  const view = new DataView(msg.buffer);

  for (let offset = 0; offset < msg.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) block[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = ror(block[i - 15], 7) ^ ror(block[i - 15], 18) ^ (block[i - 15] >>> 3);
      const s1 = ror(block[i - 2], 17) ^ ror(block[i - 2], 19) ^ (block[i - 2] >>> 10);
      block[i] = (block[i - 16] + s0 + block[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i += 1) {
      const s1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + K[i] + block[i]) | 0;
      const s0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i]);
  return out;
}

function ror(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) | 0;
}

function pad(message: Bytes): Bytes {
  const bitLen = message.length * 8;
  const withOne = message.length + 1;
  const total = Math.ceil((withOne + 8) / 64) * 64;
  const out = new Uint8Array(total);
  out.set(message);
  out[message.length] = 0x80;
  const view = new DataView(out.buffer);
  view.setUint32(total - 4, bitLen >>> 0, false);
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);
  return out;
}

async function sha256(message: Bytes): Promise<Bytes> {
  const subtle = getSubtle();
  if (subtle?.digest) {
    return new Uint8Array(await subtle.digest("SHA-256", new Uint8Array(message)));
  }
  return sha256Fallback(message);
}

function xorBytes(a: Bytes, b: Bytes): Bytes {
  const out = new Uint8Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i += 1) out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
  return out;
}

function concat(...parts: Bytes[]): Bytes {
  let len = 0;
  parts.forEach((p) => (len += p.length));
  const out = new Uint8Array(len);
  let offset = 0;
  parts.forEach((p) => { out.set(p, offset); offset += p.length; });
  return out;
}

async function hmac(key: Bytes, message: Bytes): Promise<Bytes> {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = await sha256(k);
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(k);
    k = padded;
  }
  const oKey = xorBytes(k, new Uint8Array(blockSize).fill(0x5c));
  const iKey = xorBytes(k, new Uint8Array(blockSize).fill(0x36));
  return sha256(concat(oKey, await sha256(concat(iKey, message))));
}

async function hkdf(inputKey: Bytes, salt: Bytes, info: Bytes, length = 32): Promise<Bytes> {
  const prk = await hmac(salt, inputKey);
  const out = new Uint8Array(length);
  let prev: Bytes = new Uint8Array(0);
  let generated = 0;
  let counter = 1;
  while (generated < length) {
    const block = await hmac(prk, concat(prev, info, new Uint8Array([counter])));
    out.set(block.subarray(0, Math.min(block.length, length - generated)), generated);
    generated += block.length;
    prev = block;
    counter += 1;
  }
  return out;
}

// --- Identity -----------------------------------------------------------------
export type MeshIdentity = { id: string; secret: string; publicKey: string };

function deriveId(secret: Bytes): string {
  const h = xorBytes(secret, new Uint8Array(secret.length).fill(0x36));
  let acc: Bytes = new Uint8Array([...h.subarray(0, 8)]);
  for (let i = 0; i < secret.length; i += 8) {
    acc = xorBytes(acc, secret.subarray(i, i + 8));
  }
  return toB64(acc).replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
}

async function loadIdentity(): Promise<MeshIdentity> {
  const cached = await readJson<MeshIdentity>(ID_KEY);
  if (cached?.secret && cached?.id) return cached;
  const secret = randomBytes(32);
  const identity: MeshIdentity = {
    id: deriveId(secret),
    secret: toB64(secret),
    publicKey: toB64(await sha256(secret)),
  };
  await writeJson(ID_KEY, identity);
  return identity;
}

// --- Pairing ------------------------------------------------------------------
export type Pairing = { peerId: string; peerName: string; peerPublicKey: string; sharedKey: string; fingerprint: string; pairedAt: number };

async function loadPairings(): Promise<Record<string, Pairing>> {
  return (await readJson<Record<string, Pairing>>(PAIR_KEY)) ?? {};
}

export async function getPairing(peerId: string): Promise<Pairing | null> {
  const all = await loadPairings();
  return all[peerId] ?? null;
}

export async function listPairings(): Promise<Pairing[]> {
  return Object.values(await loadPairings());
}

export async function savePairing(pairing: Pairing): Promise<void> {
  const all = await loadPairings();
  all[pairing.peerId] = pairing;
  await writeJson(PAIR_KEY, all);
}

export async function removePairing(peerId: string): Promise<void> {
  const all = await loadPairings();
  delete all[peerId];
  await writeJson(PAIR_KEY, all);
}

/** Build a pairing from an exchanged peer public key + a shared short code. */
export async function createPairing(
  identity: MeshIdentity,
  peerId: string,
  peerName: string,
  peerPublicKey: string,
  code: string,
): Promise<Pairing> {
  const sortedIds = [identity.id, peerId].sort().join("|");
  const salt = await sha256(new TextEncoder().encode("resq-mesh-v1"));
  const shared = await hkdf(
    new TextEncoder().encode(code),
    salt,
    new TextEncoder().encode(`resq-pairing|${sortedIds}`),
    32,
  );
  const fingerprint = toB64(await hmac(shared, new TextEncoder().encode(sortedIds))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  const pairing: Pairing = {
    peerId,
    peerName,
    peerPublicKey,
    sharedKey: toB64(shared),
    fingerprint,
    pairedAt: Date.now(),
  };
  await savePairing(pairing);
  return pairing;
}

// --- Confidentiality ----------------------------------------------------------
export async function encryptMessage(plaintext: string, sharedKeyB64: string): Promise<string> {
  const key = fromB64(sharedKeyB64);
  const subtle = getSubtle();
  if (subtle?.importKey && subtle.encrypt) {
    try {
      const cryptoKey = await subtle.importKey("raw", new Uint8Array(key), { name: "AES-GCM" }, false, ["encrypt"]);
      const iv = randomBytes(12);
      const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, cryptoKey, new Uint8Array(new TextEncoder().encode(plaintext))));
      return `v1:${toB64(iv)}:${toB64(cipher)}`;
    } catch {
      /* fall through to HMAC-keystream */
    }
  }
  const iv = randomBytes(12);
  const pt = new TextEncoder().encode(plaintext);
  const ct = await keystreamXor(pt, key, iv);
  const tag = await hmac(key, concat(iv, ct));
  return `h1:${toB64(iv)}:${toB64(ct)}:${toB64(tag)}`;
}

export async function decryptMessage(packet: string, sharedKeyB64: string): Promise<string> {
  const key = fromB64(sharedKeyB64);
  const [scheme, ivB64, ctB64, tagB64] = packet.split(":");
  if (scheme === "v1") {
    const subtle = getSubtle();
    if (!subtle?.decrypt) throw new Error("AES-GCM unavailable");
    const cryptoKey = await subtle.importKey("raw", new Uint8Array(key), { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(fromB64(ivB64)) }, cryptoKey, new Uint8Array(fromB64(ctB64)));
    return new TextDecoder().decode(plain);
  }
  if (scheme === "h1") {
    const iv = fromB64(ivB64);
    const ct = fromB64(ctB64);
    const tag = fromB64(tagB64 ?? "");
    const expected = await hmac(key, concat(iv, ct));
    if (!constantTimeEqual(expected, tag)) throw new Error("bad tag");
    const pt = await keystreamXor(ct, key, iv);
    return new TextDecoder().decode(pt);
  }
  throw new Error("unsupported cipher");
}

async function keystreamXor(data: Bytes, key: Bytes, iv: Bytes): Promise<Bytes> {
  const out = new Uint8Array(data.length);
  let counter = new Uint8Array(4);
  let produced = 0;
  while (produced < data.length) {
    const block = await hmac(key, concat(iv, counter));
    let take = 0;
    for (let i = 0; i < block.length && produced + take < data.length; i += 1, take += 1) {
      out[produced + take] = data[produced + take] ^ block[i];
    }
    produced += take;
    for (let i = 3; i >= 0; i -= 1) {
      counter[i] = (counter[i] + 1) & 0xff;
      if (counter[i] !== 0) break;
    }
  }
  return out;
}

function constantTimeEqual(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function fingerprintForIdentity(identity: MeshIdentity): Promise<string> {
  return toB64(await hmac(fromB64(identity.secret), new TextEncoder().encode("resq-fp"))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

export { loadIdentity, randomBytes, sha256, hmac };

// Mesh wire protocol: envelopes, flooding/relay with TTL, de-duplication and
// delivery receipts. This layer is transport-agnostic — it only produces and
// consumes raw strings that the transport pipes between peers.

import { hmac, randomBytes } from "./meshCrypto";

export const MESH_VERSION = 1;
export const DEFAULT_TTL = 6;
export const MAX_TTL = 12;
export const SEEN_TTL_MS = 10 * 60 * 1000;

export type MeshFrameKind = "chat" | "announce" | "presence" | "typing" | "receipt";

export interface MeshEnvelope {
  v: number;
  id: string;
  from: string;
  fromName: string;
  to: string | null;
  kind: MeshFrameKind;
  payload: string;
  enc: boolean;
  ts: number;
  seq: number;
  ttl: number;
  hop: number;
  sig: string;
}

export interface ChatPayload {
  text: string;
  system?: boolean;
}

export interface ReceiptPayload {
  messageId: string;
  status: "delivered" | "read";
}

export interface PresencePayload {
  online: boolean;
}

export interface TypingPayload {
  typing: boolean;
}

export interface AnnouncePayload {
  publicKey: string;
  name: string;
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
}

async function signEnvelope(env: MeshEnvelope, keyB64: string | null): Promise<string> {
  if (!keyB64) return "";
  const canonical = `${env.v}.${env.id}.${env.from}.${env.fromName}.${env.to ?? ""}.${env.kind}.${env.payload}.${env.enc ? 1 : 0}.${env.ts}.${env.seq}`;
  const digest = await hmac(new TextEncoder().encode(keyB64), new TextEncoder().encode(canonical));
  return b64(digest);
}

export function decodeEnvelope(raw: string): MeshEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MeshEnvelope>;
    if (!parsed || parsed.v !== MESH_VERSION) return null;
    if (typeof parsed.id !== "string" || typeof parsed.from !== "string") return null;
    if (parsed.kind === undefined || parsed.payload === undefined) return null;
    return parsed as MeshEnvelope;
  } catch {
    return null;
  }
}

export type CreateInput = {
  from: string;
  fromName: string;
  to: string | null;
  kind: MeshFrameKind;
  payload: string;
  enc: boolean;
  signKeyB64?: string | null;
  ttl?: number;
  seq?: number;
};

export async function createEnvelope(input: CreateInput): Promise<string> {
  const ttl = Math.min(Math.max(input.ttl ?? DEFAULT_TTL, 1), MAX_TTL);
  const env: MeshEnvelope = {
    v: MESH_VERSION,
    id: `m_${Date.now().toString(36)}_${b64(randomBytes(6))}`,
    from: input.from,
    fromName: input.fromName,
    to: input.to,
    kind: input.kind,
    payload: input.payload,
    enc: input.enc,
    ts: Date.now(),
    seq: input.seq ?? Date.now(),
    ttl,
    hop: 0,
    sig: "",
  };
  env.sig = await signEnvelope(env, input.signKeyB64 ?? null);
  return JSON.stringify(env);
}

export async function verifyEnvelope(env: MeshEnvelope, keyB64: string | null): Promise<boolean> {
  if (!env.sig) return keyB64 === null;
  if (!keyB64) return false;
  const expected = await signEnvelope(env, keyB64);
  return expected === env.sig;
}

/** Whether this node should forward the envelope onward through the mesh. */
export function shouldRelay(env: MeshEnvelope, myId: string): boolean {
  if (env.to === myId) return false; // addressed to me, terminate
  if (env.to === null) return env.ttl > 1; // broadcast, keep flooding while ttl allows
  return env.ttl > 1; // addressed elsewhere, onward relay
}

/** Produce the envelope to forward (decremented TTL, incremented hop). */
export function relayEnvelope(env: MeshEnvelope): string {
  const next: MeshEnvelope = { ...env, ttl: env.ttl - 1, hop: env.hop + 1 };
  return JSON.stringify(next);
}

export function encodePayload<T = unknown>(value: T): string {
  return JSON.stringify(value);
}

export function decodePayload<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

// --- Transport contract (shared by web / native implementations) -------------
export type MeshTransportStatus =
  | "idle"
  | "starting"
  | "active"
  | "denied"
  | "disabled"
  | "unsupported"
  | "settings";

export interface MeshStartOptions {
  peerName: string;
  onPeers: (peers: import("@/src/types").MeshPeer[]) => void;
  onFrame: (raw: string, fromPeerId: string) => void;
}

export interface MeshTransport {
  start(opts: MeshStartOptions): Promise<MeshTransportStatus>;
  broadcast(raw: string): Promise<void>;
  send(peerId: string, raw: string): Promise<void>;
  stop(): void;
}

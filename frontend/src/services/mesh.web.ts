// Web mesh transport: a simulation so the full mesh-chat experience is usable
// and testable in a browser. It uses BroadcastChannel for cross-tab messaging
// (open two tabs = two devices) and adds a built-in "ResQ Responder" peer that
// greets you and answers, so a single tab still demonstrates every feature.
//
// The transport only moves raw strings. Encryption, relay and de-duplication
// live in the protocol layer / orchestration hook.

import type { MeshPeer } from "@/src/types";
import {
  createEnvelope,
  decodeEnvelope,
  decodePayload,
  encodePayload,
  type AnnouncePayload,
  type ChatPayload,
  type MeshStartOptions,
  type MeshTransport,
  type MeshTransportStatus,
  type TypingPayload,
} from "./meshProtocol";

const CHANNEL = "resq-mesh-v1";
const RESPONDER_ID = "sim-responder";
const RESPONDER_NAME = "ResQ Responder";

type HelloFrame = { type: "hello"; linkId: string; identityId: string; name: string };

function getLinkId(): string {
  try {
    const existing = sessionStorage.getItem("resq-mesh-link-id");
    if (existing) return existing;
    const id = `link_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("resq-mesh-link-id", id);
    return id;
  } catch {
    return `link_${Math.random().toString(36).slice(2, 10)}`;
  }
}

class WebMeshTransport implements MeshTransport {
  private channel: BroadcastChannel | null = null;
  private linkId = getLinkId();
  private opts: MeshStartOptions | null = null;
  private links = new Map<string, MeshPeer>();
  private started = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private respondedIds = new Set<string>();

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;
    if (typeof BroadcastChannel === "undefined") {
      // Still surface the responder so the feature is demoable.
      this.links.set(RESPONDER_ID, this.responderPeer());
      this.emitPeers();
      this.scheduleResponderGreeting(opts.peerName);
      this.started = true;
      return "active";
    }
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (event: MessageEvent) => this.onChannelMessage(event.data);
    this.links.set(RESPONDER_ID, this.responderPeer());
    this.emitPeers();
    this.post({ type: "hello", linkId: this.linkId, identityId: "", name: opts.peerName });
    this.scheduleResponderGreeting(opts.peerName);
    this.started = true;
    return "active";
  }

  async broadcast(raw: string): Promise<void> {
    this.post({ type: "mesh", raw });
    this.maybeRespond(raw);
  }

  async send(_peerId: string, raw: string): Promise<void> {
    await this.broadcast(raw);
  }

  stop(): void {
    this.started = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    try {
      this.post({ type: "hello", linkId: this.linkId, identityId: "", name: "" });
      this.channel?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
    this.links.clear();
  }

  private responderPeer(): MeshPeer {
    return { id: RESPONDER_ID, name: RESPONDER_NAME, rssi: -50, paired: false, online: true, lastSeen: Date.now(), simulated: true };
  }

  private post(message: unknown) {
    try {
      this.channel?.postMessage(message);
    } catch {
      /* ignore */
    }
  }

  private emitPeers() {
    this.opts?.onPeers([...this.links.values()]);
  }

  private onChannelMessage(data: unknown) {
    if (!data || typeof data !== "object") return;
    const frame = data as { type: string };
    if (frame.type === "hello") {
      const hello = frame as HelloFrame;
      if (hello.linkId === this.linkId) return;
      if (hello.identityId) {
        const known = this.links.get(hello.identityId);
        if (!known) {
          this.links.set(hello.identityId, {
            id: hello.identityId,
            name: hello.name || "ResQ Peer",
            rssi: -60,
            paired: false,
            online: true,
            lastSeen: Date.now(),
          });
          this.emitPeers();
          // Introduce ourselves so the other tab learns our identity.
          this.post({ type: "hello", linkId: this.linkId, identityId: "", name: this.opts?.peerName ?? "" });
        }
      }
      return;
    }
    if (frame.type === "mesh") {
      const raw = (frame as { type: string; raw?: string }).raw ?? "";
      this.opts?.onFrame(raw, RESPONDER_ID);
    }
  }

  private scheduleResponderGreeting(_peerName: string) {
    this.timers.push(setTimeout(() => void this.responderAnnounce(), 500));
    this.timers.push(setTimeout(() => {
      void this.responderSay(
        RESPONDER_ID,
        RESPONDER_NAME,
        null,
        "Halo dari ResQ Responder. Jaringan mesh aktif — pesan Anda akan diteruskan antarperangkat meski offline. Ketik pesan darurat kapan saja.",
      );
    }, 700));
  }

  private maybeRespond(raw: string) {
    const env = decodeEnvelope(raw);
    if (!env || env.kind !== "chat") return;
    if (env.from === RESPONDER_ID) return;
    if (env.to !== null && env.to !== RESPONDER_ID) return;
    // De-duplicate: the same envelope may arrive both directly and via a relay.
    if (this.respondedIds.has(env.id)) return;
    this.respondedIds.add(env.id);
    const payload = decodePayload<ChatPayload>(env.payload);
    if (!payload) return;
    const reply = this.composeReply(payload.text);
    // Typing indicator, then the reply.
    this.timers.push(setTimeout(() => {
      void this.responderSay(RESPONDER_ID, RESPONDER_NAME, env.from, `✍️`, true);
    }, 600));
    this.timers.push(setTimeout(() => {
      void this.responderSay(RESPONDER_ID, RESPONDER_NAME, env.from, reply);
    }, 1500));
  }

  private composeReply(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("bantuan") || lower.includes("help") || lower.includes("tolong") || lower.includes("sos")) {
      return "Tim penolong menerima permintaan Anda. Sebutkan lokasi dan jenis kebutuhan (ambulans, evakuasi, makanan) agar kami bisa meneruskan ke relawan terdekat.";
    }
    if (lower.includes("apa") || lower.includes("halo") || lower.includes("hi") || lower.includes("hai") || lower.includes("hello")) {
      return "ResQ Responder di sini. Saya bisa meneruskan pesan darurat ke perangkat terdekat melalui mesh Bluetooth.";
    }
    return "Pesan Anda diterima melalui jaringan mesh. Untuk darurat nyata, tekan tombol SOS di layar utama.";
  }

  private async responderSay(fromId: string, fromName: string, to: string | null, text: string, typing = false) {
    if (!this.started || !this.opts) return;
    const kind = typing ? "typing" : "chat";
    const payload = typing
      ? encodePayload<TypingPayload>({ typing: true })
      : encodePayload<ChatPayload>({ text });
    const raw = await createEnvelope({
      from: fromId,
      fromName,
      to,
      kind,
      payload,
      enc: false,
    });
    this.opts.onFrame(raw, RESPONDER_ID);
  }

  private async responderAnnounce() {
    if (!this.started || !this.opts) return;
    const raw = await createEnvelope({
      from: RESPONDER_ID,
      fromName: RESPONDER_NAME,
      to: null,
      kind: "announce",
      payload: encodePayload<AnnouncePayload>({ publicKey: "sim-public-key", name: RESPONDER_NAME }),
      enc: false,
    });
    this.opts.onFrame(raw, RESPONDER_ID);
  }
}

export function createWebTransport(): MeshTransport {
  return new WebMeshTransport();
}

const transport = createWebTransport();
export const startMesh = (opts: MeshStartOptions) => transport.start(opts);
export const broadcastMeshMessage = (raw: string) => transport.broadcast(raw);
export const sendMeshMessage = (peerId: string, raw: string) => transport.send(peerId, raw);
export const stopMesh = () => transport.stop();
export type { MeshTransportStatus };

import { useCallback, useEffect, useRef, useState } from "react";

import type { MeshConversation, MeshMessage, MeshPeer, User } from "@/src/types";
import {
  broadcastMeshMessage,
  startMesh,
  stopMesh,
  type MeshTransportStatus,
} from "@/src/services/mesh";
import {
  createEnvelope,
  decodeEnvelope,
  decodePayload,
  encodePayload,
  relayEnvelope,
  shouldRelay,
  DEFAULT_TTL,
  type AnnouncePayload,
  type ChatPayload,
  type MeshEnvelope,
  type PresencePayload,
  type ReceiptPayload,
  type RelayAckPayload,
  type TypingPayload,
} from "@/src/services/meshProtocol";
import {
  createPairing,
  decryptMessage,
  encryptMessage,
  listPairings,
  loadIdentity,
  removePairing as removeStoredPairing,
  type MeshIdentity,
  type Pairing,
} from "@/src/services/meshCrypto";
import { BROADCAST_ID, loadConversations, loadMessages, saveConversations, saveMessages } from "@/src/services/meshStore";
import { meshBus } from "@/src/services/meshBus";
import {
  flushAnchorSeconds,
  recordMuleTransfer,
  recordRelay,
  recordRelayAck,
  signRelayAck,
} from "@/src/services/badgeStore";

const ANNOUNCE_INTERVAL_MS = 15000;
const PRESENCE_INTERVAL_MS = 15000;
const TYPING_CLEAR_MS = 4000;
const ANCHOR_TICK_MS = 60000;

type KnownPeer = MeshPeer & { publicKey?: string };

function conversationKey(peerId: string | null): string {
  return peerId ?? BROADCAST_ID;
}

function sortConversations(a: MeshConversation, b: MeshConversation): number {
  if (a.id === BROADCAST_ID) return -1;
  if (b.id === BROADCAST_ID) return 1;
  return b.lastAt - a.lastAt;
}

export function useMeshChat(user: User | null) {
  const meName = user?.name ?? "Guest";

  const [status, setStatus] = useState<MeshTransportStatus>("idle");
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [conversations, setConversations] = useState<MeshConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [typingPeer, setTypingPeer] = useState<string | null>(null);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);

  const identityRef = useRef<MeshIdentity | null>(null);
  const seenRef = useRef<Map<string, number>>(new Map());
  const peerMapRef = useRef<Map<string, KnownPeer>>(new Map());
  const pairedRef = useRef<Map<string, Pairing>>(new Map());
  const convRef = useRef<Map<string, MeshConversation>>(new Map());
  const messagesRef = useRef<MeshMessage[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const announceCooldown = useRef<Map<string, number>>(new Map());
  const loopsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const anchorLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRelayPeerIds = useRef<Set<string>>(new Set());

  // --- persistence bootstrap ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [identity, storedPairings, storedConvs] = await Promise.all([
        loadIdentity(),
        listPairings(),
        loadConversations(),
      ]);
      if (cancelled) return;
      identityRef.current = identity;
      pairedRef.current = new Map(storedPairings.map((p) => [p.peerId, p]));
      setPairings(storedPairings);
      const map = new Map<string, MeshConversation>();
      storedConvs.forEach((c) => map.set(c.id, c));
      if (!map.has(BROADCAST_ID)) {
        map.set(BROADCAST_ID, {
          id: BROADCAST_ID, peerId: null, name: "", paired: false, encrypted: false,
          lastMessage: "", lastAt: 0, unread: 0, online: false,
        });
      }
      convRef.current = map;
      setConversations([...map.values()].sort(sortConversations));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- peer bookkeeping ------------------------------------------------------
  const recomputePeers = useCallback(() => {
    const list = [...peerMapRef.current.values()].sort((a, b) => {
      if (a.simulated !== b.simulated) return a.simulated ? 1 : -1;
      return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
    });
    setPeers(list);
  }, []);

  const mergePeer = useCallback((peer: Partial<KnownPeer> & { id: string; name?: string }) => {
    const existing = peerMapRef.current.get(peer.id) ?? {
      id: peer.id, name: peer.name ?? "ResQ Peer", rssi: -70,
      paired: false, online: false, lastSeen: 0,
    };
    const next: KnownPeer = {
      ...existing, ...peer,
      name: peer.name ?? existing.name,
      lastSeen: peer.online ? Date.now() : existing.lastSeen,
      paired: pairedRef.current.has(peer.id),
    };
    peerMapRef.current.set(peer.id, next);
    recomputePeers();
  }, [recomputePeers]);

  // --- conversations ---------------------------------------------------------
  const persistConversations = useCallback(() => {
    setConversations([...convRef.current.values()].sort(sortConversations));
    void saveConversations([...convRef.current.values()]);
  }, []);

  const ensureConversation = useCallback((peerId: string | null, name: string, encrypted: boolean) => {
    const id = conversationKey(peerId);
    if (!convRef.current.has(id)) {
      convRef.current.set(id, {
        id, peerId, name: peerId === BROADCAST_ID ? "" : name,
        paired: pairedRef.current.has(peerId ?? ""), encrypted,
        lastMessage: "", lastAt: 0, unread: 0,
        online: peerMapRef.current.get(peerId ?? "")?.online ?? false,
      });
    }
    return convRef.current.get(id)!;
  }, []);

  const bumpConversation = useCallback((peerId: string | null, name: string, lastMessage: string, lastAt: number, mine: boolean) => {
    const id = conversationKey(peerId);
    ensureConversation(peerId, name, false);
    const conv = convRef.current.get(id)!;
    const isActive = activeIdRef.current === id;
    convRef.current.set(id, {
      ...conv,
      name: peerId === BROADCAST_ID ? conv.name : (name || conv.name),
      lastMessage, lastAt,
      unread: mine || isActive ? 0 : conv.unread + 1,
    });
    persistConversations();
  }, [ensureConversation, persistConversations]);

  // --- message store ---------------------------------------------------------
  const appendMessage = useCallback(async (msg: MeshMessage) => {
    const isActive = activeIdRef.current === msg.conversationId;
    if (isActive) {
      const next = [...messagesRef.current, msg];
      messagesRef.current = next;
      setMessages(next);
    }
    const existing = await loadMessages(msg.conversationId);
    existing.push(msg);
    await saveMessages(msg.conversationId, existing);
  }, []);

  const sendReceipt = useCallback(async (messageId: string, toPeer: string, receiptStatus: "delivered" | "read") => {
    const identity = identityRef.current;
    if (!identity) return;
    const pairing = pairedRef.current.get(toPeer);
    const raw = await createEnvelope({
      from: identity.id, fromName: meName, to: toPeer, kind: "receipt",
      payload: encodePayload<ReceiptPayload>({ messageId, status: receiptStatus }),
      enc: false, signKeyB64: pairing?.sharedKey ?? null,
    });
    await broadcastMeshMessage(raw);
  }, [meName]);

  const markMine = useCallback((messageId: string, newStatus: MeshMessage["status"]) => {
    const id = activeIdRef.current;
    if (id) {
      messagesRef.current = messagesRef.current.map((m) => (m.id === messageId ? { ...m, status: newStatus } : m));
      setMessages(messagesRef.current);
    }
    void (async () => {
      const target = [...convRef.current.values()].find((c) => c.id === id);
      if (!target) return;
      const stored = await loadMessages(target.id);
      await saveMessages(target.id, stored.map((m) => (m.id === messageId ? { ...m, status: newStatus } : m)));
    })();
  }, []);

  const sendAnnounce = useCallback(async (to: string | null = null) => {
    const identity = identityRef.current;
    if (!identity) return;
    const raw = await createEnvelope({
      from: identity.id, fromName: meName, to,
      kind: "announce", payload: encodePayload<AnnouncePayload>({ publicKey: identity.publicKey, name: meName }),
      enc: false,
    });
    await broadcastMeshMessage(raw);
  }, [meName]);

  const sendPresence = useCallback(async (online: boolean) => {
    const identity = identityRef.current;
    if (!identity) return;
    const raw = await createEnvelope({
      from: identity.id, fromName: meName, to: null,
      kind: "presence", payload: encodePayload<PresencePayload>({ online }), enc: false,
    });
    await broadcastMeshMessage(raw);
  }, [meName]);

  const deliverChat = useCallback(async (env: MeshEnvelope) => {
    const payload = decodePayload<ChatPayload>(env.payload);
    if (!payload) return;
    const convId = env.to === null ? BROADCAST_ID : env.from;
    const pairing = env.from ? pairedRef.current.get(env.from) : undefined;
    let body = payload.text;
    let system = false;
    if (env.enc) {
      if (pairing) {
        try {
          body = await decryptMessage(payload.text, pairing.sharedKey);
        } catch {
          body = "Pesan tidak dapat didekripsi.";
        }
      } else {
        system = true;
        body = "Pesan terenkripsi dari perangkat yang belum dipasangkan.";
      }
    }
    ensureConversation(env.from, env.fromName, env.enc);
    const msg: MeshMessage = {
      id: env.id, conversationId: convId, senderId: env.from, senderName: env.fromName,
      recipientId: env.to, body, createdAt: env.ts, status: "delivered",
      mine: false, encrypted: env.enc, ttl: env.ttl, hop: env.hop, system,
    };
    await appendMessage(msg);
    bumpConversation(env.from, env.fromName, system ? "🔒 Pesan terenkripsi" : body, env.ts, false);
    if (!system) {
      const isActive = activeIdRef.current === convId;
      void sendReceipt(env.id, env.from, isActive ? "read" : "delivered");
    }
  }, [appendMessage, bumpConversation, ensureConversation, sendReceipt]);

  /**
   * Badge accounting for relaying someone else's packet: bump the local relay
   * counter, detect cluster rotation (data-mule), and fire a signed relay ACK
   * back toward the original sender as an offline proof of carriage.
   */
  const countRelayContribution = useCallback(async (env: MeshEnvelope) => {
    void recordRelay();
    const currentIds = new Set([...peerMapRef.current.keys()]);
    const previous = lastRelayPeerIds.current;
    let shared = false;
    previous.forEach((id) => {
      if (currentIds.has(id)) shared = true;
    });
    if (previous.size > 0 && !shared) void recordMuleTransfer();
    lastRelayPeerIds.current = currentIds;

    const identity = identityRef.current;
    if (!identity) return;
    try {
      const sig = await signRelayAck(env.id, identity.id, identity.secret);
      const raw = await createEnvelope({
        from: identity.id, fromName: meName, to: env.from, kind: "relayack",
        payload: encodePayload<RelayAckPayload>({ messageId: env.id, relayedBy: identity.id, sig }),
        enc: false,
      });
      await broadcastMeshMessage(raw);
    } catch {
      /* ACK is best-effort — relay already happened */
    }
  }, [meName]);

  const handleFrame = useCallback(async (raw: string) => {
    const env = decodeEnvelope(raw);
    if (!env) {
      meshBus.receiveRaw(raw);
      return;
    }
    const seen = seenRef.current;
    if (seen.has(env.id)) return;
    seen.set(env.id, Date.now());

    if (!identityRef.current) return;

    switch (env.kind) {
      case "announce": {
        const payload = decodePayload<AnnouncePayload>(env.payload);
        if (!payload) return;
        mergePeer({ id: env.from, name: payload.name || env.fromName, publicKey: payload.publicKey, online: true });
        const last = announceCooldown.current.get(env.from) ?? 0;
        if (Date.now() - last > 4000) {
          announceCooldown.current.set(env.from, Date.now());
          void sendAnnounce(env.from);
        }
        return;
      }
      case "presence": {
        const payload = decodePayload<PresencePayload>(env.payload);
        if (!payload) return;
        mergePeer({ id: env.from, online: payload.online });
        return;
      }
      case "typing": {
        const payload = decodePayload<TypingPayload>(env.payload);
        if (!payload) return;
        const target = env.to === null ? BROADCAST_ID : env.from;
        if (payload.typing && (activeIdRef.current === target || target === BROADCAST_ID)) {
          setTypingPeer(env.from);
          const existing = typingTimers.current.get(env.from);
          if (existing) clearTimeout(existing);
          typingTimers.current.set(env.from, setTimeout(() => setTypingPeer(null), TYPING_CLEAR_MS));
        } else if (!payload.typing) {
          setTypingPeer(null);
        }
        return;
      }
      case "receipt": {
        const payload = decodePayload<ReceiptPayload>(env.payload);
        if (!payload) return;
        markMine(payload.messageId, payload.status);
        return;
      }
      case "relayack": {
        const payload = decodePayload<RelayAckPayload>(env.payload);
        if (!payload) return;
        void recordRelayAck();
        return;
      }
      case "chat": {
        if (env.to === identityRef.current!.id || env.to === null) {
          await deliverChat(env);
        } else if (shouldRelay(env, identityRef.current!.id)) {
          await broadcastMeshMessage(relayEnvelope(env));
          void countRelayContribution(env);
        }
        return;
      }
    }
  }, [countRelayContribution, deliverChat, markMine, mergePeer, sendAnnounce]);

  // --- lifecycle -------------------------------------------------------------
  const activate = useCallback(async () => {
    if (status === "active" || status === "starting") return;
    setStatus("starting");
    setBusy(true);
    const nextAttempts = attempts + 1;
    try {
      const identity = identityRef.current ?? (await loadIdentity());
      identityRef.current = identity;
      const result = await startMesh({
        peerName: meName,
        onPeers: (linkPeers) => {
          linkPeers.forEach((p) => mergePeer({
            id: p.id, name: p.name, rssi: p.rssi, online: true, simulated: p.simulated, link: p.link,
          }));
        },
        onFrame: (raw) => void handleFrame(raw),
      });
      if (result === "active") {
        setStatus("active");
        setAttempts(0);
        meshBus.setBroadcast((payload) => broadcastMeshMessage(payload));
        await sendAnnounce(null);
        await sendPresence(true);
        const announceLoop = setInterval(() => void sendAnnounce(null), ANNOUNCE_INTERVAL_MS);
        const presenceLoop = setInterval(() => void sendPresence(true), PRESENCE_INTERVAL_MS);
        loopsRef.current = [announceLoop, presenceLoop];
        if (!anchorLoopRef.current) {
          anchorLoopRef.current = setInterval(() => void flushAnchorSeconds(60), ANCHOR_TICK_MS);
        }
      } else {
        setStatus(result);
        setAttempts(nextAttempts);
      }
    } catch {
      setStatus("unsupported");
      setAttempts(nextAttempts);
    } finally {
      setBusy(false);
    }
  }, [attempts, handleFrame, meName, mergePeer, sendAnnounce, sendPresence, status]);

  const deactivate = useCallback(() => {
    loopsRef.current.forEach((t) => clearInterval(t));
    loopsRef.current = [];
    if (anchorLoopRef.current) {
      clearInterval(anchorLoopRef.current);
      anchorLoopRef.current = null;
    }
    void flushAnchorSeconds(0).catch(() => undefined);
    void sendPresence(false).catch(() => undefined);
    meshBus.setBroadcast(null);
    stopMesh();
    setStatus("idle");
  }, [sendPresence]);

  useEffect(() => () => {
    loopsRef.current.forEach((t) => clearInterval(t));
    if (anchorLoopRef.current) clearInterval(anchorLoopRef.current);
    stopMesh();
    meshBus.setBroadcast(null);
  }, []);

  const sendTyping = useCallback(async (typing: boolean) => {
    const identity = identityRef.current;
    if (!identity) return;
    const id = activeIdRef.current;
    const peerId = id === BROADCAST_ID ? null : id;
    const raw = await createEnvelope({
      from: identity.id, fromName: meName, to: peerId,
      kind: "typing", payload: encodePayload<TypingPayload>({ typing }), enc: false,
    });
    await broadcastMeshMessage(raw);
  }, [meName]);

  // --- sending ---------------------------------------------------------------
  const sendMessage = useCallback(async (text: string) => {
    const body = text.trim();
    const id = activeIdRef.current;
    if (!body || !id) return;
    const identity = identityRef.current;
    if (!identity) return;
    const peerId = id === BROADCAST_ID ? null : id;
    const pairing = peerId ? pairedRef.current.get(peerId) : undefined;

    let enc = false;
    let payloadStr = encodePayload<ChatPayload>({ text: body });
    let signKey: string | null = null;
    if (pairing) {
      enc = true;
      payloadStr = await encryptMessage(body, pairing.sharedKey);
      signKey = pairing.sharedKey;
    }
    const env = JSON.parse(
      await createEnvelope({
        from: identity.id, fromName: meName, to: peerId, kind: "chat",
        payload: payloadStr, enc, signKeyB64: signKey,
      }),
    ) as MeshEnvelope;
    seenRef.current.set(env.id, Date.now());

    ensureConversation(peerId, meName, enc);
    const msg: MeshMessage = {
      id: env.id, conversationId: id, senderId: identity.id, senderName: meName,
      recipientId: peerId, body, createdAt: Date.now(),
      status: peerMapRef.current.size > 0 ? "sent" : "queued",
      mine: true, encrypted: enc, ttl: DEFAULT_TTL, hop: 0,
    };
    await appendMessage(msg);
    bumpConversation(peerId, meName, body, msg.createdAt, true);
    await broadcastMeshMessage(JSON.stringify(env));
    void sendTyping(false);
  }, [appendMessage, bumpConversation, ensureConversation, meName, sendTyping]);

  // --- pairing ---------------------------------------------------------------
  const pairPeer = useCallback(async (peerId: string, code: string) => {
    const identity = identityRef.current;
    const peer = peerMapRef.current.get(peerId);
    if (!identity || !peer?.publicKey) throw new Error("peer_unavailable");
    const pairing = await createPairing(identity, peerId, peer.name, peer.publicKey, code.trim());
    pairedRef.current.set(peerId, pairing);
    setPairings([...pairedRef.current.values()]);
    mergePeer({ id: peerId, paired: true });
    const conv = convRef.current.get(conversationKey(peerId));
    if (conv) {
      convRef.current.set(conv.id, { ...conv, paired: true, encrypted: true });
      persistConversations();
    }
    await sendAnnounce(peerId);
    return pairing;
  }, [mergePeer, persistConversations, sendAnnounce]);

  const unpairPeer = useCallback(async (peerId: string) => {
    pairedRef.current.delete(peerId);
    await removeStoredPairing(peerId);
    setPairings([...pairedRef.current.values()]);
    mergePeer({ id: peerId, paired: false });
    const conv = convRef.current.get(conversationKey(peerId));
    if (conv) {
      convRef.current.set(conv.id, { ...conv, paired: false, encrypted: false });
      persistConversations();
    }
  }, [mergePeer, persistConversations]);

  // --- conversation selection ----------------------------------------------
  const openConversation = useCallback(async (peerId: string | null) => {
    const id = conversationKey(peerId);
    activeIdRef.current = id;
    setActiveId(id);
    setTypingPeer(null);
    const loaded = await loadMessages(id);
    messagesRef.current = loaded;
    setMessages(loaded);
    const conv = convRef.current.get(id);
    if (conv && conv.unread !== 0) {
      convRef.current.set(id, { ...conv, unread: 0 });
      persistConversations();
    }
    if (peerId) {
      const senders = new Set<string>();
      loaded.forEach((m) => { if (!m.mine && m.status !== "read") senders.add(m.senderId); });
      senders.forEach((sender) => {
        loaded.forEach((m) => { if (!m.mine && m.senderId === sender) void sendReceipt(m.id, sender, "read"); });
      });
    }
  }, [persistConversations, sendReceipt]);

  const reloadConversations = useCallback(() => {
    setConversations([...convRef.current.values()].sort(sortConversations));
  }, []);

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread, 0);

  return {
    status, busy, attempts, peers, conversations, activeId, messages,
    typingPeer, pairings, unreadTotal, identity: identityRef.current,
    activate, deactivate, openConversation, sendMessage, sendTyping,
    pairPeer, unpairPeer, reloadConversations,
  };
}

export type MeshChatApi = ReturnType<typeof useMeshChat>;

// Local persistence for the mesh chat: conversations, message history, known
// peers and the de-duplication ledger. Values auto-expire and are bounded so
// the store never grows without limit on a phone. Uses AsyncStorage directly
// because conversation/message objects exceed the primitive-only storage helper.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MeshConversation, MeshMessage, MeshPeer } from "@/src/types";

const CONV_KEY = "resq-mesh-conversations";
const PEERS_KEY = "resq-mesh-peers";
const SEEN_KEY = "resq-mesh-seen";
const MSG_PREFIX = "resq-mesh-messages-";
const MAX_MESSAGES = 400;

export const BROADCAST_ID = "__mesh__";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export async function loadConversations(): Promise<MeshConversation[]> {
  return readJson<MeshConversation[]>(CONV_KEY, []);
}

export async function saveConversations(conversations: MeshConversation[]): Promise<void> {
  await writeJson(CONV_KEY, conversations);
}

export async function loadMessages(conversationId: string): Promise<MeshMessage[]> {
  return readJson<MeshMessage[]>(`${MSG_PREFIX}${conversationId}`, []);
}

export async function saveMessages(conversationId: string, messages: MeshMessage[]): Promise<void> {
  const trimmed = messages.length > MAX_MESSAGES ? messages.slice(messages.length - MAX_MESSAGES) : messages;
  await writeJson(`${MSG_PREFIX}${conversationId}`, trimmed);
}

export async function loadPeers(): Promise<MeshPeer[]> {
  return readJson<MeshPeer[]>(PEERS_KEY, []);
}

export async function savePeers(peers: MeshPeer[]): Promise<void> {
  await writeJson(PEERS_KEY, peers);
}

export async function loadSeen(): Promise<Record<string, number>> {
  return readJson<Record<string, number>>(SEEN_KEY, {});
}

export async function saveSeen(seen: Record<string, number>): Promise<void> {
  await writeJson(SEEN_KEY, seen);
}

export async function clearMeshData(): Promise<void> {
  const conversations = await loadConversations();
  await Promise.all(conversations.map((c) => AsyncStorage.removeItem(`${MSG_PREFIX}${c.id}`)));
  await AsyncStorage.removeItem(CONV_KEY);
  await AsyncStorage.removeItem(PEERS_KEY);
  await AsyncStorage.removeItem(SEEN_KEY);
}

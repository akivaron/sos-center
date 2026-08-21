// Local badge/achievement engine for the offline mesh network. Counters live
// in AsyncStorage so they keep accumulating with zero connectivity; every
// metric can later be synced to the account profile once the device is back
// online. Relay acknowledgements carry a lightweight HMAC signature produced
// with the local mesh identity secret, giving each counter a verifiable
// offline proof trail.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { hmac } from "./meshCrypto";

const STATS_KEY = "resq-badge-stats";
const ANCHOR_PENDING_KEY = "resq-badge-anchor-pending";

export interface BadgeStats {
  /** Messages owned by others that this device relayed onward. */
  relays: number;
  /** Signed relay ACKs received back from downstream peers. */
  relayAcks: number;
  /** Cluster-to-cluster data mule transfers (peer set fully rotated). */
  muleTransfers: number;
  /** Accumulated seconds as a stable anchor node. */
  anchorSeconds: number;
  /** Times this device was the first to push offline mesh traffic online. */
  gatewayUploads: number;
}

export const EMPTY_STATS: BadgeStats = {
  relays: 0,
  relayAcks: 0,
  muleTransfers: 0,
  anchorSeconds: 0,
  gatewayUploads: 0,
};

export type BadgeId = "signal_booster" | "data_mule" | "anchor" | "gateway";
export type BadgeLevel = "none" | "bronze" | "silver" | "gold";

export interface BadgeDefinition {
  id: BadgeId;
  icon: string;
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
  /** Metric thresholds for bronze / silver / gold. */
  thresholds: [number, number, number];
  unitId: (value: number) => string;
  unitEn: (value: number) => string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "signal_booster",
    icon: "access-point-network",
    titleId: "Penyambung Sinyal",
    titleEn: "Signal Booster",
    descId: "Meneruskan paket pesan orang lain di latar belakang.",
    descEn: "Relay other people's messages in the background.",
    thresholds: [10, 100, 1000],
    unitId: (v) => `${v} pesan diteruskan`,
    unitEn: (v) => `${v} messages relayed`,
  },
  {
    id: "data_mule",
    icon: "truck-delivery-outline",
    titleId: "Kurir Kota / Desa",
    titleEn: "Data Mule Master",
    descId: "Membawa data antar klaster yang terputus jaringan.",
    descEn: "Carry data between disconnected clusters.",
    thresholds: [1, 5, 25],
    unitId: (v) => `${v} transfer antar klaster`,
    unitEn: (v) => `${v} inter-cluster transfers`,
  },
  {
    id: "anchor",
    icon: "shield-anchor",
    titleId: "Penjaga Posko",
    titleEn: "Anchor Guardian",
    descId: "Menjaga node tetap aktif di satu titik kumpul.",
    descEn: "Keep a stable node alive at a gathering point.",
    thresholds: [4 * 3600, 12 * 3600, 48 * 3600],
    unitId: (v) => `${Math.floor(v / 3600)} jam aktif`,
    unitEn: (v) => `${Math.floor(v / 3600)}h uptime`,
  },
  {
    id: "gateway",
    icon: "cloud-upload-outline",
    titleId: "Jembatan Dunia Luar",
    titleEn: "Gateway Hero",
    descId: "Orang pertama mengunggah pesan offline mesh ke internet.",
    descEn: "First to upload offline mesh messages to the internet.",
    thresholds: [1, 5, 25],
    unitId: (v) => `${v} kali unggah gateway`,
    unitEn: (v) => `${v} gateway uploads`,
  },
];

export function badgeLevel(def: BadgeDefinition, stats: BadgeStats): BadgeLevel {
  const value = metricFor(def.id, stats);
  if (value >= def.thresholds[2]) return "gold";
  if (value >= def.thresholds[1]) return "silver";
  if (value >= def.thresholds[0]) return "bronze";
  return "none";
}

export function metricFor(id: BadgeId, stats: BadgeStats): number {
  switch (id) {
    case "signal_booster": return stats.relays;
    case "data_mule": return stats.muleTransfers;
    case "anchor": return stats.anchorSeconds;
    case "gateway": return stats.gatewayUploads;
  }
}

export function nextThreshold(def: BadgeDefinition, stats: BadgeStats): { target: number; level: Exclude<BadgeLevel, "none"> } | null {
  const value = metricFor(def.id, stats);
  if (value < def.thresholds[0]) return { target: def.thresholds[0], level: "bronze" };
  if (value < def.thresholds[1]) return { target: def.thresholds[1], level: "silver" };
  if (value < def.thresholds[2]) return { target: def.thresholds[2], level: "gold" };
  return null;
}

// --- persistence ---------------------------------------------------------------

export async function loadBadgeStats(): Promise<BadgeStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<BadgeStats>;
    return { ...EMPTY_STATS, ...parsed };
  } catch {
    return { ...EMPTY_STATS };
  }
}

async function updateStats(mutate: (stats: BadgeStats) => BadgeStats): Promise<BadgeStats> {
  const stats = mutate(await loadBadgeStats());
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* storage full — counters stay in memory for this session */
  }
  return stats;
}

export function recordRelay(): Promise<BadgeStats> {
  return updateStats((s) => ({ ...s, relays: s.relays + 1 }));
}

export function recordRelayAck(): Promise<BadgeStats> {
  return updateStats((s) => ({ ...s, relayAcks: s.relayAcks + 1 }));
}

export function recordMuleTransfer(): Promise<BadgeStats> {
  return updateStats((s) => ({ ...s, muleTransfers: s.muleTransfers + 1 }));
}

export function recordGatewayUpload(): Promise<BadgeStats> {
  return updateStats((s) => ({ ...s, gatewayUploads: s.gatewayUploads + 1 }));
}

/** Flush pending anchor seconds accumulated by the mesh session ticker. */
export async function flushAnchorSeconds(seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const pending = await readAnchorPending();
  await AsyncStorage.setItem(ANCHOR_PENDING_KEY, JSON.stringify(pending + seconds));
  await updateStats((s) => ({ ...s, anchorSeconds: s.anchorSeconds + pending + seconds }));
  await AsyncStorage.removeItem(ANCHOR_PENDING_KEY);
}

async function readAnchorPending(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ANCHOR_PENDING_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

// --- signed relay ACK proof ------------------------------------------------------

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
}

/**
 * Lightweight signature proving "packet X was received via device A".
 * `secretB64` is the receiver's own mesh identity secret.
 */
export async function signRelayAck(messageId: string, relayedBy: string, secretB64: string): Promise<string> {
  const canonical = `relayack.${messageId}.${relayedBy}`;
  const digest = await hmac(new TextEncoder().encode(secretB64), new TextEncoder().encode(canonical));
  return bytesToB64(digest);
}

export async function verifyRelayAck(messageId: string, relayedBy: string, secretB64: string, sig: string): Promise<boolean> {
  if (!sig) return false;
  const expected = await signRelayAck(messageId, relayedBy, secretB64);
  return expected === sig;
}

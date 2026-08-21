// Web shim for the Wi-Fi Direct nearby-device scanner. Wi-Fi P2P is an Android
// only API, so in the browser this module is a no-op that reports unsupported.

import type { MeshPeer } from "@/src/types";

export type WifiP2pPeer = MeshPeer;

export function isWifiP2pSupported(): boolean {
  return false;
}

export async function startWifiScan(_onPeers: (peers: MeshPeer[]) => void): Promise<() => void> {
  return () => undefined;
}

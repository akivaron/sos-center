// TypeScript fallback. Metro selects mesh.native.ts or mesh.web.ts at runtime.
import * as web from "./mesh.web";

export type MeshPeer = { id: string; name: string; rssi: number };
export type MeshStartResult = {
  status: "active" | "denied" | "disabled" | "unsupported";
  peers: MeshPeer[];
};

export async function startMesh(
  peerName: string,
  onPeers: (peers: MeshPeer[]) => void,
  onMessage: (body: string, sender: string) => void,
): Promise<MeshStartResult> {
  return web.startMesh(peerName, onPeers, onMessage);
}

export async function sendMeshMessage(peerId: string, body: string) {
  return web.sendMeshMessage(peerId, body);
}

export function stopMesh() {
  return web.stopMesh();
}
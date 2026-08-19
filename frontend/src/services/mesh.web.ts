export type MeshPeer = { id: string; name: string; rssi: number };
export type MeshStartResult = { status: "unsupported"; peers: MeshPeer[] };

export async function startMesh(
  _peerName: string,
  _onPeers: (peers: MeshPeer[]) => void,
  _onMessage: (body: string, sender: string) => void,
): Promise<MeshStartResult> {
  return { status: "unsupported", peers: [] };
}

export async function sendMeshMessage(_peerId: string, _body: string) {
  throw new Error("BLE_UNSUPPORTED");
}

export function stopMesh() {}
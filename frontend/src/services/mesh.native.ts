import {
  addDeviceFoundListener,
  addEventListener,
  connect,
  discoverServices,
  isBluetoothEnabled,
  requestBluetoothPermission,
  setServices,
  startAdvertising,
  startScan,
  stopAdvertising,
  stopScan,
  writeCharacteristic,
} from "munim-bluetooth";

export type MeshPeer = { id: string; name: string; rssi: number };
export type MeshStartResult = { status: "active" | "denied" | "disabled"; peers: MeshPeer[] };

const SERVICE_UUID = "8f7d0001-5e21-4b9a-9a01-6a2e2b5d1000";
const CHAT_UUID = "8f7d0002-5e21-4b9a-9a01-6a2e2b5d1000";
let removeFound: (() => void) | null = null;
let removeWrite: (() => void) | null = null;

function toHex(text: string) {
  return Array.from(new TextEncoder().encode(text))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((value) => parseInt(value, 16)) ?? []);
  return new TextDecoder().decode(bytes);
}

export async function startMesh(
  peerName: string,
  onPeers: (peers: MeshPeer[]) => void,
  onMessage: (body: string, sender: string) => void,
): Promise<MeshStartResult> {
  const granted = await requestBluetoothPermission(["scan", "connect", "advertise"]);
  if (!granted) return { status: "denied", peers: [] };
  if (!(await isBluetoothEnabled())) return { status: "disabled", peers: [] };

  const found = new Map<string, MeshPeer>();
  setServices([{
    uuid: SERVICE_UUID,
    characteristics: [{
      uuid: CHAT_UUID,
      properties: ["read", "write", "writeWithoutResponse", "notify"],
      permissions: ["readEncrypted", "writeEncrypted"],
      value: "00",
    }],
  }]);
  removeWrite?.();
  removeWrite = addEventListener("peripheralWriteRequest", ({ centralId, value }) => {
    try { onMessage(fromHex(value), centralId); } catch { /* malformed frame */ }
  });
  removeFound?.();
  removeFound = addDeviceFoundListener((device) => {
    found.set(device.id, {
      id: device.id,
      name: device.localName ?? device.name ?? "ResQ Peer",
      rssi: device.rssi ?? -90,
    });
    onPeers([...found.values()].sort((a, b) => b.rssi - a.rssi));
  });
  startAdvertising({ serviceUUIDs: [SERVICE_UUID], localName: `ResQ-${peerName.slice(0, 8)}` });
  startScan({ serviceUUIDs: [SERVICE_UUID], allowDuplicates: true, scanMode: "balanced" });
  return { status: "active", peers: [] };
}

export async function sendMeshMessage(peerId: string, body: string) {
  await connect(peerId);
  await discoverServices(peerId);
  await writeCharacteristic(peerId, SERVICE_UUID, CHAT_UUID, toHex(body), "write");
}

export function stopMesh() {
  stopScan();
  stopAdvertising();
  removeFound?.();
  removeWrite?.();
  removeFound = null;
  removeWrite = null;
}
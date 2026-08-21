// Native mesh transport over Bluetooth Low Energy. Carries already-encoded
// mesh envelopes as hex strings across a custom GATT characteristic. Encryption,
// relay and de-duplication are handled by the protocol layer; the link layer is
// OS-encrypted (writeEncrypted), so nearby traffic is confidential in transit.

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

import type { MeshPeer } from "@/src/types";
import type { MeshStartOptions, MeshTransport, MeshTransportStatus } from "./meshProtocol";

const SERVICE_UUID = "8f7d0001-5e21-4b9a-9a01-6a2e2b5d1000";
const CHAT_UUID = "8f7d0002-5e21-4b9a-9a01-6a2e2b5d1000";

let removeFound: (() => void) | null = null;
let removeWrite: (() => void) | null = null;
const peers = new Map<string, MeshPeer>();

function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): string {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((value) => parseInt(value, 16)) ?? []);
  return new TextDecoder().decode(bytes);
}

class NativeMeshTransport implements MeshTransport {
  private opts: MeshStartOptions | null = null;

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;
    const granted = await requestBluetoothPermission(["scan", "connect", "advertise"]);
    if (!granted) return "denied";
    if (!(await isBluetoothEnabled())) return "disabled";

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
      try {
        this.opts?.onFrame(fromHex(value), centralId);
      } catch {
        /* malformed frame */
      }
    });
    removeFound?.();
    removeFound = addDeviceFoundListener((device) => {
      peers.set(device.id, {
        id: device.id,
        name: device.localName ?? device.name ?? "ResQ Peer",
        rssi: device.rssi ?? -90,
        paired: false,
        online: true,
        lastSeen: Date.now(),
      });
      this.emitPeers();
    });
    startAdvertising({ serviceUUIDs: [SERVICE_UUID], localName: `ResQ-${opts.peerName.slice(0, 8)}` });
    startScan({ serviceUUIDs: [SERVICE_UUID], allowDuplicates: true, scanMode: "balanced" });
    return "active";
  }

  async broadcast(raw: string): Promise<void> {
    const targets = [...peers.keys()];
    await Promise.all(targets.map(async (peerId) => {
      try {
        await connect(peerId);
        await discoverServices(peerId);
        await writeCharacteristic(peerId, SERVICE_UUID, CHAT_UUID, toHex(raw), "write");
      } catch {
        /* peer dropped mid-send */
      }
    }));
  }

  async send(peerId: string, raw: string): Promise<void> {
    try {
      await connect(peerId);
      await discoverServices(peerId);
      await writeCharacteristic(peerId, SERVICE_UUID, CHAT_UUID, toHex(raw), "write");
    } catch {
      /* peer unreachable */
    }
  }

  stop(): void {
    stopScan();
    stopAdvertising();
    removeFound?.();
    removeWrite?.();
    removeFound = null;
    removeWrite = null;
    peers.clear();
  }

  private emitPeers() {
    this.opts?.onPeers([...peers.values()].sort((a, b) => b.rssi - a.rssi));
  }
}

export function createNativeTransport(): MeshTransport {
  return new NativeMeshTransport();
}

const transport = createNativeTransport();
export const startMesh = (opts: MeshStartOptions) => transport.start(opts);
export const broadcastMeshMessage = (raw: string) => transport.broadcast(raw);
export const sendMeshMessage = (peerId: string, raw: string) => transport.send(peerId, raw);
export const stopMesh = () => transport.stop();
export type { MeshTransportStatus };

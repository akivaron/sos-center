// Native composite mesh transport. Combines the offline transports:
//   - BLE central (react-native-ble-plx)      -> low-power mesh chat over GATT
//   - BLE peripheral (react-native-multi-ble-peripheral) -> advertises the ResQ
//       mesh service so peers running the central transport can discover and
//       connect to us over BLE (phone-to-phone, no Wi-Fi Direct required)
//   - Wi-Fi Direct (react-native-wifi-p2p + tcp-socket) -> nearby device scanner
//       and a higher-bandwidth chat link
//
// All transports satisfy the same MeshTransport contract; this layer fans out
// broadcast/send to whichever links are live and merges the discovered peers
// (deduplicated by id) into a single peer list for the UI. The protocol layer
// still owns encryption, relay and de-duplication.

import type { MeshPeer } from "@/src/types";
import type { MeshStartOptions, MeshTransport, MeshTransportStatus } from "./meshProtocol";

import { createBleTransport } from "./mesh.ble";
import { createPeripheralTransport } from "./mesh.peripheral";
import { createWifiTransport } from "./wifiP2p.native";

class HybridMeshTransport implements MeshTransport {
  private ble = createBleTransport();
  private peripheral = createPeripheralTransport();
  private wifi = createWifiTransport();
  private blePeers = new Map<string, MeshPeer>();
  private wifiPeers = new Map<string, MeshPeer>();
  private opts: MeshStartOptions | null = null;

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;

    const emitMerged = () => {
      const byId = new Map<string, MeshPeer>();
      [...this.blePeers.values(), ...this.wifiPeers.values()].forEach((peer) => {
        const existing = byId.get(peer.id);
        if (!existing || (peer.online && !existing.online)) byId.set(peer.id, peer);
      });
      this.opts?.onPeers([...byId.values()].sort((a, b) => b.rssi - a.rssi));
    };

    const bleStatus = await this.ble.start({
      ...opts,
      onPeers: (peers) => {
        this.blePeers = new Map(peers.map((p) => [p.id, p]));
        emitMerged();
      },
      onFrame: (raw, id) => this.opts?.onFrame(raw, id),
    });

    // Peripheral is best-effort: it never breaks the mesh if it is unavailable
    // (Expo Go, missing SDK-33 patch, adapter busy). The composite is still
    // "active" as long as the central or Wi-Fi link is up.
    const peripheralStatus = await this.peripheral.start({
      ...opts,
      onPeers: () => undefined,
      onFrame: (raw, id) => this.opts?.onFrame(raw, id),
    }).catch(() => "unsupported" as MeshTransportStatus);

    const wifiStatus = await this.wifi.start({
      ...opts,
      onPeers: (peers) => {
        this.wifiPeers = new Map(peers.map((p) => [p.id, p]));
        emitMerged();
      },
      onFrame: (raw, id) => this.opts?.onFrame(raw, id),
    });

    if (bleStatus === "active" || wifiStatus === "active" || peripheralStatus === "active") return "active";
    return bleStatus !== "idle" ? bleStatus : wifiStatus;
  }

  async broadcast(raw: string): Promise<void> {
    await Promise.all([
      this.ble.broadcast(raw),
      this.peripheral.broadcast(raw),
      this.wifi.broadcast(raw),
    ]);
  }

  async send(peerId: string, raw: string): Promise<void> {
    if (this.blePeers.has(peerId)) await this.ble.send(peerId, raw);
    else await this.wifi.send(peerId, raw);
  }

  stop(): void {
    this.ble.stop();
    this.peripheral.stop();
    this.wifi.stop();
    this.blePeers.clear();
    this.wifiPeers.clear();
    this.opts = null;
  }
}

export function createNativeTransport(): MeshTransport {
  return new HybridMeshTransport();
}

const transport = createNativeTransport();
export const startMesh = (opts: MeshStartOptions) => transport.start(opts);
export const broadcastMeshMessage = (raw: string) => transport.broadcast(raw);
export const sendMeshMessage = (peerId: string, raw: string) => transport.send(peerId, raw);
export const stopMesh = () => transport.stop();
export type { MeshTransportStatus };

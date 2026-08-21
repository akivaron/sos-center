// Native mesh transport over Bluetooth Low Energy, built on react-native-ble-plx.
//
// Each ResQ device runs as a BLE central: it scans for peers advertising the
// ResQ mesh service, connects, and exchanges mesh envelopes over a single
// writable + notifying GATT characteristic. Inbound frames arrive via the
// characteristic notification; outbound frames are writes. The protocol layer
// handles encryption, relay and de-duplication — the link layer only moves
// base64-framed strings (see meshCodec).
//
// NOTE: react-native-ble-plx is a GATT *client* (central) only — it cannot
// advertise a local service. A peer is therefore reachable whenever *it*
// advertises the ResQ service (e.g. the Wi-Fi Direct path, or another app's
// peripheral). The composite transport in mesh.native.ts adds a Wi-Fi Direct
// link so two ResQ phones can also chat without a third-party peripheral.

import { PermissionsAndroid, Platform } from "react-native";

import {
  BleManager,
  type BleError,
  type Characteristic,
  type Device,
  type State,
} from "react-native-ble-plx";

import type { MeshPeer } from "@/src/types";
import type { MeshStartOptions, MeshTransport, MeshTransportStatus } from "./meshProtocol";
import { LinkReassembler, base64ToText, splitForLink, textToBase64 } from "./meshCodec";

const SERVICE_UUID = "8f7d0001-5e21-4b9a-9a01-6a2e2b5d1000";
const CHAT_UUID = "8f7d0002-5e21-4b9a-9a01-6a2e2b5d1000";
const REQUESTED_MTU = 512;

type Link = {
  device: Device;
  mtu: number;
  reassembler: LinkReassembler;
  monitor?: { remove(): void };
};

function isReady(state: State): boolean {
  return state === "PoweredOn";
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(results).every((r) => r === "granted" || r === "never_ask_again");
}

class BleMeshTransport implements MeshTransport {
  private manager: BleManager | null = null;
  private opts: MeshStartOptions | null = null;
  private links = new Map<string, Link>();
  private peers = new Map<string, MeshPeer>();
  private scanSubscription: { remove(): void } | null = null;
  private stateSubscription: { remove(): void } | null = null;

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;
    if (Platform.OS === "ios") {
      // iOS silently exposes the service once the app is entitled; no runtime prompt here.
    } else if (!(await requestBlePermissions())) {
      return "denied";
    }

    const manager = new BleManager();
    this.manager = manager;
    const state = await manager.state();
    if (!isReady(state)) {
      // Wait briefly for the adapter to power on (e.g. user toggles it).
      const poweredOn = await new Promise<boolean>((resolve) => {
        const sub = manager.onStateChange((next: State) => {
          if (isReady(next)) {
            sub.remove();
            resolve(true);
          }
        }, true);
        setTimeout(() => {
          sub.remove();
          resolve(false);
        }, 4000);
      });
      if (!poweredOn) return state === "PoweredOff" ? "disabled" : "unsupported";
    }

    this.scanSubscription = manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (error: BleError | null, device: Device | null) => {
        if (error || !device) return;
        this.onDeviceFound(device);
      },
    );
    return "active";
  }

  private onDeviceFound(device: Device): void {
    const id = device.id;
    const name = device.name ?? device.localName ?? "ResQ Peer";
    const rssi = device.rssi ?? -90;
    const known = this.peers.get(id);
    if (!known) {
      this.peers.set(id, {
        id, name, rssi, paired: false, online: true, lastSeen: Date.now(), link: "ble",
      });
      this.emitPeers();
      void this.connect(id);
    } else {
      known.rssi = rssi;
      known.lastSeen = Date.now();
      if (!known.online) {
        known.online = true;
        this.emitPeers();
      }
    }
  }

  private async connect(deviceId: string): Promise<void> {
    const manager = this.manager;
    if (!manager || this.links.has(deviceId)) return;
    try {
      await manager.connectToDevice(deviceId);
      const withMtu = await manager.requestMTUForDevice(deviceId, REQUESTED_MTU).catch(() => null);
      const device = withMtu ?? (await manager.devices([deviceId]))[0];
      if (!device) return;
      await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);
      const mtu = device.mtu ?? REQUESTED_MTU;
      const reassembler = new LinkReassembler();
      const monitor = manager.monitorCharacteristicForDevice(
        deviceId,
        SERVICE_UUID,
        CHAT_UUID,
        (error: BleError | null, characteristic: Characteristic | null) => {
          if (error || !characteristic?.value) return;
          const complete = reassembler.push(base64ToText(characteristic.value));
          if (complete) this.opts?.onFrame(base64ToText(complete), deviceId);
        },
      );
      this.links.set(deviceId, { device, mtu, reassembler, monitor });
      manager.onDeviceDisconnected(deviceId, () => this.onDisconnected(deviceId));
    } catch {
      this.links.delete(deviceId);
      const peer = this.peers.get(deviceId);
      if (peer) {
        peer.online = false;
        this.emitPeers();
      }
    }
  }

  private onDisconnected(deviceId: string): void {
    this.links.get(deviceId)?.monitor?.remove();
    this.links.delete(deviceId);
    const peer = this.peers.get(deviceId);
    if (peer) {
      peer.online = false;
      this.emitPeers();
    }
  }

  async broadcast(raw: string): Promise<void> {
    const frames = splitForLink(textToBase64(raw), this.minMtu() - 3);
    await Promise.all([...this.links.keys()].map((id) => this.writeFrames(id, frames)));
  }

  async send(peerId: string, raw: string): Promise<void> {
    const frames = splitForLink(textToBase64(raw), this.minMtu() - 3);
    await this.writeFrames(peerId, frames);
  }

  private minMtu(): number {
    let min = REQUESTED_MTU;
    this.links.forEach((link) => { min = Math.min(min, link.mtu); });
    return min;
  }

  private async writeFrames(deviceId: string, frames: string[]): Promise<void> {
    const link = this.links.get(deviceId);
    const manager = this.manager;
    if (!link || !manager) return;
    try {
      for (const frame of frames) {
        await manager.writeCharacteristicWithResponseForDevice(
          deviceId,
          SERVICE_UUID,
          CHAT_UUID,
          textToBase64(frame),
          null,
        );
      }
    } catch {
      this.onDisconnected(deviceId);
    }
  }

  stop(): void {
    const manager = this.manager;
    this.scanSubscription?.remove();
    this.stateSubscription?.remove();
    this.scanSubscription = null;
    this.stateSubscription = null;
    this.links.forEach((link) => link.monitor?.remove());
    if (manager) {
      this.links.forEach((_, id) => void manager.cancelDeviceConnection(id).catch(() => undefined));
    }
    this.links.clear();
    this.peers.clear();
    this.manager = null;
  }

  private emitPeers(): void {
    this.opts?.onPeers([...this.peers.values()].sort((a, b) => b.rssi - a.rssi));
  }
}

export function createBleTransport(): MeshTransport {
  return new BleMeshTransport();
}

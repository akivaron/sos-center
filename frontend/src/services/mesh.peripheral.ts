// Native BLE peripheral mesh transport, built on react-native-multi-ble-peripheral.
//
// react-native-ble-plx (mesh.ble.ts) is a GATT *central* only: it can scan for
// and connect to peers, but it cannot advertise the ResQ mesh service. Without a
// peripheral, two ResQ phones can only mesh over Wi-Fi Direct. This transport
// turns each device into a BLE peripheral that advertises the shared mesh
// service (connectable) with the CHAT characteristic, so a peer running the
// central transport can discover and connect to us over BLE alone — enabling
// the mesh device scanner and mech chat to work phone-to-phone without Wi-Fi
// Direct. It also accepts inbound writes and can notify connected centrals,
// which provides a redundant broadcast path that complements the central link.
//
// Caveats (see README of react-native-multi-ble-peripheral):
//  - Requires a development build (NOT Expo Go) and, on Android SDK 33+, the
//    `notifyCharacteristicChanged(... value)` Kotlin patch from its README.
//  - Runs a second BLE stack alongside react-native-ble-plx; on Android both
//    share the Bluetooth adapter. Advertising + scanning generally coexist.
//  - The native 'write' event does not carry the central's id, so inbound frames
//    are attributed to a synthetic peer. Protocol-level de-duplication (by
//    envelope id in useMeshChat) collapses the duplicate delivered over the
//    central link, so chat attribution stays correct (it keys on env.from).

import { Buffer } from "buffer";
import { PermissionsAndroid, Platform } from "react-native";

// @ts-ignore - types ship with the package; ignored so checkout type-checks
// before the native module is installed.
import Peripheral, {
  AdvertiseMode,
  Permission,
  Property,
} from "react-native-multi-ble-peripheral";

import type { MeshStartOptions, MeshTransport, MeshTransportStatus } from "./meshProtocol";
import { LinkReassembler, base64ToText, splitForLink, textToBase64 } from "./meshCodec";

const SERVICE_UUID = "8f7d0001-5e21-4b9a-9a01-6a2e2b5d1000";
const CHAT_UUID = "8f7d0002-5e21-4b9a-9a01-6a2e2b5d1000";
const PERIPHERAL_PEER_ID = "ble-peripheral";

// Conservative ATT payload: an Android central may not negotiate a large MTU on
// the peripheral's notify path, so stay within the 23-byte default ATT MTU.
const PERIPHERAL_MTU = 20;

async function requestAdvertisePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return Object.values(results).every((r) => r === "granted" || r === "never_ask_again");
}

interface PeripheralWriteEvent {
  serviceUuid: string;
  characteristicUuid: string;
  value: string;
}

// The shipped types declare Peripheral as extending EventEmitter but omit the
// listener methods, so add them back for our usage.
interface PeripheralEmitter extends Peripheral {
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
}

class PeripheralMeshTransport implements MeshTransport {
  private opts: MeshStartOptions | null = null;
  private peripheral: PeripheralEmitter | null = null;
  private reassembler = new LinkReassembler();
  private advertising = false;
  private ready: Promise<MeshTransportStatus> | null = null;

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;
    if (Platform.OS === "android" && !(await requestAdvertisePermissions())) {
      return "denied";
    }
    try {
      const status = await this.ensureAdvertising(opts.peerName);
      return status;
    } catch {
      this.stop();
      return "unsupported";
    }
  }

  private ensureAdvertising(peerName: string): Promise<MeshTransportStatus> {
    if (this.ready) return this.ready;
    this.ready = new Promise<MeshTransportStatus>((resolve, reject) => {
      let peripheral: PeripheralEmitter;
      try {
        peripheral = new Peripheral() as PeripheralEmitter;
      } catch (err) {
        reject(err);
        return;
      }
      this.peripheral = peripheral;
      peripheral.on("error", reject);
      peripheral.on("ready", () => {
        void (async () => {
          try {
            await Peripheral.setDeviceName(`ResQ ${peerName}`.slice(0, 248)).catch(() => undefined);
            await peripheral.addService(SERVICE_UUID, true);
            await peripheral.addCharacteristic(
              SERVICE_UUID,
              CHAT_UUID,
              Property.WRITE | Property.NOTIFY | Property.READ,
              Permission.WRITEABLE | Permission.READABLE,
            );

            peripheral.on("write", (event: PeripheralWriteEvent) => {
              if (event.characteristicUuid?.toLowerCase() !== CHAT_UUID.toLowerCase()) return;
              const frame = base64ToText(event.value);
              const complete = this.reassembler.push(frame);
              if (complete) this.opts?.onFrame(base64ToText(complete), PERIPHERAL_PEER_ID);
            });
            peripheral.on("unsubscribe", () => {
              // A connected central dropped its notification subscription.
            });

            await peripheral.startAdvertising(
              { [SERVICE_UUID]: Buffer.from("") },
              {
                mode: AdvertiseMode.BALANCED,
                connectable: true,
                includeDeviceName: false,
              },
            );
            this.advertising = true;
            resolve("active");
          } catch (err) {
            reject(err);
          }
        })();
      });
    });
    return this.ready;
  }

  async broadcast(raw: string): Promise<void> {
    await this.notifyAll(raw);
  }

  async send(_peerId: string, raw: string): Promise<void> {
    // Peripheral has no per-central addressing; broadcast to all subscribers.
    await this.notifyAll(raw);
  }

  private async notifyAll(raw: string): Promise<void> {
    const peripheral = this.peripheral;
    if (!peripheral || !this.advertising) return;
    const frames = splitForLink(textToBase64(raw), PERIPHERAL_MTU - 3);
    try {
      for (const frame of frames) {
        await peripheral.updateValue(SERVICE_UUID, CHAT_UUID, Buffer.from(frame, "utf8"));
      }
    } catch {
      // Notify failed — the central link is the primary delivery path.
    }
  }

  stop(): void {
    const peripheral = this.peripheral;
    this.peripheral = null;
    this.ready = null;
    this.advertising = false;
    if (peripheral) {
      try {
        void peripheral.stopAdvertising().catch(() => undefined);
        void peripheral.destroy().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }
}

export function createPeripheralTransport(): MeshTransport {
  return new PeripheralMeshTransport();
}

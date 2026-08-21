// Native Wi-Fi Direct nearby-device scanner + mesh chat link.
//
// Two responsibilities, both backed by react-native-wifi-p2p:
//   1. Scanner  — `findDevices()` discovers nearby Wi-Fi Direct peers and
//                 reports them as MeshPeer entries (link: "wifi"). This is the
//                 "nearby device scanner" surface shown in the mesh UI.
//   2. Chat link — once a Wi-Fi Direct group is formed, peers exchange mesh
//                 envelopes over a TCP socket (react-native-tcp-socket). Wi-Fi
//                 Direct gives a real bidirectional, higher-bandwidth link, so
//                 it complements the BLE transport nicely for offline chat.
//
// Wi-Fi Direct is Android-only; on iOS isWifiP2pSupported() is false and the
// stack degrades to "unsupported" while the BLE transport keeps working.

import { PermissionsAndroid, Platform } from "react-native";
// @ts-ignore - react-native-wifi-p2p ships without bundled types in some versions
import WifiP2p from "react-native-wifi-p2p";
import TcpSocket from "react-native-tcp-socket";

type TcpSocketType = ReturnType<typeof TcpSocket.connect>;

import type { MeshPeer } from "@/src/types";
import type { MeshStartOptions, MeshTransport, MeshTransportStatus } from "./meshProtocol";
import { LinkReassembler, base64ToText, splitForLink, textToBase64 } from "./meshCodec";

const PORT = 8989;
const TCP_CHUNK = 4096;

type WifiDevice = {
  deviceName?: string | null;
  deviceAddress: string;
  isGroupOwner?: boolean;
};

function isWifiP2pSupported(): boolean {
  return Platform.OS === "android";
}

async function requestWifiPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const perms: string[] = [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_WIFI_STATE",
    "android.permission.CHANGE_WIFI_STATE",
    "android.permission.CHANGE_NETWORK_STATE",
  ];
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    perms.push("android.permission.NEARBY_WIFI_DEVICES");
  }
  const results = await PermissionsAndroid.requestMultiple(perms as never);
  return Object.values(results).every((r) => r === "granted" || r === "never_ask_again");
}

class SocketLink {
  private buffer = "";
  private reassembler = new LinkReassembler();
  private closed = false;

  constructor(
    private socket: { write: (d: string) => void; destroy: () => void; on: (e: string, cb: (...a: unknown[]) => void) => void; remoteAddress?: string },
    private peerId: string,
    private onFrame: (raw: string, peerId: string) => void,
  ) {
    socket.on("data", (data: unknown) => this.onData(data as Buffer));
    socket.on("close", () => this.dispose());
    socket.on("error", () => this.dispose());
  }

  private onData(data: Buffer): void {
    this.buffer += data.toString("utf8");
    let idx = this.buffer.indexOf("\n");
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length) {
        const complete = this.reassembler.push(line);
        if (complete) this.onFrame(base64ToText(complete), this.peerId);
      }
      idx = this.buffer.indexOf("\n");
    }
  }

  write(text: string): void {
    if (this.closed) return;
    try {
      this.socket.write(`${text}\n`);
    } catch {
      this.dispose();
    }
  }

  dispose(): void {
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {
      /* already gone */
    }
  }
}

class WifiP2PStack implements MeshTransport {
  private opts: MeshStartOptions | null = null;
  private peers = new Map<string, MeshPeer>();
  private links = new Map<string, SocketLink>();
  private server: { listen: (o: { port: number; host: string }) => void; close: () => void } | null = null;
  private handlers: Array<[string, (...a: unknown[]) => void]> = [];
  private lastConnectAddress: string | null = null;
  private started = false;

  async start(opts: MeshStartOptions): Promise<MeshTransportStatus> {
    this.opts = opts;
    if (!isWifiP2pSupported()) return "unsupported";
    if (!(await requestWifiPermissions())) return "denied";

    try {
      await WifiP2p.initialize();
      this.started = true;

      const server = TcpSocket.createServer((socket: TcpSocketType) => {
        const peerId = socket.remoteAddress ?? `wifi-${Math.random().toString(36).slice(2, 8)}`;
        const link = new SocketLink(socket as never, peerId, (raw, id) => this.opts?.onFrame(raw, id));
        this.links.set(peerId, link);
      });
      server.listen({ port: PORT, host: "0.0.0.0" });
      this.server = server;

      this.on("deviceFound", (device: unknown) => this.onDeviceFound(device as WifiDevice));
      this.on("deviceUpdated", (device: unknown) => this.onDeviceFound(device as WifiDevice));
      this.on("deviceLost", (device: unknown) => this.onDeviceLost((device as WifiDevice).deviceAddress));
      this.on("connectionInfo", (info: unknown) => this.onConnectionInfo(info as { isGroupOwner: boolean; groupOwnerAddress?: string }));

      await WifiP2p.createGroup().catch(() => undefined);
      await WifiP2p.findDevices().catch(() => undefined);
      return "active";
    } catch {
      this.stop();
      return "unsupported";
    }
  }

  private on(event: string, handler: (...a: unknown[]) => void): void {
    try {
      WifiP2p.on(event, handler);
      this.handlers.push([event, handler]);
    } catch {
      /* listener not supported */
    }
  }

  private onDeviceFound(device: WifiDevice): void {
    if (!device?.deviceAddress) return;
    const known = this.peers.get(device.deviceAddress);
    if (!known) {
      this.peers.set(device.deviceAddress, {
        id: device.deviceAddress,
        name: device.deviceName || "ResQ Wi-Fi",
        rssi: -60,
        paired: false,
        online: true,
        lastSeen: Date.now(),
        link: "wifi",
      });
      this.emitPeers();
    }
    try {
      this.lastConnectAddress = device.deviceAddress;
      void WifiP2p.connect(device.deviceAddress);
    } catch {
      /* connection will be retried on next discovery */
    }
  }

  private onDeviceLost(address: string): void {
    const peer = this.peers.get(address);
    if (peer) {
      peer.online = false;
      this.emitPeers();
    }
  }

  private onConnectionInfo(info: { isGroupOwner: boolean; groupOwnerAddress?: string }): void {
    if (info.isGroupOwner || !info.groupOwnerAddress) return;
    const address = this.lastConnectAddress ?? info.groupOwnerAddress;
    if (this.links.has(address)) return;
    try {
      const socket = TcpSocket.connect({ host: info.groupOwnerAddress, port: PORT }, () => undefined);
      const link = new SocketLink(socket as never, address, (raw, id) => this.opts?.onFrame(raw, id));
      this.links.set(address, link);
    } catch {
      /* socket connect failed */
    }
  }

  async broadcast(raw: string): Promise<void> {
    const frames = splitForLink(textToBase64(raw), TCP_CHUNK);
    this.links.forEach((link) => frames.forEach((frame) => link.write(frame)));
  }

  async send(peerId: string, raw: string): Promise<void> {
    const link = this.links.get(peerId);
    if (!link) {
      await this.broadcast(raw);
      return;
    }
    splitForLink(textToBase64(raw), TCP_CHUNK).forEach((frame) => link.write(frame));
  }

  stop(): void {
    this.started = false;
    this.handlers.forEach(([event, handler]) => {
      try {
        WifiP2p.off(event, handler);
      } catch {
        /* ignore */
      }
    });
    this.handlers = [];
    this.links.forEach((link) => link.dispose());
    this.links.clear();
    try {
      this.server?.close();
    } catch {
      /* ignore */
    }
    this.server = null;
    if (this.started) {
      try {
        void WifiP2p.stopFindDevices();
        void WifiP2p.removeGroup();
      } catch {
        /* ignore */
      }
    }
    this.peers.clear();
  }

  private emitPeers(): void {
    this.opts?.onPeers([...this.peers.values()]);
  }
}

export function createWifiTransport(): MeshTransport {
  return new WifiP2PStack();
}

export function isWifiP2pSupportedExport(): boolean {
  return isWifiP2pSupported();
}

export async function startWifiScan(onPeers: (peers: MeshPeer[]) => void): Promise<() => void> {
  if (!isWifiP2pSupported()) return () => undefined;
  const stack = new WifiP2PStack();
  const status = await stack.start({ peerName: "scanner", onPeers, onFrame: () => undefined });
  if (status !== "active") {
    stack.stop();
    return () => undefined;
  }
  return () => stack.stop();
}

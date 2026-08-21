// TypeScript shim for `@/src/services/wifiP2p`. Metro resolves this to
// ./wifiP2p.web.ts (web) or ./wifiP2p.native.ts (native) at runtime; this file
// re-exports the web implementation so type-checking has something concrete.

export { isWifiP2pSupported, startWifiScan } from "./wifiP2p.web";
export type { WifiP2pPeer } from "./wifiP2p.web";

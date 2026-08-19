import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export type NetworkState = "online" | "weak" | "offline";

export function useNetworkState() {
  const [network, setNetwork] = useState<NetworkState>("online");

  useEffect(() => NetInfo.addEventListener((state) => {
    if (!state.isConnected) setNetwork("offline");
    else if (state.isInternetReachable === false) setNetwork("weak");
    else setNetwork("online");
  }), []);

  return network;
}
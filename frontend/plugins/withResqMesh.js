// Expo config plugin for the ResQ offline mesh stack.
//
// Wires the native permissions required by the two mesh transports:
//   - react-native-ble-plx  -> Bluetooth Low Energy mesh chat
//   - react-native-wifi-p2p -> Wi-Fi Direct nearby device scanner
//
// This runs at prebuild time (expo prebuild / EAS development build) and is the
// Expo-supported way to add native permissions without ejecting.

const { withInfoPlist, withAndroidManifest } = require("expo/config-plugins");

const IOS_STRINGS = {
  NSBluetoothAlwaysUsageDescription:
    "Connect with nearby people during emergencies.",
  NSBluetoothPeripheralUsageDescription:
    "Let nearby devices exchange emergency messages.",
  NSLocalNetworkUsageDescription:
    "Find nearby devices for offline emergency chat.",
  NSNearbyWifiUsageDescription:
    "Discover nearby devices over Wi-Fi Direct for offline mesh chat.",
};

// Permissions used by BLE (scan/connect/advertise) and Wi-Fi Direct (P2P scan,
// group formation, sockets). `neverForLocation` is set where the permission is
// only used for peer-to-peer comms, not geolocation.
const ANDROID_PERMISSIONS = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CHANGE_WIFI_STATE",
  "android.permission.CHANGE_NETWORK_STATE",
  "android.permission.INTERNET",
];

// These are handled with attributes below (API-level guarded).
const ANDROID_BLE_PERMISSIONS = [
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_ADVERTISE",
];

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withResqMesh = (config) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = { ...cfg.modResults, ...IOS_STRINGS };
    return cfg;
  });

  config = withAndroidManifest(config, async (cfg) => {
    const manifest = cfg.modResults.manifest;
    const existing = new Set((manifest["uses-permission"] ?? []).map((p) => p.$["android:name"]));

    const add = (name, attributes = {}) => {
      if (existing.has(name)) return;
      manifest["uses-permission"] = [
        ...(manifest["uses-permission"] ?? []),
        { $: { "android:name": name, ...attributes } },
      ];
      existing.add(name);
    };

    ANDROID_PERMISSIONS.forEach((name) => add(name));
    ANDROID_BLE_PERMISSIONS.forEach((name) => add(name));
    // Wi-Fi Direct device discovery on Android 13+ — used for comms, never location.
    add("android.permission.NEARBY_WIFI_DEVICES", {
      "android:usesPermissionFlags": "neverForLocation",
    });

    return cfg;
  });

  return config;
};

module.exports = withResqMesh;
module.exports.withResqMesh = withResqMesh;

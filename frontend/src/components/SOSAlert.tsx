import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import type { Coordinates, SOSSignal } from "../types";
import { colors, radius, shadow, zIndex } from "../theme";

function haversineMeters(a: Coordinates, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function SOSAlert({
  signal,
  coordinates,
  copy,
  onViewMap,
  onOpenDetail,
  onClose,
}: {
  signal: SOSSignal;
  coordinates: Coordinates | null;
  copy: Copy;
  onViewMap: () => void;
  onOpenDetail: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const distance = coordinates
    ? haversineMeters(coordinates, { latitude: signal.latitude, longitude: signal.longitude })
    : null;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none" testID="sos-alert">
      <Pressable onPress={onOpenDetail} testID="sos-alert-card">
        <View style={styles.card}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="alert-octagon" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{copy.sosAlertTitle}</Text>
            <Text style={styles.sender}>{signal.sender_name || copy.sos}</Text>
            <Text style={styles.message} numberOfLines={2}>{signal.message}</Text>
            <View style={styles.meta}>
              {distance !== null ? (
                <Text style={styles.metaText}>{formatDistance(distance)} {copy.sosAlertDistance}</Text>
              ) : null}
              {signal.via_mesh ? <Text style={styles.metaText}>{copy.sosAlertViaMesh}</Text> : null}
            </View>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]} hitSlop={10} testID="sos-alert-close">
            <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </Pressable>
      <Pressable onPress={onViewMap} style={({ pressed }) => [styles.action, pressed && styles.pressed]} testID="sos-alert-view">
        <MaterialCommunityIcons name="map-marker-radius" size={18} color="#FFFFFF" />
        <Text style={styles.actionText}>{copy.sosAlertView}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: zIndex.toast },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: radius.large,
    backgroundColor: colors.brand,
    padding: 14,
    ...shadow,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.3, opacity: 0.92 },
  sender: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", marginTop: 2 },
  message: { color: "#FFFFFF", fontSize: 13, fontWeight: "500", marginTop: 4, opacity: 0.95 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  metaText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", opacity: 0.8 },
  close: { padding: 4, borderRadius: 8 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    borderRadius: radius.medium,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingVertical: 11,
  },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.82 },
});

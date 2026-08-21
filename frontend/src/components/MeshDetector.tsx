import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { useMesh } from "../context/MeshContext";
import { colors } from "../theme";

export function MeshDetector({ copy, bottom }: { copy: Copy; bottom: number }) {
  const mesh = useMesh();
  const count = mesh.peers.length;
  const active = mesh.status === "active";
  const scanning = mesh.status === "starting";
  const unavailable = mesh.status === "unsupported";
  const disabled = mesh.busy || scanning || unavailable;

  const label = () => {
    if (unavailable) return copy.meshMeshUnavailable;
    if (scanning) return copy.meshScanningDevices;
    if (active) return copy.meshNearbyCount.replace("{count}", String(count));
    return copy.meshEnableMesh;
  };

  return (
    <Pressable
      onPress={() => {
        if (active || disabled) return;
        void Haptics.selectionAsync();
        void mesh.activate();
      }}
      disabled={disabled}
      style={({ pressed }) => [styles.card, { bottom }, active && styles.cardActive, pressed && !disabled && styles.pressed]}
      testID="mesh-detector"
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <MaterialCommunityIcons name="access-point-network" size={20} color={active ? "#FFFFFF" : colors.info} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{copy.meshDetector}</Text>
        <View style={styles.row}>
          {scanning ? <ActivityIndicator size="small" color={colors.info} style={styles.spinner} /> : null}
          {active ? <View style={[styles.dot, count > 0 ? styles.dotOn : styles.dotOff]} /> : null}
          <Text style={[styles.count, active && styles.countActive]} numberOfLines={1}>{label()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute", left: 16, minHeight: 56, borderRadius: 18,
    backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: 14, paddingVertical: 9, ...({ shadowColor: "#211A19", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 3 } as object),
  },
  cardActive: { backgroundColor: colors.primaryContainer },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  iconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: colors.primary },
  textWrap: { flexShrink: 1 },
  title: { color: colors.inkSoft, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  spinner: { width: 14, height: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: "#C9C2BF" },
  count: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  countActive: { color: colors.onPrimaryContainer },
});

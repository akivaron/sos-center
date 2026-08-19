import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, radius, shadow } from "../theme";

const categories = [
  { key: "fire", color: "#BA1A1A", icon: "fire" },
  { key: "flood", color: "#00639B", icon: "waves" },
  { key: "earthquake", color: "#6750A4", icon: "pulse" },
  { key: "crash", color: "#8A5100", icon: "car-emergency" },
  { key: "other", color: "#5D5D66", icon: "alert-circle-outline" },
] as const;

export function MapLegend({ top, copy }: { top: number; copy: Copy }) {
  return (
    <View style={[styles.card, { top }]} testID="map-legend">
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="information-outline" size={13} color={colors.inkSoft} />
        <Text style={styles.title}>{copy.mapLegend}</Text>
      </View>
      <View style={styles.items}>
        {categories.map((category) => (
          <View key={category.key} style={styles.item} testID={`map-legend-${category.key}`}>
            <View style={[styles.dot, { backgroundColor: category.color }]}><MaterialCommunityIcons name={category.icon} size={11} color="#FFFFFF" /></View>
            <Text style={styles.label} numberOfLines={1}>{copy[category.key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", left: 16, right: 80, height: 62, borderRadius: radius.large, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, ...shadow },
  titleRow: { height: 16, flexDirection: "row", alignItems: "center", gap: 4 },
  title: { color: colors.inkSoft, fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  items: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  item: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  label: { width: "100%", color: colors.inkSoft, fontSize: 7.5, fontWeight: "600", textAlign: "center" },
});
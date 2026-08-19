import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, shadow } from "../theme";
import type { Incident, IncidentType } from "../types";

export type MapFilter = "all" | IncidentType;
const filters: { key: MapFilter; color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "all", color: colors.primary, icon: "map-marker-multiple" },
  { key: "fire", color: "#BA1A1A", icon: "fire" },
  { key: "flood", color: "#00639B", icon: "waves" },
  { key: "earthquake", color: "#6750A4", icon: "pulse" },
  { key: "crash", color: "#8A5100", icon: "car-emergency" },
  { key: "other", color: "#5D5D66", icon: "alert-circle-outline" },
];

export function MapFilterBar({ top, incidents, selected, copy, onSelect }: {
  top: number;
  incidents: Incident[];
  selected: MapFilter;
  copy: Copy;
  onSelect: (filter: MapFilter) => void;
}) {
  return (
    <View style={[styles.chrome, { top }]} testID="map-filter-bar">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {filters.map((filter) => {
          const active = selected === filter.key;
          const count = filter.key === "all" ? incidents.length : incidents.filter((item) => item.incident_type === filter.key).length;
          const label = filter.key === "all" ? copy.allIncidents : copy[filter.key];
          return (
            <Pressable key={filter.key} onPress={() => onSelect(filter.key)} style={styles.target} testID={`map-filter-${filter.key}-button`}>
              <View style={[styles.chip, active && styles.chipActive]}>
                <View style={[styles.dot, { backgroundColor: filter.color }]} />
                <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
                <View style={[styles.count, active && styles.countActive]}><Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text></View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { position: "absolute", left: 0, right: 0, height: 56 },
  row: { height: 56, alignItems: "center", gap: 8, paddingHorizontal: 16 },
  target: { height: 44, flexShrink: 0, justifyContent: "center" },
  chip: { height: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 12, paddingRight: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, ...shadow },
  chipActive: { backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { color: colors.inkSoft, fontSize: 12, fontWeight: "600" },
  labelActive: { color: colors.onPrimaryContainer },
  count: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  countActive: { backgroundColor: colors.primary },
  countText: { color: colors.inkSoft, fontSize: 10, fontWeight: "700" },
  countTextActive: { color: colors.onPrimary },
});
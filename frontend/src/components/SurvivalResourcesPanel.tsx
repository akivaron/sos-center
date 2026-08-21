import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, radius, shadow } from "../theme";
import type { Coordinates, SurvivalResource, SurvivalResourceType } from "../types";
import { nearestResources, SURVIVAL_RESOURCE_TYPES } from "../services/survivalResources";

const TYPE_META: Record<SurvivalResourceType, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  water: { color: "#0288D1", icon: "water" },
  basecamp: { color: "#6D4C41", icon: "tent" },
  shelter: { color: "#2E7D32", icon: "home" },
  food: { color: "#F9A825", icon: "food" },
  camping: { color: "#7E57C2", icon: "terrain" },
  river: { color: "#0097A7", icon: "waves" },
  settlement: { color: "#C2185B", icon: "home-city" },
};

function formatDistance(meters: number | null | undefined, copy: Copy): string {
  if (meters == null) return "";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} ${copy.km}`;
  return `${Math.round(meters)} ${copy.m}`;
}

export function SurvivalResourcesPanel({
  copy,
  location,
  resources,
  showOnMap,
  onToggleShowOnMap,
  onClose,
  onDirect,
}: {
  copy: Copy;
  location: Coordinates | null;
  resources: SurvivalResource[];
  showOnMap: boolean;
  onToggleShowOnMap: (next: boolean) => void;
  onClose: () => void;
  onDirect: (resource: SurvivalResource) => void;
}) {
  const [type, setType] = useState<SurvivalResourceType | "all">("all");

  const list = useMemo(
    () => (location ? nearestResources(location, resources, type) : []),
    [location, resources, type],
  );

  return (
    <View style={[styles.sheet, shadow]} testID="survival-panel">
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.survivalTitle}</Text>
          <Text style={styles.subtitle}>{copy.survivalHint}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close} hitSlop={8} testID="survival-close-button">
          <MaterialCommunityIcons name="close" size={22} color={colors.inkSoft} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => onToggleShowOnMap(!showOnMap)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        testID="survival-show-on-map-toggle"
      >
        <View style={styles.toggleText}>
          <MaterialCommunityIcons name={showOnMap ? "eye" : "eye-off"} size={20} color={showOnMap ? colors.brand : colors.inkSoft} />
          <Text style={styles.toggleLabel}>{copy.showResourcesOnMap}</Text>
        </View>
        <Switch
          value={showOnMap}
          onValueChange={onToggleShowOnMap}
          testID="survival-show-on-map-switch"
          thumbColor={showOnMap ? colors.brand : "#FFFFFF"}
          trackColor={{ false: colors.outline, true: colors.primaryContainer }}
        />
      </Pressable>

      <View style={styles.chips}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setType("all")} style={styles.chipTarget} testID="survival-filter-all-button">
            <View style={[styles.chip, type === "all" && styles.chipActive]}>
              <MaterialCommunityIcons name="map-marker-radius" size={18} color={type === "all" ? colors.onPrimaryContainer : colors.inkSoft} />
              <Text style={[styles.chipLabel, type === "all" && styles.chipLabelActive]}>{copy.allResources}</Text>
            </View>
          </Pressable>
          {SURVIVAL_RESOURCE_TYPES.map((key) => {
            const meta = TYPE_META[key];
            const active = type === key;
            return (
              <Pressable key={key} onPress={() => setType(key)} style={styles.chipTarget} testID={`survival-filter-${key}-button`}>
                <View style={[styles.chip, active && styles.chipActive]}>
                  <MaterialCommunityIcons name={meta.icon} size={18} color={active ? colors.onPrimaryContainer : meta.color} />
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{copy[key]}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {list.length === 0 ? (
          <Text style={styles.empty}>{copy.locationNeeded}</Text>
        ) : null}
        {list.map((item) => {
          const meta = TYPE_META[item.type];
          return (
            <Pressable
              key={item.id}
              onPress={() => onDirect(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              testID={`survival-item-${item.id}-button`}
            >
              <View style={[styles.icon, { backgroundColor: meta.color }]}>
                <MaterialCommunityIcons name={meta.icon} size={20} color="#FFFFFF" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                {item.note ? <Text style={styles.rowNote} numberOfLines={1}>{item.note}</Text> : null}
              </View>
              <View style={styles.rowSide}>
                <Text style={styles.rowDistance}>{formatDistance(item.distance_meters, copy)}</Text>
                <MaterialCommunityIcons name="directions" size={22} color={colors.brand} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, paddingBottom: 24, maxHeight: "70%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outline, marginVertical: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 18, gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 12, fontWeight: "500", color: colors.inkSoft, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 18, marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outline },
  togglePressed: { opacity: 0.8 },
  toggleText: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: "700", color: colors.ink },
  chips: { marginTop: 12 },
  chipRow: { gap: 8, paddingHorizontal: 18 },
  chipTarget: { height: 44, justifyContent: "center" },
  chip: { height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  chipLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  chipLabelActive: { color: colors.onPrimaryContainer },
  list: { marginTop: 8, maxHeight: 280 },
  listInner: { paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
  empty: { color: colors.inkSoft, fontSize: 13, textAlign: "center", paddingVertical: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outline },
  rowPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowNote: { fontSize: 12, fontWeight: "500", color: colors.inkSoft, marginTop: 1 },
  rowSide: { alignItems: "flex-end", gap: 2 },
  rowDistance: { fontSize: 12, fontWeight: "700", color: colors.brand },
});

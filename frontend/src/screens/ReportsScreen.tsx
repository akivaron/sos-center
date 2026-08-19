import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors } from "../theme";
import type { Incident, IncidentType } from "../types";

const filters: ("all" | IncidentType)[] = ["all", "fire", "flood", "earthquake", "crash"];
const icon = { fire: "fire", flood: "waves", earthquake: "pulse", crash: "car-emergency", other: "alert-circle" } as const;
const accent = { fire: "#DC2626", flood: "#2563EB", earthquake: "#7C3AED", crash: "#F59E0B", other: "#52525B" } as const;

export function ReportsScreen({ copy, incidents }: { copy: Copy; incidents: Incident[] }) {
  const [filter, setFilter] = useState<"all" | IncidentType>("all");
  const visible = useMemo(
    () => filter === "all" ? incidents : incidents.filter((item) => item.incident_type === filter),
    [filter, incidents],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="reports-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>LIVE SAFETY FEED</Text>
        <Text style={styles.title}>{copy.recentReports}</Text>
        <Text style={styles.count}>{incidents.length} {copy.reports.toLowerCase()}</Text>
      </View>
      <View style={styles.filterChrome}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => {
            const selected = item === filter;
            const label = item === "all" ? copy.reports : copy[item];
            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={styles.chipTarget}
                testID={`reports-filter-${item}-button`}
              >
                <Text style={[styles.chip, selected && styles.chipSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={styles.empty} testID="reports-empty-state">
            <View style={styles.emptyIcon}><MaterialCommunityIcons name="shield-check-outline" size={36} color={colors.success} /></View>
            <Text style={styles.emptyTitle}>{copy.safeZone}</Text>
            <Text style={styles.emptyBody}>{copy.noReports}</Text>
          </View>
        ) : visible.map((item) => (
          <View key={item.id} style={styles.card} testID={`report-card-${item.id}`}>
            <View style={[styles.cardIcon, { backgroundColor: `${accent[item.incident_type]}18` }]}>
              <MaterialCommunityIcons name={icon[item.incident_type]} size={25} color={accent[item.incident_type]} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{copy[item.incident_type]}</Text>
                <View style={[styles.severity, { backgroundColor: `${accent[item.incident_type]}14` }]}><Text style={[styles.severityText, { color: accent[item.incident_type] }]}>{item.severity.toUpperCase()}</Text></View>
              </View>
              <Text style={styles.description} numberOfLines={2}>{item.description || copy.nearbyAlert}</Text>
              <Text style={styles.meta}>{item.reporter_name} • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAFAFA" },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, backgroundColor: "#FAFAFA" },
  eyebrow: { color: colors.brand, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 35, fontWeight: "900", letterSpacing: -0.7, marginTop: 3 },
  count: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", marginTop: 4 },
  filterChrome: { height: 56, backgroundColor: "#FAFAFA" },
  filterRow: { alignItems: "center", gap: 8, paddingHorizontal: 20 },
  chipTarget: { height: 44, flexShrink: 0, justifyContent: "center" },
  chip: { height: 36, lineHeight: 34, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.inkSoft, fontSize: 13, fontWeight: "700", overflow: "hidden" },
  chipSelected: { color: "#FFFFFF", backgroundColor: colors.ink, borderColor: colors.ink },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 128, gap: 12 },
  card: { minHeight: 112, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  severity: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  severityText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  description: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 7 },
  meta: { color: "#A1A1AA", fontSize: 11, fontWeight: "700", marginTop: 7 },
  empty: { alignItems: "center", paddingTop: 72, paddingHorizontal: 28 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 18, textAlign: "center" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" },
});
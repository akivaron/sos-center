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
        <Text style={styles.eyebrow}>RESQ • LIVE</Text>
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
              {item.assistance_needed ? <Text style={styles.assistance} numberOfLines={1}>{item.assistance_needed}</Text> : null}
              <View style={styles.metaRow}>
                {item.casualty_count > 0 ? <Text style={styles.metaPill}><MaterialCommunityIcons name="account-injury-outline" size={11} /> {item.casualty_count}</Text> : null}
                {item.photo_file_id ? <Text style={styles.metaPill}><MaterialCommunityIcons name="image-outline" size={11} /> Foto</Text> : null}
              </View>
              <Text style={styles.meta}>{item.reporter_name} • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, backgroundColor: colors.surface },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: "700", marginTop: 3 },
  count: { color: colors.inkSoft, fontSize: 13, fontWeight: "500", marginTop: 4 },
  filterChrome: { height: 56, backgroundColor: colors.surface },
  filterRow: { alignItems: "center", gap: 8, paddingHorizontal: 20 },
  chipTarget: { height: 44, flexShrink: 0, justifyContent: "center" },
  chip: { height: 36, lineHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 16, color: colors.inkSoft, fontSize: 13, fontWeight: "600", overflow: "hidden" },
  chipSelected: { color: colors.onPrimaryContainer, backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 128, gap: 12 },
  card: { minHeight: 112, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  severity: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  severityText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  description: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 7 },
  assistance: { color: colors.primary, fontSize: 12, fontWeight: "600", marginTop: 5 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  metaPill: { color: colors.inkSoft, fontSize: 10, fontWeight: "600", backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  meta: { color: colors.outline, fontSize: 11, fontWeight: "600", marginTop: 7 },
  empty: { alignItems: "center", paddingTop: 72, paddingHorizontal: 28 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 18, textAlign: "center" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" },
});
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../api";
import type { Copy } from "../i18n";
import { colors, radius, shadow } from "../theme";
import type { Incident } from "../types";

const typeColor = { fire: "#BA1A1A", flood: "#00639B", earthquake: "#6750A4", crash: "#8A5100", other: "#5D5D66" } as const;
const typeIcon = { fire: "fire", flood: "waves", earthquake: "pulse", crash: "car-emergency", other: "alert-circle-outline" } as const;

export function IncidentInfoCard({ incident, copy, bottom, onClose }: {
  incident: Incident;
  copy: Copy;
  bottom: number;
  onClose: () => void;
}) {
  const photo = api.mediaUrl(incident.photo_url);
  const accent = typeColor[incident.incident_type];
  return (
    <View style={[styles.card, { bottom }]} testID="incident-detail-card">
      <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: accent }]}><MaterialCommunityIcons name={typeIcon[incident.incident_type]} size={23} color="#FFFFFF" /></View>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{copy[incident.incident_type]}</Text>
          <Text style={styles.reporter}>{copy.reportedBy} {incident.reporter_name} • {new Date(incident.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <View style={[styles.severity, { backgroundColor: `${accent}18` }]}><Text style={[styles.severityText, { color: accent }]}>{copy[incident.severity]}</Text></View>
        <Pressable onPress={onClose} style={styles.close} testID="incident-detail-close-button"><MaterialCommunityIcons name="close" size={22} color={colors.ink} /></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={220} testID="incident-evidence-photo" />
            <View style={styles.photoLabel}><MaterialCommunityIcons name="image-check-outline" size={14} color="#FFFFFF" /><Text style={styles.photoLabelText}>{copy.evidencePhoto}</Text></View>
          </View>
        ) : (
          <View style={styles.photoEmpty}><MaterialCommunityIcons name="image-off-outline" size={26} color={colors.outline} /><Text style={styles.photoEmptyText}>{copy.evidencePhoto}</Text></View>
        )}
        <Text style={styles.description}>{incident.description}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><MaterialCommunityIcons name="account-injury-outline" size={19} color={colors.primary} /><Text style={styles.statText}>{incident.casualty_count} {copy.victims}</Text></View>
          <View style={styles.stat}><MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.info} /><Text style={styles.statText}>{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</Text></View>
        </View>
        {incident.assistance_needed ? (
          <View style={styles.help}><MaterialCommunityIcons name="hand-heart-outline" size={21} color={colors.primary} /><View style={styles.helpText}><Text style={styles.helpLabel}>{copy.needs}</Text><Text style={styles.helpBody}>{incident.assistance_needed}</Text></View></View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", left: 12, right: 12, maxHeight: 390, borderRadius: radius.extraLarge, backgroundColor: colors.surface, overflow: "hidden", ...shadow },
  topRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 8, paddingVertical: 10 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  titleGroup: { flex: 1 }, title: { color: colors.ink, fontSize: 18, fontWeight: "700" }, reporter: { color: colors.inkSoft, fontSize: 10, lineHeight: 15, marginTop: 2 },
  severity: { height: 30, borderRadius: 8, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, severityText: { fontSize: 11, fontWeight: "700" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scroll: { maxHeight: 300 }, content: { paddingHorizontal: 16, paddingBottom: 18 },
  photoWrap: { height: 128, borderRadius: radius.large, overflow: "hidden", backgroundColor: colors.surfaceContainer }, photo: { width: "100%", height: "100%" },
  photoLabel: { position: "absolute", left: 8, bottom: 8, height: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: "rgba(33,26,25,0.78)", flexDirection: "row", alignItems: "center", gap: 5 }, photoLabelText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  photoEmpty: { height: 74, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center", gap: 5 }, photoEmptyText: { color: colors.inkSoft, fontSize: 11 },
  description: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 13 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, stat: { minHeight: 38, borderRadius: 10, backgroundColor: colors.surfaceContainer, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 }, statText: { color: colors.inkSoft, fontSize: 11, fontWeight: "600" },
  help: { minHeight: 58, borderRadius: radius.large, backgroundColor: colors.primaryContainer, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 10 }, helpText: { flex: 1 }, helpLabel: { color: colors.onPrimaryContainer, fontSize: 10, fontWeight: "700" }, helpBody: { color: colors.onPrimaryContainer, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../api";
import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import type { SOSSignal } from "../types";
import { CommunityReports } from "./CommunityReports";
import { ReportSheet } from "./ReportSheet";
import { VerdictBadge } from "./VerdictBadge";

export function SOSDetailCard({
  signal,
  copy,
  onClose,
  onViewMap,
  onReported,
}: {
  signal: SOSSignal;
  copy: Copy;
  onClose: () => void;
  onViewMap: () => void;
  onReported?: (updated: SOSSignal) => void;
}) {
  const [data, setData] = useState<SOSSignal>(signal);
  const [reporting, setReporting] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => setData(signal), [signal]);

  const submitReport = async (input: { kind: "scam" | "real"; reason: string; note: string }) => {
    setReporting(true);
    try {
      const updated = await api.reportSOS(data.id, input);
      setData(updated);
      onReported?.(updated);
    } catch {
      /* keep detail open; report may retry later */
    } finally {
      setReporting(false);
    }
  };

  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.overlay} testID="sos-detail-card">
      <Pressable style={styles.backdrop} onPress={onClose} testID="sos-detail-backdrop" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: colors.brand }]}><MaterialCommunityIcons name="alert-octagon" size={23} color="#FFFFFF" /></View>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{copy.sosDetailTitle}</Text>
          <Text style={styles.reporter}>{data.sender_name} • {new Date(data.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close} testID="sos-detail-close-button"><MaterialCommunityIcons name="close" size={22} color={colors.ink} /></Pressable>
      </View>

      <View style={styles.verdictRow}>
        <VerdictBadge verdict={data.verdict} copy={copy} />
        {data.via_mesh ? (
          <View style={styles.meshTag}><MaterialCommunityIcons name="bluetooth" size={13} color={colors.info} /><Text style={styles.meshText}>{copy.sosAlertViaMesh}</Text></View>
        ) : null}
        <Pressable
          onPress={() => setSheet(true)}
          disabled={reporting}
          style={({ pressed }) => [styles.reportButton, pressed && styles.pressed, reporting && styles.disabled]}
          testID="sos-report-button"
        >
          {reporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="flag-variant" size={16} color="#FFFFFF" />}
          <Text style={styles.reportButtonText}>{copy.reportAction}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.messageWrap}>
          <MaterialCommunityIcons name="message-alert-outline" size={18} color={colors.brand} />
          <Text style={styles.message}>{data.message}</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.info} /><Text style={styles.statText}>{data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}</Text></View>
          <View style={styles.stat}><MaterialCommunityIcons name="wifi-off" size={19} color={colors.outline} /><Text style={styles.statText}>{data.network_state}</Text></View>
        </View>
        <View style={styles.divider} />
        <CommunityReports reports={data.community_reports ?? []} copy={copy} />
      </ScrollView>

      <Pressable onPress={onViewMap} style={({ pressed }) => [styles.viewMap, pressed && styles.pressed]} testID="sos-detail-view-map">
        <MaterialCommunityIcons name="map-marker-radius" size={18} color="#FFFFFF" />
        <Text style={styles.viewMapText}>{copy.sosAlertView}</Text>
      </Pressable>

      <ReportSheet
        visible={sheet}
        title={copy.reportSheetTitle}
        copy={copy}
        onClose={() => setSheet(false)}
        onSubmit={submitReport}
      />
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.36)" },
  sheet: { maxHeight: "90%", backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, overflow: "hidden", ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  topRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 8, paddingVertical: 10 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  titleGroup: { flex: 1 }, title: { color: colors.ink, fontSize: 18, fontWeight: "700" }, reporter: { color: colors.inkSoft, fontSize: 10, lineHeight: 15, marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border, flexWrap: "wrap" },
  meshTag: { flexDirection: "row", alignItems: "center", gap: 4, height: 26, borderRadius: 13, paddingHorizontal: 9, backgroundColor: `${colors.info}14` },
  meshText: { color: colors.info, fontSize: 10, fontWeight: "700" },
  reportButton: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, borderRadius: 15, backgroundColor: colors.primary, paddingHorizontal: 12, marginLeft: "auto" },
  reportButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingBottom: 18 },
  messageWrap: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: colors.primaryContainer, borderRadius: radius.large, padding: 12, marginTop: 4 },
  message: { flex: 1, color: colors.onPrimaryContainer, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, stat: { minHeight: 38, borderRadius: 10, backgroundColor: colors.surfaceContainer, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 }, statText: { color: colors.inkSoft, fontSize: 11, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 16 },
  viewMap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 14, marginTop: 8, borderRadius: radius.medium, backgroundColor: colors.brand, paddingVertical: 13 },
  viewMapText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.82 },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api";
import { LocationGate } from "../components/LocationGate";
import MapCanvas from "../components/MapCanvas";
import { ReportFormModal } from "../components/ReportFormModal";
import { SOSCountdown } from "../components/SOSCountdown";
import { Toast } from "../components/Toast";
import { useDeviceLocation } from "../hooks/useDeviceLocation";
import type { Copy } from "../i18n";
import { flushSOSQueue, queueSOS } from "../services/sosQueue";
import { colors, radius, shadow } from "../theme";
import type { Incident, ReportDraft, User } from "../types";
import type { NetworkState } from "../hooks/useNetworkState";

export function MapScreen({ copy, user, network, incidents, onIncidentsChange }: {
  copy: Copy;
  user: User | null;
  network: NetworkState;
  incidents: Incident[];
  onIncidentsChange: (incidents: Incident[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const location = useDeviceLocation();
  const autoTriggered = useRef(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [locationGate, setLocationGate] = useState(false);
  const [countdown, setCountdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const loadIncidents = useCallback(async () => {
    try { onIncidentsChange(await api.incidents(location.coordinates ?? undefined)); } catch { /* keep map usable */ }
  }, [location.coordinates, onIncidentsChange]);

  useEffect(() => { void loadIncidents(); }, [loadIncidents]);
  useEffect(() => {
    if (network === "online" && user) void flushSOSQueue();
    if (network !== "online" && user && location.coordinates && !autoTriggered.current) {
      autoTriggered.current = true;
      setCountdown(true);
    }
  }, [network, user, location.coordinates]);

  const requireLocation = () => {
    if (!location.coordinates) {
      setLocationGate(true);
      return false;
    }
    return true;
  };

  const openReport = () => {
    if (!user) return setToast(copy.signInNeeded);
    if (!requireLocation()) return;
    setReportVisible(true);
  };

  const submitReport = async (draft: ReportDraft) => {
    if (!location.coordinates || !user) return;
    setSubmitting(true);
    try {
      const upload = await api.uploadIncidentPhoto(draft.photo);
      const incident = await api.createIncident({
        incident_type: draft.incidentType,
        severity: draft.severity,
        description: draft.description,
        casualty_count: draft.casualtyCount,
        assistance_needed: draft.assistanceNeeded,
        photo_file_id: upload.file_id,
        ...location.coordinates,
      });
      onIncidentsChange([incident, ...incidents]);
      setReportVisible(false);
      setToast(copy.sent.replace("SOS", copy.report));
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setSubmitting(false);
    }
  };

  const startSOS = () => {
    if (!user) return setToast(copy.signInNeeded);
    if (!requireLocation()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCountdown(true);
  };

  const completeSOS = useCallback(async () => {
    if (!location.coordinates || !user) return setCountdown(false);
    const signal = {
      client_event_id: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...location.coordinates,
      message: "Saya membutuhkan bantuan segera / I need immediate help",
      network_state: network,
    };
    setCountdown(false);
    try {
      if (network === "online") await api.sendSOS(signal);
      else {
        await queueSOS(signal);
        try { await api.sendSOS(signal); } catch { /* queued for reconnection */ }
      }
      setToast(network === "online" ? copy.sent : copy.queued);
    } catch {
      await queueSOS(signal);
      setToast(copy.queued);
    }
  }, [copy.queued, copy.sent, location.coordinates, network, user]);

  const statusText = network === "online" ? copy.online : network === "weak" ? copy.weak : copy.offline;
  const statusColor = network === "online" ? colors.success : network === "weak" ? colors.warning : colors.info;

  return (
    <View style={styles.screen} testID="map-screen">
      <MapCanvas incidents={incidents} coordinates={location.coordinates} onIncidentPress={setSelectedIncident} />
      <View style={[styles.header, { top: insets.top + 8 }]} testID="network-status-header">
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.headerText}>
          <Text style={styles.brand}>{copy.appName}</Text>
          <Text style={styles.network}>{statusText}</Text>
        </View>
        <View style={styles.alertCount}>
          <MaterialCommunityIcons name="shield-alert-outline" size={19} color={incidents.length ? colors.brand : colors.success} />
          <Text style={styles.alertCountText}>{incidents.length}</Text>
        </View>
      </View>

      {incidents.length === 0 ? (
        <View style={[styles.safeChip, { top: insets.top + 86 }]} testID="safe-zone-banner">
          <MaterialCommunityIcons name="shield-check" size={17} color={colors.success} />
          <Text style={styles.safeText}>{copy.safeZone}</Text>
        </View>
      ) : null}

      <Pressable onPress={() => { setLocationGate(true); }} style={({ pressed }) => [styles.locate, { top: insets.top + 92 }, pressed && styles.pressed]} testID="locate-me-button">
        {location.loading ? <ActivityIndicator color={colors.info} /> : <MaterialCommunityIcons name="crosshairs-gps" size={23} color={colors.info} />}
      </Pressable>

      {selectedIncident ? (
        <Pressable onPress={() => setSelectedIncident(null)} style={[styles.incidentCard, { bottom: insets.bottom + 190 }]} testID="incident-detail-card">
          <View style={styles.incidentIcon}><MaterialCommunityIcons name="alert" size={22} color="#FFFFFF" /></View>
          <View style={styles.incidentText}>
            <Text style={styles.incidentTitle}>{copy[selectedIncident.incident_type]}</Text>
            <Text style={styles.incidentMeta} numberOfLines={2}>{selectedIncident.description || `${copy.nearbyAlert} • ${selectedIncident.reporter_name}`}</Text>
          </View>
          <MaterialCommunityIcons name="close" size={20} color={colors.inkSoft} />
        </Pressable>
      ) : null}

      <Pressable onPress={openReport} style={({ pressed }) => [styles.reportButton, { bottom: insets.bottom + 106 }, pressed && styles.pressed]} testID="open-report-button">
        <MaterialCommunityIcons name="alert-plus" size={23} color="#FFFFFF" />
        <Text style={styles.reportText}>{copy.report}</Text>
      </Pressable>
      <Pressable onPress={startSOS} hitSlop={12} style={({ pressed }) => [styles.sosButton, { bottom: insets.bottom + 104 }, pressed && styles.sosPressed]} testID="sos-trigger-button">
        <View style={styles.sosInner}><Text style={styles.sosText}>{copy.sos}</Text></View>
      </Pressable>

      <ReportFormModal
        visible={reportVisible}
        copy={copy}
        loading={submitting}
        locationLabel={location.coordinates ? `${location.coordinates.latitude.toFixed(5)}, ${location.coordinates.longitude.toFixed(5)}` : copy.reportSubtitle}
        onClose={() => setReportVisible(false)}
        onSubmit={submitReport}
      />
      <SOSCountdown visible={countdown} copy={copy} onCancel={() => setCountdown(false)} onComplete={completeSOS} />
      <LocationGate
        visible={locationGate}
        canAskAgain={location.permission?.canAskAgain !== false}
        loading={location.loading}
        copy={copy}
        onRequest={() => { void location.request().then((result) => { if (result.granted) setLocationGate(false); }); }}
        onDismiss={() => setLocationGate(false)}
      />
      <View style={[styles.toastLayer, { top: insets.top }]} pointerEvents="box-none">
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mapLand, overflow: "hidden" },
  header: { position: "absolute", left: 16, right: 16, height: 64, borderRadius: radius.large, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, ...shadow },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 11 },
  headerText: { flex: 1 },
  brand: { fontSize: 18, fontWeight: "700", color: colors.ink },
  network: { fontSize: 12, fontWeight: "500", color: colors.inkSoft, marginTop: 1 },
  alertCount: { minWidth: 48, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  alertCountText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  safeChip: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 14, height: 40, ...shadow },
  safeText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  locate: { position: "absolute", right: 16, width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", ...shadow },
  reportButton: { position: "absolute", right: 20, minHeight: 56, borderRadius: 18, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 18, ...shadow },
  reportText: { color: colors.onPrimary, fontSize: 14, fontWeight: "700" },
  sosButton: { position: "absolute", alignSelf: "center", width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(220,38,38,0.22)", padding: 8, ...shadow },
  sosInner: { flex: 1, borderRadius: 36, backgroundColor: colors.brand, borderWidth: 4, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  sosText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", letterSpacing: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  sosPressed: { transform: [{ scale: 0.92 }] },
  incidentCard: { position: "absolute", left: 16, right: 16, minHeight: 80, borderRadius: radius.large, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", padding: 14, gap: 12, ...shadow },
  incidentIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  incidentText: { flex: 1 },
  incidentTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  incidentMeta: { fontSize: 13, color: colors.inkSoft, marginTop: 3, lineHeight: 18 },
  toastLayer: { position: "absolute", left: 0, right: 0, height: 80 },
});
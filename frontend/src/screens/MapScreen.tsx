import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api";
import { useNotifications } from "../context/NotificationContext";
import { LocationGate } from "../components/LocationGate";
import { NotificationBell } from "../components/NotificationBell";
import { IncidentInfoCard } from "../components/IncidentInfoCard";
import { MapFilterBar, type MapFilter } from "../components/MapFilterBar";
import MapCanvas, { type MapHandle } from "../components/MapCanvas";
import { LayerPicker } from "../components/LayerPicker";
import { DuplicateReportPrompt } from "../components/DuplicateReportPrompt";
import { MeshDetector } from "../components/MeshDetector";
import { DEFAULT_MAP_LAYER, getMapLayer, type MapLayerKey } from "../components/mapLayers";
import { NavigationOverlay } from "../components/NavigationOverlay";
import { SurvivalResourcesPanel } from "../components/SurvivalResourcesPanel";
import { ReportFormModal } from "../components/ReportFormModal";
import { Toast } from "../components/Toast";
import { useDeviceLocation } from "../hooks/useDeviceLocation";
import { haversineMeters, isValidCoordinates } from "../utils/geo";
import type { Copy } from "../i18n";
import { computeRoute, formatRoute, type Route } from "../services/routing";
import { buildSurvivalResources } from "../services/survivalResources";
import { colors, radius, shadow } from "../theme";
import type { FamilyLocation, Incident, ReportDraft, SurvivalResource, User } from "../types";
import type { NetworkState } from "../hooks/useNetworkState";

const DUPLICATE_RADIUS_M = 300;

export function MapScreen({ copy, user, network, incidents, family, onFamilyPress, onIncidentsChange, onHideTabs, focusIncidentId, onClearFocusIncident }: {
  copy: Copy;
  user: User | null;
  network: NetworkState;
  incidents: Incident[];
  family?: FamilyLocation[];
  onFamilyPress?: (location: FamilyLocation) => void;
  onIncidentsChange: (incidents: Incident[]) => void;
  onHideTabs?: (hidden: boolean) => void;
  focusIncidentId?: string | null;
  onClearFocusIncident?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const location = useDeviceLocation();
  const mapRef = useRef<MapHandle>(null);
  const notifications = useNotifications();
  const [reportVisible, setReportVisible] = useState(false);
  const [locationGate, setLocationGate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routing, setRouting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [layer, setLayer] = useState<MapLayerKey>(DEFAULT_MAP_LAYER);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<Incident | null>(null);
  const [survivalOpen, setSurvivalOpen] = useState(false);
  const [showResourcesOnMap, setShowResourcesOnMap] = useState(false);
  const [selectedResource, setSelectedResource] = useState<SurvivalResource | null>(null);
  const resources = useMemo(
    () => (isValidCoordinates(location.coordinates) ? buildSurvivalResources(location.coordinates) : []),
    [location.coordinates],
  );
  const visibleIncidents = useMemo(
    () => filter === "all" ? incidents : incidents.filter((item) => item.incident_type === filter),
    [filter, incidents],
  );

  const loadIncidents = useCallback(async () => {
    try { onIncidentsChange(await api.incidents(location.coordinates ?? undefined)); } catch { /* keep map usable */ }
  }, [location.coordinates, onIncidentsChange]);

  useEffect(() => { void loadIncidents(); }, [loadIncidents]);

  const pushRef = useRef(notifications.push);
  pushRef.current = notifications.push;
  const prevSnap = useRef<Map<string, { severity: string; verdict?: string; discussion: number }>>(new Map());
  const bootstrapped = useRef(false);

  useEffect(() => {
    const snap = new Map<string, { severity: string; verdict?: string; discussion: number }>();
    for (const item of incidents) {
      snap.set(item.id, {
        severity: item.severity,
        verdict: item.verdict,
        discussion: item.discussion?.length ?? 0,
      });
    }
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      prevSnap.current = snap;
      return;
    }
    for (const item of incidents) {
      const prev = prevSnap.current.get(item.id);
      if (!prev) {
        if (item.reporter_id !== user?.user_id) {
          pushRef.current({
            kind: "incident_new",
            title: copy.notifNewIncident,
            body: `${copy[item.incident_type]} ${copy.notifNearby}`,
            incidentId: item.id,
            incidentType: item.incident_type,
            action: { type: "open_incident", incidentId: item.id },
          });
        }
        continue;
      }
      if (prev.verdict !== item.verdict && item.verdict) {
        const verdictLabel =
          item.verdict === "likely_scam" ? copy.verdictLikelyScam
            : item.verdict === "suspicious" ? copy.verdictSuspicious
              : item.verdict === "likely_safe" ? copy.verdictLikelySafe
                : copy.verdictUnverified;
        pushRef.current({
          kind: "verdict",
          title: copy.notifVerdictTitle,
          body: `${copy[item.incident_type]}: ${verdictLabel}`,
          incidentId: item.id,
          incidentType: item.incident_type,
          action: { type: "open_incident", incidentId: item.id },
        });
      } else if (prev.severity !== item.severity) {
        pushRef.current({
          kind: "incident_update",
          title: copy.notifIncidentUpdate,
          body: `${copy[item.incident_type]}: ${copy[item.severity]}`,
          incidentId: item.id,
          incidentType: item.incident_type,
          action: { type: "open_incident", incidentId: item.id },
        });
      }
      if (item.discussion && item.discussion.length > prev.discussion) {
        const latest = item.discussion[item.discussion.length - 1];
        if (latest.author_id !== user?.user_id) {
          pushRef.current({
            kind: "discussion",
            title: copy.notifDiscussionTitle,
            body: `${copy[item.incident_type]}: ${latest.author_name}`,
            incidentId: item.id,
            incidentType: item.incident_type,
            action: { type: "open_incident", incidentId: item.id },
          });
        }
      }
    }
    prevSnap.current = snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);

  useEffect(() => {
    if (!focusIncidentId) return;
    const target = incidents.find((item) => item.id === focusIncidentId);
    if (target) setSelectedIncident(target);
    onClearFocusIncident?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIncidentId]);

  const chromeHidden = navigating || reportVisible || duplicate !== null || selectedIncident !== null || layerMenuOpen || survivalOpen;
  useEffect(() => { onHideTabs?.(chromeHidden); }, [chromeHidden, onHideTabs]);

  const requireLocation = () => {
    if (!location.coordinates) {
      setLocationGate(true);
      return false;
    }
    return true;
  };

  const locateMe = () => {
    if (!isValidCoordinates(location.coordinates)) {
      setLocationGate(true);
      return;
    }
    mapRef.current?.focusUserLocation();
  };

  const openReport = () => {
    if (!user) return setToast(copy.signInNeeded);
    if (!requireLocation()) return;
    if (!isValidCoordinates(location.coordinates)) return;
    const nearby = incidents.find(
      (item) => haversineMeters(location.coordinates!, item) <= DUPLICATE_RADIUS_M,
    );
    if (nearby) { setDuplicate(nearby); return; }
    setReportVisible(true);
  };

  const submitReport = async (draft: ReportDraft) => {
    if (!location.coordinates || !user) return;
    setSubmitting(true);
    try {
      let photo_file_id: string | undefined;
      if (draft.photo) {
        const upload = await api.uploadIncidentPhoto(draft.photo);
        photo_file_id = upload.file_id;
      }
      const incident = await api.createIncident({
        incident_type: draft.incidentType,
        severity: draft.severity,
        description: draft.description,
        casualty_count: draft.casualtyCount,
        assistance_needed: draft.assistanceNeeded,
        photo_file_id,
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

  const statusText = network === "online" ? copy.online : network === "weak" ? copy.weak : copy.offline;
  const statusColor = network === "online" ? colors.success : network === "weak" ? colors.warning : colors.info;

  const routeToIncident = async (incident: Incident) => {
    if (!isValidCoordinates(location.coordinates)) {
      setLocationGate(true);
      return;
    }
    if (routing) return;
    setRouting(true);
    try {
      const result = await computeRoute(
        location.coordinates,
        { latitude: incident.latitude, longitude: incident.longitude },
        network !== "offline",
      );
      setRoute(result);
      setNavigating(true);
    } catch {
      setToast(copy.retry);
    } finally {
      setRouting(false);
    }
  };

  const routeToResource = async (resource: SurvivalResource) => {
    if (!isValidCoordinates(location.coordinates)) {
      setLocationGate(true);
      return;
    }
    if (routing) return;
    setRouting(true);
    setSelectedResource(resource);
    setSurvivalOpen(false);
    setShowResourcesOnMap(true);
    try {
      const result = await computeRoute(
        location.coordinates,
        { latitude: resource.latitude, longitude: resource.longitude },
        network !== "offline",
      );
      setRoute(result);
      setNavigating(true);
    } catch {
      setToast(copy.retry);
      setSelectedResource(null);
    } finally {
      setRouting(false);
    }
  };

  const exitNavigation = () => {
    setNavigating(false);
    setRoute(null);
    setSelectedResource(null);
  };

  const clearRoute = () => {
    setNavigating(false);
    setRouting(false);
    setRoute(null);
    setSelectedResource(null);
  };

  const handleCloseIncident = () => {
    setSelectedIncident(null);
    setRoute(null);
    setNavigating(false);
    setSelectedResource(null);
  };

  const handleIncidentUpdated = (updated: Incident) => {
    setSelectedIncident(updated);
    onIncidentsChange(incidents.map((item) => (item.id === updated.id ? updated : item)));
  };

  const showNav = navigating && route !== null;

  return (
    <View style={styles.screen} testID="map-screen">
      <MapCanvas ref={mapRef} incidents={visibleIncidents} coordinates={location.coordinates} route={route?.coordinates ?? null} follow={navigating} layer={layer} family={family} resources={showResourcesOnMap ? resources : []} onFamilyPress={onFamilyPress} onResourcePress={(resource) => { setSelectedResource(resource); setSurvivalOpen(true); }} destination={navigating && (selectedIncident || selectedResource) ? { latitude: (selectedIncident ?? selectedResource)!.latitude, longitude: (selectedIncident ?? selectedResource)!.longitude } : null} onIncidentPress={setSelectedIncident} />

      {!showNav && <>
        <View style={[styles.header, { top: insets.top + 8 }]} testID="network-status-header">
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>{copy.appName}</Text>
            <Text style={styles.network}>{statusText}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={locateMe} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} testID="locate-me-button">
              {location.loading ? <ActivityIndicator color={colors.info} /> : <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.info} />}
            </Pressable>
            <Pressable onPress={() => setLayerMenuOpen((next) => !next)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} testID="layer-toggle-button">
              <MaterialCommunityIcons name={getMapLayer(layer).icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={colors.info} />
            </Pressable>
            <Pressable onPress={() => setSurvivalOpen(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} testID="survival-open-button">
              <MaterialCommunityIcons name="compass-outline" size={22} color={survivalOpen ? colors.brand : colors.info} />
            </Pressable>
            <NotificationBell unread={notifications.unreadCount} onPress={notifications.openCenter} />
          </View>
        </View>

        <MapFilterBar
          top={insets.top + 80}
          incidents={incidents}
          selected={filter}
          copy={copy}
          onSelect={(next) => { setFilter(next); setSelectedIncident(null); }}
        />
        {visibleIncidents.length === 0 ? (
          <View style={[styles.safeChip, { top: insets.top + 150 }]} testID="safe-zone-banner">
            <MaterialCommunityIcons name="shield-check" size={17} color={colors.success} />
            <Text style={styles.safeText}>{copy.safeZone}</Text>
          </View>
        ) : null}

        {layerMenuOpen ? (
          <LayerPicker top={insets.top + 8} right={16} copy={copy} value={layer} onSelect={setLayer} onClose={() => setLayerMenuOpen(false)} />
        ) : null}

        {route || routing ? (
          <View style={[styles.routeBanner, { top: insets.top + 204 }]} testID="route-banner">
            <MaterialCommunityIcons name="map-marker-distance" size={18} color={colors.brand} />
            <Text style={styles.routeText} numberOfLines={1}>
              {routing ? copy.directing : formatRoute(route!, copy)}
            </Text>
            <Pressable onPress={clearRoute} hitSlop={8} testID="route-cancel-button">
              <MaterialCommunityIcons name="close" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        ) : null}

        {selectedIncident ? (
          <IncidentInfoCard
            incident={selectedIncident}
            user={user}
            copy={copy}
            onClose={handleCloseIncident}
            onDirect={routeToIncident}
            onReported={handleIncidentUpdated}
            onUpdated={handleIncidentUpdated}
            onRequireAuth={() => setToast(copy.signInToContribute)}
          />
        ) : null}

        {!selectedIncident && !survivalOpen ? (
          <Pressable onPress={openReport} style={({ pressed }) => [styles.reportButton, { bottom: insets.bottom + 106 }, pressed && styles.pressed]} testID="open-report-button">
            <MaterialCommunityIcons name="alert-plus" size={23} color="#FFFFFF" />
            <Text style={styles.reportText}>{copy.report}</Text>
          </Pressable>
        ) : null}

        {!survivalOpen ? <MeshDetector copy={copy} bottom={insets.bottom + 106} /> : null}
      </>}

      {showNav && route && (selectedIncident || selectedResource) ? (
        <NavigationOverlay route={route} incident={selectedIncident} coordinates={location.coordinates} copy={copy} onExit={exitNavigation} destinationName={selectedResource?.name} bottomInset={insets.bottom} />
      ) : null}

      {duplicate ? (
        <DuplicateReportPrompt
          incident={duplicate}
          copy={copy}
          onShowExisting={() => { setSelectedIncident(duplicate); setDuplicate(null); }}
          onNewReport={() => { setDuplicate(null); setReportVisible(true); }}
          onDismiss={() => setDuplicate(null)}
        />
      ) : null}

      {survivalOpen ? (
        <SurvivalResourcesPanel
          copy={copy}
          location={location.coordinates}
          resources={resources}
          showOnMap={showResourcesOnMap}
          onToggleShowOnMap={setShowResourcesOnMap}
          onClose={() => setSurvivalOpen(false)}
          onDirect={routeToResource}
        />
      ) : null}

      <ReportFormModal
        visible={reportVisible}
        copy={copy}
        loading={submitting}
        locationLabel={location.coordinates ? `${location.coordinates.latitude.toFixed(5)}, ${location.coordinates.longitude.toFixed(5)}` : copy.reportSubtitle}
        onClose={() => setReportVisible(false)}
        onSubmit={submitReport}
      />
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
  headerText: { flex: 1, minWidth: 0 },
  brand: { fontSize: 18, fontWeight: "700", color: colors.ink },
  network: { fontSize: 12, fontWeight: "500", color: colors.inkSoft, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  alertCount: { minWidth: 48, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12 },
  alertCountText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  safeChip: { position: "absolute", left: 16, right: 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 14, height: 40, ...shadow },
  routeBanner: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.large, backgroundColor: colors.surface, paddingHorizontal: 14, height: 44, ...shadow },
  routeText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: "600" },
  safeText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  reportButton: { position: "absolute", right: 20, minHeight: 56, borderRadius: 18, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 18, ...shadow },
  reportText: { color: colors.onPrimary, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  toastLayer: { position: "absolute", left: 0, right: 0, height: 80 },
});
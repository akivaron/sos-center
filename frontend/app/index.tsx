import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth/AuthContext";
import { NotificationBell } from "@/src/components/NotificationBell";
import { NotificationCenter } from "@/src/components/NotificationCenter";
import { NotificationProvider, useNotifications } from "@/src/context/NotificationContext";
import { BottomTabs } from "@/src/components/BottomTabs";
import { LocationGate } from "@/src/components/LocationGate";
import { SOSCountdown } from "@/src/components/SOSCountdown";
import { SOSWatcher } from "@/src/components/SOSWatcher";
import { Toast } from "@/src/components/Toast";
import { useNetworkState } from "@/src/hooks/useNetworkState";
import { useDeviceLocation } from "@/src/hooks/useDeviceLocation";
import { getCopy, type Copy } from "@/src/i18n";
import { MeshProvider } from "@/src/context/MeshContext";
import { ChatScreen } from "@/src/screens/ChatScreen";
import { LoginScreen } from "@/src/screens/LoginScreen";
import { MapScreen } from "@/src/screens/MapScreen";
import { ProfileScreen } from "@/src/screens/ProfileScreen";
import { ReportsScreen } from "@/src/screens/ReportsScreen";
import { FamilyCircleScreen } from "@/src/screens/FamilyCircleScreen";
import { SurvivalTutorialScreen } from "@/src/screens/SurvivalTutorialScreen";
import { useFamilyCircle } from "@/src/hooks/useFamilyCircle";
import { flushSOSQueue, queueSOS } from "@/src/services/sosQueue";
import { pushNotification } from "@/src/services/notificationStore";
import { meshBus } from "@/src/services/meshBus";
import { colors, zIndex } from "@/src/theme";
import type { AppNotification, Incident, Language, PrivacySettings, SOSSignal, TabKey } from "@/src/types";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const location = useDeviceLocation();
  const [language, setLanguage] = useState<Language>("id");
  const [tab, setTab] = useState<TabKey>("map");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hideTabs, setHideTabs] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(false);
  const [sosToast, setSosToast] = useState<string | null>(null);
  const [sosLocationGate, setSosLocationGate] = useState(false);
  const [reportsToast, setReportsToast] = useState<string | null>(null);
  const sosAutoTriggered = useRef(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyToast, setFamilyToast] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [focusIncidentId, setFocusIncidentId] = useState<string | null>(null);
  const copy = useMemo(() => getCopy(language), [language]);
  const family = useFamilyCircle(auth.user, network, location.coordinates, privacy);

  useEffect(() => {
    void storage.getItem("resq-language", "id").then((value) => {
      if (value === "id" || value === "en") setLanguage(value);
    });
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    void api.getPrivacy().then(setPrivacy).catch(() => undefined);
  }, [auth.user]);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    void storage.setItem("resq-language", next);
    void pushNotification({
      kind: "system",
      title: copy.notifSystemTitle,
      body: `${copy.language}: ${next === "id" ? "Indonesia" : "English"}`,
      action: { type: "none" },
    });
  };

  const startSOS = () => {
    if (!auth.user) return setSosToast(copy.signInNeeded);
    if (!location.coordinates) {
      setSosLocationGate(true);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSosCountdown(true);
  };

  const completeSOS = useCallback(async () => {
    if (!location.coordinates || !auth.user) return setSosCountdown(false);
    const clientEventId = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      client_event_id: clientEventId,
      longitude: location.coordinates.longitude,
      latitude: location.coordinates.latitude,
      message: "Saya membutuhkan bantuan segera / I need immediate help",
      network_state: network,
    };
    setSosCountdown(false);
    let saved: SOSSignal | null = null;
    try {
      if (network === "online") saved = await api.sendSOS(payload);
      else {
        await queueSOS(payload);
        try { saved = await api.sendSOS(payload); } catch { /* queued for reconnection */ }
      }
    } catch {
      await queueSOS(payload);
    }
    const relay: SOSSignal = saved ?? {
      id: clientEventId,
      client_event_id: clientEventId,
      sender_id: auth.user.user_id,
      sender_name: auth.user.name,
      longitude: payload.longitude,
      latitude: payload.latitude,
      message: payload.message,
      network_state: payload.network_state,
      status: "broadcast",
      created_at: new Date().toISOString(),
    };
    void meshBus.broadcastSOS(relay);
    setSosToast(saved ? copy.sent : copy.queued);
    void pushNotification({
      kind: "system",
      title: copy.notifSystemTitle,
      body: saved ? copy.sent : copy.queued,
      action: { type: "open_map" },
    });
  }, [copy, location.coordinates, network, auth.user]);

  useEffect(() => {
    if (network === "online" && auth.user) void flushSOSQueue();
    if (network !== "online" && auth.user && location.coordinates && !sosAutoTriggered.current) {
      sosAutoTriggered.current = true;
      setSosCountdown(true);
    }
  }, [network, auth.user, location.coordinates]);

  if (auth.loading && !auth.user && !auth.isGuest) {
    return (
      <View style={styles.loading} testID="app-loading-screen">
        <View style={styles.loadingLogo}><MaterialCommunityIcons name="shield-cross" size={38} color="#FFFFFF" /></View>
        <Text style={styles.loadingTitle}>ResQ Map</Text>
        <ActivityIndicator size="small" color={colors.brand} style={styles.spinner} />
      </View>
    );
  }

  if (!auth.user && !auth.isGuest) {
    return (
      <LoginScreen
        copy={copy}
        language={language}
        loading={auth.loading}
        error={auth.error}
        onLanguage={changeLanguage}
        onLogin={() => void auth.login()}
        onGuest={auth.continueAsGuest}
        onEmailLogin={(email, password) => auth.loginWithEmail(email, password)}
        onRegister={(email, password, name) => auth.register(email, password, name)}
      />
    );
  }

  return (
    <NotificationProvider>
    <MeshProvider user={auth.user}>
      <View style={styles.app}>
      <View style={styles.content}>
        {tab === "map" ? (
          <MapScreen copy={copy} user={auth.user} network={network} incidents={incidents} family={family.familyLocations} onFamilyPress={(loc) => setFamilyToast(`${loc.name} • ${loc.location.source === "mesh" ? copy.sourceMesh : copy.sourceGps}`)} onIncidentsChange={setIncidents} onHideTabs={setHideTabs} focusIncidentId={focusIncidentId} onClearFocusIncident={() => setFocusIncidentId(null)} />
        ) : tab === "reports" ? (
          <ReportsScreen copy={copy} user={auth.user} incidents={incidents} coordinates={location.coordinates} onIncidentsChange={setIncidents} onToast={(message) => setReportsToast(message)} />
        ) : tab === "chat" ? (
          <ChatScreen copy={copy} />
        ) : (
          <ProfileScreen copy={copy} language={language} user={auth.user} isGuest={auth.isGuest} privacy={privacy} onLanguage={changeLanguage} onFamily={() => setFamilyOpen(true)} onTutorial={() => setTutorialOpen(true)} onPrivacyChange={setPrivacy} onLogout={() => void auth.logout()} onAccountDeleted={() => void auth.logout()} />
        )}
      </View>
      {!hideTabs && !familyOpen ? (
        <BottomTabs current={tab} copy={copy} bottom={insets.bottom} onChange={setTab} onSOS={startSOS} />
      ) : null}
      <SOSWatcher
        coordinates={location.coordinates}
        network={network}
        currentUserId={auth.user?.user_id}
        copy={copy}
        onViewMap={() => setTab("map")}
        onActiveChange={(active) => setHideTabs(active)}
      />
      <SOSCountdown visible={sosCountdown} copy={copy} onCancel={() => setSosCountdown(false)} onComplete={completeSOS} />
      <LocationGate
        visible={sosLocationGate}
        canAskAgain={location.permission?.canAskAgain !== false}
        loading={location.loading}
        copy={copy}
        onRequest={() => { void location.request().then((result) => { if (result.granted) setSosLocationGate(false); }); }}
        onDismiss={() => setSosLocationGate(false)}
      />
      {familyOpen ? (
        <FamilyCircleScreen
          copy={copy}
          user={auth.user}
          network={network}
          coordinates={location.coordinates}
          circles={family.circles}
          error={family.error}
          onCreate={(name) => family.createCircle(name)}
          onJoin={(code) => family.joinCircle(code)}
          onRemove={(circleId, userId) => family.removeMember(circleId, userId)}
          onClose={() => setFamilyOpen(false)}
          onOpenMesh={() => { setFamilyOpen(false); setTab("chat"); }}
        />
      ) : null}
      {tutorialOpen ? (
        <SurvivalTutorialScreen copy={copy} language={language} onClose={() => setTutorialOpen(false)} />
      ) : null}
      <View style={styles.toastLayer} pointerEvents="box-none">
        <Toast message={sosToast} onDismiss={() => setSosToast(null)} />
        <Toast message={familyToast} onDismiss={() => setFamilyToast(null)} />
        <Toast message={reportsToast} onDismiss={() => setReportsToast(null)} />
      </View>
      <NotificationHost
        copy={copy}
        tab={tab}
        onOpenIncident={(id) => { setTab("map"); setFocusIncidentId(id); }}
        onOpenMap={() => setTab("map")}
        onOpenChat={() => setTab("chat")}
      />
      </View>
    </MeshProvider>
    </NotificationProvider>
  );
}

function NotificationHost({ copy, tab, onOpenIncident, onOpenMap, onOpenChat }: {
  copy: Copy;
  tab: TabKey;
  onOpenIncident: (id: string) => void;
  onOpenMap: () => void;
  onOpenChat: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { unreadCount, openCenter, closeCenter } = useNotifications();

  const handleSelect = (notification: AppNotification) => {
    const action = notification.action ?? { type: "none" };
    if (action.type === "open_incident") onOpenIncident(action.incidentId);
    else if (action.type === "open_map") onOpenMap();
    else if (action.type === "open_chat") onOpenChat();
    closeCenter();
  };

  return (
    <>
      {tab !== "map" && tab !== "profile" ? (
        <Pressable onPress={openCenter} style={[styles.globalBell, { top: insets.top + 8 }]} testID="global-notification-bell">
          <NotificationBell unread={unreadCount} onPress={openCenter} />
        </Pressable>
      ) : null}
      <NotificationCenter copy={copy} onSelect={handleSelect} />
    </>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: "#070B12", alignItems: "center", justifyContent: "center" },
  loadingLogo: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  loadingTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 18 },
  spinner: { marginTop: 24 },
  toastLayer: { position: "absolute", left: 0, right: 0, top: 0, height: 80, zIndex: zIndex.toast },
  globalBell: { position: "absolute", right: 16, zIndex: zIndex.overlay },
});
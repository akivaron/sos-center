import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { BottomTabs } from "@/src/components/BottomTabs";
import { useNetworkState } from "@/src/hooks/useNetworkState";
import { getCopy } from "@/src/i18n";
import { ChatScreen } from "@/src/screens/ChatScreen";
import { LoginScreen } from "@/src/screens/LoginScreen";
import { MapScreen } from "@/src/screens/MapScreen";
import { ProfileScreen } from "@/src/screens/ProfileScreen";
import { ReportsScreen } from "@/src/screens/ReportsScreen";
import { colors } from "@/src/theme";
import type { Incident, Language, TabKey } from "@/src/types";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const [language, setLanguage] = useState<Language>("id");
  const [tab, setTab] = useState<TabKey>("map");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const copy = useMemo(() => getCopy(language), [language]);

  useEffect(() => {
    void storage.getItem("resq-language", "id").then((value) => {
      if (value === "id" || value === "en") setLanguage(value);
    });
  }, []);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    void storage.setItem("resq-language", next);
  };

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
      />
    );
  }

  return (
    <View style={styles.app}>
      <View style={styles.content}>
        {tab === "map" ? (
          <MapScreen copy={copy} user={auth.user} network={network} incidents={incidents} onIncidentsChange={setIncidents} />
        ) : tab === "reports" ? (
          <ReportsScreen copy={copy} incidents={incidents} />
        ) : tab === "chat" ? (
          <ChatScreen copy={copy} user={auth.user} />
        ) : (
          <ProfileScreen copy={copy} language={language} user={auth.user} onLanguage={changeLanguage} onLogout={() => void auth.logout()} />
        )}
      </View>
      <BottomTabs current={tab} copy={copy} bottom={insets.bottom} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: "#070B12", alignItems: "center", justifyContent: "center" },
  loadingLogo: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  loadingTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 18 },
  spinner: { marginTop: 24 },
});
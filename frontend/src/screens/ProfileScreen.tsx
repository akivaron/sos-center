import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors } from "../theme";
import type { Language, User } from "../types";

export function ProfileScreen({ copy, language, user, onLanguage, onLogout }: {
  copy: Copy;
  language: Language;
  user: User | null;
  onLanguage: (language: Language) => void;
  onLogout: () => void;
}) {
  const mapboxReady = Boolean(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>RESQ IDENTITY</Text>
        <Text style={styles.title}>{copy.profile}</Text>
        <View style={styles.profileCard}>
          {user?.picture ? <Image source={{ uri: user.picture }} style={styles.avatar} /> : (
            <View style={styles.avatarFallback}><MaterialCommunityIcons name="account" size={34} color="#FFFFFF" /></View>
          )}
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name ?? copy.guestProfile}</Text>
            <Text style={styles.email}>{user?.email ?? copy.guest}</Text>
          </View>
          <View style={[styles.verified, !user && styles.guestBadge]}><MaterialCommunityIcons name={user ? "check-decagram" : "eye-outline"} size={17} color={user ? colors.info : colors.inkSoft} /></View>
        </View>

        <Text style={styles.sectionLabel}>{copy.language}</Text>
        <View style={styles.segment}>
          {(["id", "en"] as Language[]).map((item) => (
            <Pressable key={item} onPress={() => onLanguage(item)} style={[styles.segmentButton, language === item && styles.segmentActive]} testID={`profile-language-${item}-button`}>
              <Text style={[styles.segmentText, language === item && styles.segmentTextActive]}>{item === "id" ? "Bahasa Indonesia" : "English"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><MaterialCommunityIcons name="map-check-outline" size={22} color={mapboxReady ? colors.success : colors.warning} /></View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>{mapboxReady ? "Mapbox Active" : copy.mapNeedsToken}</Text>
            <Text style={styles.infoText}>{mapboxReady ? copy.privacy : copy.mapTokenBody}</Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <View style={[styles.infoIcon, { backgroundColor: "#DBEAFE" }]}><MaterialCommunityIcons name="bluetooth-connect" size={22} color={colors.info} /></View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>Bluetooth Mesh MVP</Text>
            <Text style={styles.infoText}>{copy.meshBody}</Text>
          </View>
        </View>

        <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]} testID="logout-button">
          <MaterialCommunityIcons name="logout" size={20} color={colors.brand} />
          <Text style={styles.logoutText}>{copy.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 128 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 32, fontWeight: "700", marginTop: 4, marginBottom: 22 },
  profileCard: { minHeight: 96, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  avatar: { width: 60, height: 60, borderRadius: 30 }, avatarFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  profileText: { flex: 1 }, name: { color: colors.ink, fontSize: 17, fontWeight: "700" }, email: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  verified: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" }, guestBadge: { backgroundColor: colors.surfaceContainerHigh },
  sectionLabel: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 28, marginBottom: 10 }, segment: { flexDirection: "row", backgroundColor: colors.surfaceSoft, padding: 4, borderRadius: 18, gap: 4 },
  segmentButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, segmentActive: { backgroundColor: colors.secondaryContainer }, segmentText: { color: colors.inkSoft, fontSize: 13, fontWeight: "600" }, segmentTextActive: { color: colors.onPrimaryContainer, fontWeight: "700" },
  infoCard: { minHeight: 96, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", gap: 12, marginTop: 14 },
  infoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FCE7B2", alignItems: "center", justifyContent: "center" }, infoBody: { flex: 1 }, infoTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, infoText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 5 },
  logout: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 24 }, logoutText: { color: colors.primary, fontSize: 15, fontWeight: "700" }, pressed: { opacity: 0.75 },
});
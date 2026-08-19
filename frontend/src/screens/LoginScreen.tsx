import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors, radius } from "../theme";
import type { Language } from "../types";

const background = "https://static.prod-images.emergentagent.com/jobs/d8eb5cbd-e97f-4f09-bd5e-19ef82a4ae69/images/b32107f9f1217db3b94810f7384f4f7e8aadfc18ba73995d3c6764b6fda80d92.jpeg";

export function LoginScreen({ copy, language, loading, error, onLanguage, onLogin, onGuest }: {
  copy: Copy;
  language: Language;
  loading: boolean;
  error: string | null;
  onLanguage: (language: Language) => void;
  onLogin: () => void;
  onGuest: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Image source={{ uri: background }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      <LinearGradient colors={["rgba(5,10,20,0.18)", "rgba(5,10,20,0.62)", "#070B12"]} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.languageRow}>
          {(["id", "en"] as Language[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => onLanguage(item)}
              style={[styles.languageButton, language === item && styles.languageActive]}
              testID={`login-language-${item}-button`}
            >
              <Text style={styles.languageText}>{item.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="shield-cross" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{copy.appName}</Text>
          <Text style={styles.tagline}>{copy.tagline}</Text>
        </View>
        <View style={styles.actions}>
          {error ? <Text style={styles.error} testID="login-error-message">{error}</Text> : null}
          <Pressable onPress={onLogin} disabled={loading} style={({ pressed }) => [styles.google, pressed && styles.pressed]} testID="google-login-button">
            {loading ? <ActivityIndicator color="#18181B" /> : <MaterialCommunityIcons name="google" size={22} color="#4285F4" />}
            <Text style={styles.googleText}>{copy.google}</Text>
          </Pressable>
          <Pressable onPress={onGuest} style={({ pressed }) => [styles.guest, pressed && styles.pressed]} testID="guest-map-button">
            <Text style={styles.guestText}>{copy.guest}</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.privacy}>
            <MaterialCommunityIcons name="lock-outline" size={15} color="#A1A1AA" />
            <Text style={styles.privacyText}>{copy.privacy}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070B12" },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  languageRow: { alignSelf: "flex-end", flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: "rgba(255,248,247,0.9)", gap: 2 },
  languageButton: { minWidth: 48, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  languageActive: { backgroundColor: colors.secondaryContainer },
  languageText: { color: colors.ink, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  hero: { alignItems: "center", marginTop: "28%" },
  logo: { width: 80, height: 80, borderRadius: radius.extraLarge, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 36, lineHeight: 44, fontWeight: "700", marginTop: 20 },
  tagline: { color: "#D4D4D8", fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 8, maxWidth: 300 },
  actions: { padding: 16, marginBottom: 8, borderRadius: radius.extraLarge, backgroundColor: "rgba(33,26,25,0.78)" },
  error: { color: "#FCA5A5", fontSize: 13, textAlign: "center", marginBottom: 10 },
  google: { minHeight: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center" },
  googleText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  guest: { minHeight: 52, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 8 },
  guestText: { color: colors.primaryContainer, fontSize: 15, fontWeight: "700" },
  privacy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 },
  privacyText: { color: "#A1A1AA", fontSize: 11, lineHeight: 16, textAlign: "center", maxWidth: 300 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
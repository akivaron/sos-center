import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors, radius } from "../theme";
import type { Language } from "../types";

const background = "https://static.prod-images.emergentagent.com/jobs/d8eb5cbd-e97f-4f09-bd5e-19ef82a4ae69/images/b32107f9f1217db3b94810f7384f4f7e8aadfc18ba73995d3c6764b6fda80d92.jpeg";

export function LoginScreen({ copy, language, loading, error, onLanguage, onLogin, onGuest, onEmailLogin, onRegister }: {
  copy: Copy;
  language: Language;
  loading: boolean;
  error: string | null;
  onLanguage: (language: Language) => void;
  onLogin: () => void;
  onGuest: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setFormError(copy.emailInvalid);
      return;
    }
    if (mode === "register" && password.length < 8) {
      setFormError(copy.passwordMin);
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await onRegister(mail, password, name.trim());
      } else {
        await onEmailLogin(mail, password);
      }
    } catch {
      /* error surfaced via the error prop */
    } finally {
      setBusy(false);
    }
  };

  const submitting = busy || loading;

  return (
    <View style={styles.screen}>
      <Image source={{ uri: background }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      <LinearGradient colors={["rgba(5,10,20,0.30)", "rgba(5,10,20,0.68)", "#070B12"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
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
          <Pressable onPress={onLogin} disabled={submitting} style={({ pressed }) => [styles.google, pressed && styles.pressed]} testID="google-login-button">
            {loading ? <ActivityIndicator color="#18181B" /> : <MaterialCommunityIcons name="google" size={22} color="#4285F4" />}
            <Text style={styles.googleText}>{copy.google}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{copy.orSeparator}</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.formCard}>
            {mode === "register" ? (
              <TextInput
                style={styles.input}
                placeholder={copy.nameLabel}
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                testID="name-input"
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder={copy.emailLabel}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              testID="email-input"
            />
            <TextInput
              style={styles.input}
              placeholder={copy.passwordLabel}
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              testID="password-input"
            />
            {formError ? <Text style={styles.formError} testID="login-form-error">{formError}</Text> : null}
            <Pressable onPress={submit} disabled={submitting} style={({ pressed }) => [styles.submit, pressed && styles.pressed]} testID="email-submit-button">
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{mode === "register" ? copy.registerCta : copy.signIn}</Text>}
            </Pressable>
            <Pressable onPress={() => { setMode(mode === "register" ? "signin" : "register"); }} style={styles.toggle} testID="auth-mode-toggle">
              <Text style={styles.toggleText}>{mode === "register" ? copy.haveAccount : copy.noAccount}</Text>
            </Pressable>
          </View>

          <Pressable onPress={onGuest} disabled={submitting} style={({ pressed }) => [styles.guest, pressed && styles.pressed]} testID="guest-map-button">
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
  hero: { alignItems: "center", marginTop: "20%" },
  logo: { width: 80, height: 80, borderRadius: radius.extraLarge, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 36, lineHeight: 44, fontWeight: "700", marginTop: 20 },
  tagline: { color: "#D4D4D8", fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 8, maxWidth: 300 },
  actions: { padding: 16, marginBottom: 8, borderRadius: radius.extraLarge, backgroundColor: "rgba(33,26,25,0.78)" },
  error: { color: "#FCA5A5", fontSize: 13, textAlign: "center", marginBottom: 10 },
  google: { minHeight: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center" },
  googleText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  dividerText: { color: "#A1A1AA", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  formCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10 },
  formError: { color: "#FCA5A5", fontSize: 13, textAlign: "center" },
  input: { minHeight: 50, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 16, color: "#1C1C1E", fontSize: 15 },
  submit: { minHeight: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 2 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  toggle: { alignItems: "center", paddingVertical: 6 },
  toggleText: { color: colors.primaryContainer, fontSize: 13, fontWeight: "700" },
  guest: { minHeight: 52, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 14 },
  guestText: { color: colors.primaryContainer, fontSize: 15, fontWeight: "700" },
  privacy: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 },
  privacyText: { color: "#A1A1AA", fontSize: 11, lineHeight: 16, textAlign: "center", maxWidth: 300 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api";
import type { Copy } from "../i18n";
import { NotificationBell } from "../components/NotificationBell";
import { useNotifications } from "../context/NotificationContext";
import { colors, radius, shadow, zIndex } from "../theme";
import type { Language, PrivacySettings, User } from "../types";

export function ProfileScreen({ copy, language, user, isGuest, privacy, onLanguage, onFamily, onTutorial, onPrivacyChange, onLogout, onAccountDeleted }: {
  copy: Copy;
  language: Language;
  user: User | null;
  isGuest: boolean;
  privacy: PrivacySettings | null;
  onLanguage: (language: Language) => void;
  onFamily: () => void;
  onTutorial: () => void;
  onPrivacyChange: (privacy: PrivacySettings) => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { unreadCount, openCenter } = useNotifications();

  const showToast = (message: string) => setToast(message);
  const [pinSet, setPinSet] = useState(user?.pin_set ?? false);

  useEffect(() => { setPinSet(user?.pin_set ?? false); }, [user?.pin_set]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>RESQ IDENTITY</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{copy.profile}</Text>
          <Pressable onPress={openCenter} style={styles.headerBell} testID="profile-notification-bell">
            <NotificationBell unread={unreadCount} onPress={openCenter} />
          </Pressable>
        </View>
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

        {!isGuest ? (
          <>
            <Text style={styles.sectionLabel}>{copy.accountSecurity}</Text>
            <Pressable onPress={() => setPasswordOpen(true)} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} testID="change-password-button">
              <View style={[styles.menuIcon, { backgroundColor: "#FFE6D9" }]}><MaterialCommunityIcons name="lock-reset" size={22} color={colors.primary} /></View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>{copy.changePassword}</Text>
                <Text style={styles.menuText}>{copy.changePasswordDesc}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <Pressable onPress={() => setPinOpen(true)} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} testID="create-pin-button">
              <View style={[styles.menuIcon, { backgroundColor: "#E7E1FB" }]}><MaterialCommunityIcons name="numeric" size={22} color={colors.tertiary} /></View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>{copy.createPin}</Text>
                <Text style={styles.menuText}>{copy.createPinDesc}</Text>
              </View>
              <View style={[styles.badge, pinSet && styles.badgeOn]} testID="pin-status-badge">
                <Text style={[styles.badgeText, pinSet && styles.badgeTextOn]}>{pinSet ? copy.pinSet : copy.pinNotSet}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setPrivacyOpen(true)} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]} testID="hide-location-button">
              <View style={[styles.menuIcon, { backgroundColor: "#DCFCE7" }]}><MaterialCommunityIcons name="eye-off-outline" size={22} color={colors.success} /></View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>{copy.hideLocation}</Text>
                <Text style={styles.menuText}>{copy.hideLocationDesc}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
            <Pressable onPress={() => setDeleteOpen(true)} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed, styles.menuDanger]} testID="delete-account-button">
              <View style={[styles.menuIcon, { backgroundColor: "#FFD9D6" }]}><MaterialCommunityIcons name="account-remove-outline" size={22} color={colors.brand} /></View>
              <View style={styles.menuBody}>
                <Text style={[styles.menuTitle, styles.dangerText]}>{copy.deleteAccount}</Text>
                <Text style={styles.menuText}>{copy.deleteAccountDesc}</Text>
              </View>
            </Pressable>
          </>
        ) : (
          <View style={styles.guestNote}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
            <Text style={styles.guestNoteText}>{copy.guestRestricted}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={[styles.infoIcon, { backgroundColor: "#FCE7F2" }]}><MaterialCommunityIcons name="account-group" size={22} color={colors.brand} /></View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>{copy.familyCircle}</Text>
            <Text style={styles.infoText}>{copy.familySubtitle}</Text>
          </View>
          <Pressable onPress={onFamily} hitSlop={8} style={({ pressed }) => [styles.familyOpen, pressed && styles.pressed]} testID="family-circle-open-button">
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <View style={[styles.infoIcon, { backgroundColor: "#E7E1FB" }]}><MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.tertiary} /></View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>{copy.survivalTutorialTitle}</Text>
            <Text style={styles.infoText}>{copy.survivalTutorialSubtitle}</Text>
          </View>
          <Pressable onPress={onTutorial} hitSlop={8} style={({ pressed }) => [styles.familyOpen, pressed && styles.pressed]} testID="survival-tutorial-open-button">
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.tertiary} />
          </Pressable>
        </View>

        <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]} testID="logout-button">
          <MaterialCommunityIcons name="logout" size={20} color={colors.brand} />
          <Text style={styles.logoutText}>{copy.logout}</Text>
        </Pressable>
      </ScrollView>

      <ChangePasswordSheet visible={passwordOpen} copy={copy} onClose={() => setPasswordOpen(false)} onDone={(message) => { setPasswordOpen(false); showToast(message); }} />
      <PinSheet visible={pinOpen} copy={copy} onClose={() => setPinOpen(false)} onDone={(message) => { setPinOpen(false); setPinSet(true); showToast(message); }} />
      <PrivacySheet visible={privacyOpen} copy={copy} initial={privacy} onClose={() => setPrivacyOpen(false)} onDone={(next, message) => { onPrivacyChange(next); setPrivacyOpen(false); showToast(message); }} />
      <DeleteAccountSheet visible={deleteOpen} copy={copy} onClose={() => setDeleteOpen(false)} onDeleted={() => { setDeleteOpen(false); onAccountDeleted(); }} />

      <View style={styles.toastLayer} pointerEvents="box-none">
        {toast ? <Pressable onPress={() => setToast(null)} style={styles.toast} testID="profile-toast"><View style={styles.toastIcon}><MaterialCommunityIcons name="shield-check" size={19} color="#FFFFFF" /></View><Text style={styles.toastText}>{toast}</Text></Pressable> : null}
      </View>
    </SafeAreaView>
  );
}

function SheetHeader({ title, onClose, testID }: { title: string; onClose: () => void; testID: string }) {
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Pressable onPress={onClose} style={styles.sheetClose} testID={testID}>
        <MaterialCommunityIcons name="close" size={24} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function ChangePasswordSheet({ visible, copy, onClose, onDone }: {
  visible: boolean;
  copy: Copy;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setCurrent(""); setNext(""); setConfirm(""); setError(null); setLoading(false);
  }, [visible]);

  const submit = async () => {
    if (next.length < 8) { setError(copy.passwordTooShort); return; }
    if (next !== confirm) { setError(copy.passwordMismatch); return; }
    setLoading(true); setError(null);
    try {
      await api.changePassword(current, next);
      onDone(copy.passwordChanged);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "error";
      setError(message.toLowerCase().includes("incorrect") ? copy.currentPasswordWrong : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="password-sheet-backdrop" />
        <KeyboardAvoidingView style={[styles.sheet, { paddingBottom: insets.bottom }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <SheetHeader title={copy.changePassword} onClose={onClose} testID="password-sheet-close" />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>{copy.currentPassword}</Text>
            <TextInput value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.outline} style={styles.textField} testID="current-password-input" />
            <Text style={styles.fieldLabel}>{copy.newPassword}</Text>
            <TextInput value={next} onChangeText={setNext} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.outline} style={styles.textField} testID="new-password-input" />
            <Text style={styles.fieldLabel}>{copy.confirmNewPassword}</Text>
            <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.outline} style={styles.textField} testID="confirm-password-input" />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.filledButton, pressed && styles.pressed, loading && styles.disabled]} testID="password-submit-button">
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.filledButtonText}>{copy.save}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PinSheet({ visible, copy, onClose, onDone }: {
  visible: boolean;
  copy: Copy;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    setPin(""); setError(null); setLoading(false);
  }, [visible]);

  const submit = async () => {
    if (!/^\d{4,8}$/.test(pin)) { setError(copy.pinInvalid); return; }
    setLoading(true); setError(null);
    try {
      await api.setPin(pin);
      onDone(copy.pinSaved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="pin-sheet-backdrop" />
        <KeyboardAvoidingView style={[styles.sheet, { paddingBottom: insets.bottom }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <SheetHeader title={copy.createPin} onClose={onClose} testID="pin-sheet-close" />
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>{copy.createPin}</Text>
            <TextInput value={pin} onChangeText={(value) => setPin(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={8} secureTextEntry placeholder={copy.pinPlaceholder} placeholderTextColor={colors.outline} style={styles.textField} testID="pin-input" />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.filledButton, pressed && styles.pressed, loading && styles.disabled]} testID="pin-submit-button">
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.filledButtonText}>{copy.save}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PrivacySheet({ visible, copy, initial, onClose, onDone }: {
  visible: boolean;
  copy: Copy;
  initial: PrivacySettings | null;
  onClose: () => void;
  onDone: (next: PrivacySettings, message: string) => void;
}) {
  const [hideGps, setHideGps] = useState(false);
  const [hideMesh, setHideMesh] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHideGps(initial?.hide_gps ?? false);
    setHideMesh(initial?.hide_mesh ?? false);
    setLoading(false);
  }, [visible, initial]);

  const toggle = async (kind: "gps" | "mesh", value: boolean) => {
    if (kind === "gps") setHideGps(value); else setHideMesh(value);
    setLoading(true);
    const next: PrivacySettings = kind === "gps" ? { hide_gps: value, hide_mesh: hideMesh } : { hide_gps: hideGps, hide_mesh: value };
    try {
      const result = await api.updatePrivacy(next);
      onDone({ hide_gps: result.hide_gps, hide_mesh: result.hide_mesh }, copy.privacyUpdated);
    } catch {
      if (kind === "gps") setHideGps(!value); else setHideMesh(!value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="privacy-sheet-backdrop" />
        <View style={styles.sheet}>
          <SheetHeader title={copy.hideLocationTitle} onClose={onClose} testID="privacy-sheet-close" />
          <View style={styles.privacyBody}>
            <Text style={styles.privacyBodyText}>{copy.hideLocationBody}</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleBody}>
                <Text style={styles.menuTitle}>{copy.hideGps}</Text>
                <Text style={styles.menuText}>{copy.hideLocationDesc}</Text>
              </View>
              <Switch value={hideGps} onValueChange={(value) => void toggle("gps", value)} disabled={loading} testID="hide-gps-switch" ios_backgroundColor={colors.surfaceContainerHigh} thumbColor="#FFFFFF" trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
            <View style={[styles.toggleRow, styles.toggleRowLast]}>
              <View style={styles.toggleBody}>
                <Text style={styles.menuTitle}>{copy.hideMesh}</Text>
                <Text style={styles.menuText}>{copy.hideLocationDesc}</Text>
              </View>
              <Switch value={hideMesh} onValueChange={(value) => void toggle("mesh", value)} disabled={loading} testID="hide-mesh-switch" ios_backgroundColor={colors.surfaceContainerHigh} thumbColor="#FFFFFF" trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DeleteAccountSheet({ visible, copy, onClose, onDeleted }: {
  visible: boolean;
  copy: Copy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPassword(""); setError(null); setLoading(false);
  }, [visible]);

  const submit = async () => {
    if (!password) { setError(copy.passwordMin); return; }
    setLoading(true); setError(null);
    try {
      await api.deleteAccount(password);
      onDeleted();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "error";
      setError(message.toLowerCase().includes("incorrect") ? copy.currentPasswordWrong : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.centerCard}>
          <View style={[styles.menuIcon, { backgroundColor: "#FFD9D6" }]}><MaterialCommunityIcons name="account-remove-outline" size={26} color={colors.brand} /></View>
          <Text style={styles.deleteTitle}>{copy.deleteAccountTitle}</Text>
          <Text style={styles.deleteBody}>{copy.deleteAccountBody}</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.outline} style={styles.textField} testID="delete-password-input" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable onPress={onClose} disabled={loading} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} testID="delete-cancel-button">
            <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
          </Pressable>
          <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, loading && styles.disabled]} testID="delete-confirm-button">
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dangerButtonText}>{copy.deleteConfirm}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 128 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 32, fontWeight: "700", marginTop: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  headerBell: { marginTop: 4, padding: 6 },
  profileCard: { minHeight: 96, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  avatar: { width: 60, height: 60, borderRadius: 30 }, avatarFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  profileText: { flex: 1 }, name: { color: colors.ink, fontSize: 17, fontWeight: "700" }, email: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  verified: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" }, guestBadge: { backgroundColor: colors.surfaceContainerHigh },
  sectionLabel: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 28, marginBottom: 10 }, segment: { flexDirection: "row", backgroundColor: colors.surfaceSoft, padding: 4, borderRadius: 18, gap: 4 },
  segmentButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, segmentActive: { backgroundColor: colors.secondaryContainer }, segmentText: { color: colors.inkSoft, fontSize: 13, fontWeight: "600" }, segmentTextActive: { color: colors.onPrimaryContainer, fontWeight: "700" },
  menuRow: { backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  menuIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  menuBody: { flex: 1 }, menuTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" }, menuText: { color: colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 3 },
  menuDanger: { borderWidth: 1, borderColor: colors.brand }, dangerText: { color: colors.brand },
  badge: { height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  badgeOn: { backgroundColor: colors.primaryContainer }, badgeText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" }, badgeTextOn: { color: colors.onPrimaryContainer },
  guestNote: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceSoft, borderRadius: 14, padding: 14, marginTop: 16 },
  guestNoteText: { flex: 1, color: colors.info, fontSize: 13, lineHeight: 19 },
  infoCard: { minHeight: 96, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", gap: 12, marginTop: 14 },
  infoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FCE7B2", alignItems: "center", justifyContent: "center" }, infoBody: { flex: 1 }, infoTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, infoText: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 5 },
  familyOpen: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.75 },
  logout: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 24 }, logoutText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, overflow: "hidden", ...shadow },
  sheetHeader: { height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  sheetClose: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  sheetTitle: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: "700" },
  sheetContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  sheetFooter: { padding: 16, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 10 },
  textField: { minHeight: 56, borderRadius: 4, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
  errorText: { color: colors.brand, fontSize: 12, marginTop: 10 },
  filledButton: { minHeight: 56, borderRadius: 28, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  filledButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" }, disabled: { opacity: 0.55 },
  privacyBody: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
  privacyBodyText: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: 14, gap: 12, marginTop: 12 },
  toggleRowLast: { marginBottom: 12 }, toggleBody: { flex: 1 },
  centerCard: { width: "88%", alignSelf: "center", backgroundColor: colors.surface, borderRadius: radius.large, padding: 24, alignItems: "center", ...shadow },
  deleteTitle: { color: colors.ink, fontSize: 21, fontWeight: "800", textAlign: "center", marginTop: 16 },
  deleteBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10, marginBottom: 18 },
  secondaryButton: { width: "100%", minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: 14 },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  dangerButton: { width: "100%", minHeight: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 10 },
  dangerButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  toastLayer: { position: "absolute", left: 0, right: 0, top: 0, height: 80, zIndex: zIndex.toast },
  toast: { position: "absolute", top: 8, left: 18, right: 18, minHeight: 56, paddingHorizontal: 16, borderRadius: 4, backgroundColor: "#322F2E", flexDirection: "row", alignItems: "center", gap: 12, ...shadow },
  toastIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  toastText: { flex: 1, color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "500" },
});

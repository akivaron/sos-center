import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";

const SCAM_REASONS = ["Hoaks", "Titip saldo/uang", "Spam", "Kekerasan palsu", "Lainnya"];
const REAL_REASONS = ["Saya saksi", "Sedang membantu", "Lokasi benar", "Lainnya"];

export function ReportSheet({
  visible,
  title,
  copy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  copy: Copy;
  onClose: () => void;
  onSubmit: (input: { kind: "scam" | "real"; reason: string; note: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<"scam" | "real" | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const reset = () => {
    setKind(null);
    setReason("");
    setNote("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!kind) return;
    onSubmit({ kind, reason, note: note.trim() });
    reset();
    onClose();
  };

  const reasons = kind === "scam" ? SCAM_REASONS : kind === "real" ? REAL_REASONS : [];

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.overlay} testID="report-sheet">
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.grabber} />
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle}>{copy.reportSheetHint}</Text>

        <View style={styles.kinds}>
          <Pressable
            onPress={() => { setKind("scam"); setReason(""); }}
            style={({ pressed }) => [styles.kind, kind === "scam" && styles.kindScam, pressed && styles.pressed]}
            testID="report-kind-scam"
          >
            <MaterialCommunityIcons name="alert-octagon" size={20} color={kind === "scam" ? "#FFFFFF" : colors.brand} />
            <Text style={[styles.kindText, kind === "scam" && styles.kindTextActive]}>{copy.reportScam}</Text>
          </Pressable>
          <Pressable
            onPress={() => { setKind("real"); setReason(""); }}
            style={({ pressed }) => [styles.kind, kind === "real" && styles.kindReal, pressed && styles.pressed]}
            testID="report-kind-real"
          >
            <MaterialCommunityIcons name="check-circle" size={20} color={kind === "real" ? "#FFFFFF" : colors.success} />
            <Text style={[styles.kindText, kind === "real" && styles.kindTextActive]}>{copy.reportReal}</Text>
          </Pressable>
        </View>

        {kind ? (
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{copy.reportReason}</Text>
            <View style={styles.chips}>
              {reasons.map((item) => {
                const active = reason === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setReason(item)}
                    style={[styles.chip, active && styles.chipActive]}
                    testID={`report-reason-${item}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={copy.reportNote}
              placeholderTextColor="#A1A1AA"
              style={styles.note}
              multiline
              maxLength={280}
              testID="report-note-input"
            />
            <View style={styles.actions}>
              <Pressable onPress={close} style={[styles.action, styles.cancel]} testID="report-cancel">
                <Text style={styles.cancelText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable onPress={submit} style={({ pressed }) => [styles.action, styles.submit, pressed && styles.pressed]} testID="report-submit">
                <Text style={styles.submitText}>{copy.reportSubmit}</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, paddingHorizontal: 18, ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  kinds: { flexDirection: "row", gap: 10 },
  kind: { flex: 1, minHeight: 50, borderRadius: radius.large, borderWidth: 1.5, borderColor: colors.outline, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  kindScam: { backgroundColor: colors.brand, borderColor: colors.brand },
  kindReal: { backgroundColor: colors.success, borderColor: colors.success },
  kindText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },
  kindTextActive: { color: "#FFFFFF" },
  form: { maxHeight: 320, marginTop: 14 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.onPrimaryContainer },
  note: { minHeight: 64, maxHeight: 120, borderRadius: radius.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft, padding: 12, color: colors.ink, fontSize: 14, marginTop: 12, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 8 },
  action: { flex: 1, minHeight: 50, borderRadius: radius.large, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: colors.surfaceContainer },
  cancelText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  submit: { backgroundColor: colors.primary },
  submitText: { color: colors.onPrimary, fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.82 },
});

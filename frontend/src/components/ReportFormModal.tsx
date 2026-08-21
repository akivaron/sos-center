import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import type { IncidentType, LocalPhoto, ReportDraft, Severity } from "../types";

const incidentOptions: { type: IncidentType; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: "fire", icon: "fire" }, { type: "flood", icon: "waves" },
  { type: "earthquake", icon: "pulse" }, { type: "crash", icon: "car-emergency" },
  { type: "other", icon: "alert-circle-outline" },
];
const severities: Severity[] = ["moderate", "high", "critical"];

export function ReportFormModal({ visible, copy, loading, locationLabel, mode = "create", initialDraft, onClose, onSubmit, onSaveDraft }: {
  visible: boolean;
  copy: Copy;
  loading: boolean;
  locationLabel: string;
  mode?: "create" | "edit";
  initialDraft?: ReportDraft | null;
  onClose: () => void;
  onSubmit: (draft: ReportDraft) => void;
  onSaveDraft?: (draft: ReportDraft) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [incidentType, setIncidentType] = useState<IncidentType>("fire");
  const [severity, setSeverity] = useState<Severity>("high");
  const [description, setDescription] = useState("");
  const [casualtyCount, setCasualtyCount] = useState("0");
  const [assistanceNeeded, setAssistanceNeeded] = useState("");
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [photoIntent, setPhotoIntent] = useState(false);
  const [photoBlocked, setPhotoBlocked] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [permissionAttempts, setPermissionAttempts] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const draft = initialDraft ?? null;
    setStep(1);
    setIncidentType(draft?.incidentType ?? "fire");
    setSeverity(draft?.severity ?? "high");
    setDescription(draft?.description ?? "");
    setCasualtyCount(String(draft?.casualtyCount ?? 0));
    setAssistanceNeeded(draft?.assistanceNeeded ?? "");
    setPhoto(draft?.photo ?? null);
    setPhotoIntent(false);
    setPhotoBlocked(false);
    setPhotoError(false);
    setPermissionAttempts(0);
  }, [visible, initialDraft]);

  const buildDraft = (): ReportDraft => ({
    incidentType, severity, description: description.trim(),
    casualtyCount: Math.max(0, Number.parseInt(casualtyCount || "0", 10) || 0),
    assistanceNeeded: assistanceNeeded.trim(), photo,
  });

  const pickPhoto = async () => {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (Platform.OS !== "web" && !permission.granted && permission.canAskAgain) {
      const nextAttempt = permissionAttempts + 1;
      setPermissionAttempts(nextAttempt);
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted && nextAttempt >= 2) setPhotoBlocked(true);
    }
    if (Platform.OS !== "web" && !permission.granted) {
      setPhotoBlocked((current) => current || !permission.canAskAgain);
      setPhotoError(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, quality: 0.72, selectionLimit: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? `incident-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      setPhotoIntent(false); setPhotoError(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const submit = () => {
    if (description.trim().length < 5 || assistanceNeeded.trim().length < 2) {
      return;
    }
    onSubmit(buildDraft());
  };

  const saveDraft = () => {
    onSaveDraft?.(buildDraft());
  };

  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.overlay} testID="incident-report-form">
      <Pressable style={styles.backdrop} onPress={onClose} testID="report-form-backdrop" />
      <KeyboardAvoidingView style={[styles.sheet, { paddingBottom: insets.bottom }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.grabber} />
        <View style={styles.topAppBar}>
          <Pressable onPress={step === 1 ? onClose : () => setStep(1)} style={styles.iconButton} testID={step === 1 ? "report-close-button" : "report-back-button"}>
            <MaterialCommunityIcons name={step === 1 ? "close" : "arrow-left"} size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.appBarTitle}>{copy.reportTitle}</Text>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step}/2</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: step === 1 ? "50%" : "100%" }]} /></View>

        <View style={styles.flex}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.stepLabel}>{step === 1 ? copy.stepOne : copy.stepTwo}</Text>
            <Text style={styles.headline}>{step === 1 ? copy.chooseIncident : copy.description}</Text>

            {step === 1 ? (
              <>
                <View style={styles.typeGrid}>
                  {incidentOptions.map((option) => {
                    const selected = option.type === incidentType;
                    return (
                      <Pressable key={option.type} onPress={() => setIncidentType(option.type)} style={[styles.typeCard, option.type === "other" && styles.typeCardWide, selected && styles.typeCardSelected]} testID={`report-type-${option.type}-button`}>
                        <MaterialCommunityIcons name={option.icon} size={26} color={selected ? colors.onPrimaryContainer : colors.inkSoft} />
                        <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{copy[option.type]}</Text>
                        {selected ? <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.fieldLabel}>{copy.severity}</Text>
                <View style={styles.chipRow}>
                  {severities.map((item) => (
                    <Pressable key={item} onPress={() => setSeverity(item)} style={[styles.choiceChip, severity === item && styles.choiceChipSelected]} testID={`report-severity-${item}-button`}>
                      {severity === item ? <MaterialCommunityIcons name="check" size={17} color={colors.onPrimaryContainer} /> : null}
                      <Text style={styles.choiceText}>{copy[item]}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.locationCard}>
                  <View style={styles.locationIcon}><MaterialCommunityIcons name="map-marker" size={23} color={colors.primary} /></View>
                  <View style={styles.flex}><Text style={styles.locationLabel}>{copy.reviewLocation}</Text><Text style={styles.locationText}>{locationLabel}</Text></View>
                  <MaterialCommunityIcons name="check-decagram" size={20} color={colors.success} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{copy.description}</Text>
                <TextInput value={description} onChangeText={setDescription} multiline maxLength={280} placeholder={copy.reportSubtitle} placeholderTextColor={colors.outline} style={[styles.textField, styles.multiline]} testID="report-description-input" />
                <Text style={styles.counter}>{description.length}/280</Text>

                <Text style={styles.fieldLabel}>{copy.casualtyCount}</Text>
                <View style={styles.numberField}>
                  <Pressable onPress={() => setCasualtyCount(String(Math.max(0, Number(casualtyCount) - 1)))} style={styles.stepper} testID="casualty-decrease-button"><MaterialCommunityIcons name="minus" size={22} color={colors.primary} /></Pressable>
                  <TextInput value={casualtyCount} onChangeText={(value) => setCasualtyCount(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={styles.numberInput} testID="casualty-count-input" />
                  <Pressable onPress={() => setCasualtyCount(String(Number(casualtyCount || 0) + 1))} style={styles.stepper} testID="casualty-increase-button"><MaterialCommunityIcons name="plus" size={22} color={colors.primary} /></Pressable>
                </View>

                <Text style={styles.fieldLabel}>{copy.assistanceNeeded}</Text>
                <TextInput value={assistanceNeeded} onChangeText={setAssistanceNeeded} maxLength={280} placeholder={copy.assistanceHint} placeholderTextColor={colors.outline} style={styles.textField} testID="assistance-needed-input" />

                <Text style={styles.fieldLabel}>{copy.addPhoto}</Text>
                {photo ? (
                  <View style={styles.photoCard}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
                    <Pressable onPress={() => { setPhoto(null); setPhotoIntent(true); }} style={styles.photoAction} testID="replace-photo-button"><MaterialCommunityIcons name="image-edit-outline" size={20} color={colors.primary} /><Text style={styles.photoActionText}>{copy.replacePhoto}</Text></Pressable>
                  </View>
                ) : photoIntent ? (
                  <View style={styles.permissionCard}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={28} color={colors.primary} />
                    <Text style={styles.permissionText}>{copy.photoBenefit}</Text>
                    <Pressable onPress={photoBlocked ? () => Linking.openSettings() : () => void pickPhoto()} style={styles.tonalButton} testID={photoBlocked ? "photo-settings-button" : "photo-permission-continue-button"}>
                      <Text style={styles.tonalButtonText}>{photoBlocked ? copy.openSettings : copy.next}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setPhotoIntent(true)} style={styles.photoPlaceholder} testID="add-report-photo-button">
                    <MaterialCommunityIcons name="image-plus" size={28} color={colors.primary} />
                    <Text style={styles.photoPlaceholderText}>{copy.addPhoto}</Text>
                  </Pressable>
                )}
                {photoError ? <Text style={styles.errorText}>{photoBlocked ? copy.photoDenied : copy.photoRequired}</Text> : null}
              </>
            )}
          </ScrollView>
          <View style={styles.bottomBar}>
            {onSaveDraft ? (
              <Pressable onPress={saveDraft} disabled={loading} style={({ pressed }) => [styles.draftButton, pressed && styles.pressed]} testID="report-save-draft-button">
                <MaterialCommunityIcons name="content-save-outline" size={19} color={colors.primary} />
                <Text style={styles.draftButtonText}>{copy.saveDraft}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={step === 1 ? () => setStep(2) : submit} disabled={loading} style={({ pressed }) => [styles.filledButton, pressed && styles.pressed, loading && styles.disabled]} testID={step === 1 ? "report-next-button" : "report-submit-button"}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <><Text style={styles.filledButtonText}>{step === 1 ? copy.next : mode === "edit" ? copy.saveChanges : copy.sendReport}</Text><MaterialCommunityIcons name={step === 1 ? "arrow-right" : "send"} size={20} color={colors.onPrimary} /></>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, overflow: "hidden", ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  flex: { flex: 1 },
  topAppBar: { height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  appBarTitle: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: "700" },
  stepBadge: { height: 32, minWidth: 48, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.secondaryContainer, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { color: colors.onPrimaryContainer, fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 4, backgroundColor: colors.surfaceContainerHigh }, progressFill: { height: 4, backgroundColor: colors.primary },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 130 },
  stepLabel: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  headline: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "700", marginTop: 5, marginBottom: 16 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "48%", minHeight: 68, borderRadius: radius.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  typeCardWide: { width: "100%" },
  typeCardSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  typeText: { flex: 1, color: colors.inkSoft, fontSize: 14, fontWeight: "700" }, typeTextSelected: { color: colors.onPrimaryContainer },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 7 },
  choiceChipSelected: { backgroundColor: colors.secondaryContainer, borderColor: colors.primary }, choiceText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  locationCard: { minHeight: 70, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 16 },
  locationIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  locationLabel: { color: colors.inkSoft, fontSize: 12 }, locationText: { color: colors.ink, fontSize: 14, fontWeight: "700", marginTop: 3 },
  textField: { minHeight: 56, borderRadius: 4, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 120, paddingTop: 14, textAlignVertical: "top" }, counter: { color: colors.inkSoft, fontSize: 11, textAlign: "right", marginTop: 5 },
  numberField: { height: 56, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { width: 56, height: 56, alignItems: "center", justifyContent: "center" }, numberInput: { minWidth: 80, textAlign: "center", color: colors.ink, fontSize: 20, fontWeight: "700" },
  photoPlaceholder: { height: 112, borderRadius: radius.large, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", gap: 8 },
  photoPlaceholderText: { color: colors.onPrimaryContainer, fontSize: 14, fontWeight: "700" },
  permissionCard: { minHeight: 150, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, padding: 18, alignItems: "center", justifyContent: "center" },
  permissionText: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, textAlign: "center", marginVertical: 10 },
  tonalButton: { minHeight: 44, borderRadius: 22, backgroundColor: colors.secondaryContainer, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }, tonalButtonText: { color: colors.onPrimaryContainer, fontSize: 14, fontWeight: "700" },
  photoCard: { height: 190, borderRadius: radius.large, overflow: "hidden", backgroundColor: colors.surfaceContainer }, photo: { width: "100%", height: 142 },
  photoAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, photoActionText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  errorText: { color: colors.brand, fontSize: 12, marginTop: 7 },
  bottomBar: { padding: 16, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", gap: 10 },
  draftButton: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  draftButtonText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  filledButton: { flex: 1, minHeight: 56, borderRadius: 28, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  filledButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.55 },
});
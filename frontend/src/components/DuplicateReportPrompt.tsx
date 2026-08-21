import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import type { Incident } from "../types";

const typeColor = { fire: "#BA1A1A", flood: "#00639B", earthquake: "#6750A4", crash: "#8A5100", other: "#5D5D66" } as const;
const typeIcon = { fire: "fire", flood: "waves", earthquake: "pulse", crash: "car-emergency", other: "alert-circle-outline" } as const;

export function DuplicateReportPrompt({ incident, copy, onShowExisting, onNewReport, onDismiss }: {
  incident: Incident;
  copy: Copy;
  onShowExisting: () => void;
  onNewReport: () => void;
  onDismiss: () => void;
}) {
  const accent = typeColor[incident.incident_type];

  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
    <View style={styles.overlay} testID="duplicate-prompt-backdrop">
      <Pressable style={styles.backdrop} onPress={onDismiss} testID="duplicate-backdrop" />
      <Pressable style={styles.sheet} onPress={() => {}} testID="duplicate-prompt">
        <View style={styles.handle} />
        <Text style={styles.title}>{copy.duplicateTitle}</Text>
        <Text style={styles.question}>{copy.duplicateQuestion}</Text>

        <View style={[styles.preview, { borderLeftColor: accent }]}>
          <View style={[styles.previewIcon, { backgroundColor: accent }]}>
            <MaterialCommunityIcons name={typeIcon[incident.incident_type]} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle}>{copy[incident.incident_type]}</Text>
            <Text style={styles.previewMeta}>{copy[incident.severity]} • {copy.reportedBy} {incident.reporter_name}</Text>
            {incident.description ? <Text style={styles.previewDesc} numberOfLines={2}>{incident.description}</Text> : null}
          </View>
        </View>

        <Pressable onPress={onShowExisting} style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]} testID="duplicate-same-button">
          <MaterialCommunityIcons name="content-duplicate" size={18} color={colors.onPrimary} />
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{copy.duplicateSame}</Text>
        </Pressable>
        <Pressable onPress={onNewReport} style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]} testID="duplicate-new-button">
          <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.brand} />
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>{copy.duplicateNew}</Text>
        </Pressable>
      </Pressable>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.36)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, ...shadow },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outline, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "700", textAlign: "center" },
  question: { color: colors.inkSoft, fontSize: 13, fontWeight: "500", textAlign: "center", marginTop: 6, marginBottom: 14, lineHeight: 19 },
  preview: { flexDirection: "row", gap: 12, padding: 12, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, borderLeftWidth: 4, marginBottom: 16 },
  previewIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previewBody: { flex: 1 },
  previewTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  previewMeta: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  previewDesc: { color: colors.inkSoft, fontSize: 12, marginTop: 6, lineHeight: 17 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: radius.large, marginBottom: 10 },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonSecondary: { backgroundColor: colors.primaryContainer },
  buttonText: { fontSize: 14, fontWeight: "700" },
  buttonTextPrimary: { color: colors.onPrimary },
  buttonTextSecondary: { color: colors.brand },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});

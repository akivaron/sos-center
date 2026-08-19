import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { forwardRef, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Copy } from "../i18n";
import { colors } from "../theme";
import type { IncidentType } from "../types";

const options: { type: IncidentType; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
  { type: "fire", icon: "fire", color: "#DC2626" },
  { type: "flood", icon: "waves", color: "#2563EB" },
  { type: "earthquake", icon: "pulse", color: "#7C3AED" },
  { type: "crash", icon: "car-emergency", color: "#F59E0B" },
];

export const ReportSheet = forwardRef<BottomSheetModal, {
  copy: Copy;
  loading: boolean;
  onSubmit: (type: IncidentType, description: string) => void;
}>(({ copy, loading, onSubmit }, ref) => {
  const [selected, setSelected] = useState<IncidentType>("fire");
  const [description, setDescription] = useState("");
  const snapPoints = useMemo(() => ["58%", "78%"], []);

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content} testID="incident-report-sheet">
        <Text style={styles.title}>{copy.reportTitle}</Text>
        <Text style={styles.subtitle}>{copy.reportSubtitle}</Text>
        <View style={styles.grid}>
          {options.map((option) => {
            const active = option.type === selected;
            return (
              <Pressable
                key={option.type}
                onPress={() => {
                  setSelected(option.type);
                  void Haptics.selectionAsync();
                }}
                style={[styles.option, active && { borderColor: option.color, backgroundColor: `${option.color}10` }]}
                testID={`incident-type-${option.type}-button`}
              >
                <View style={[styles.optionIcon, { backgroundColor: `${option.color}18` }]}>
                  <MaterialCommunityIcons name={option.icon} size={28} color={option.color} />
                </View>
                <Text style={styles.optionText}>{copy[option.type]}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={`${copy.other}...`}
          placeholderTextColor="#A1A1AA"
          maxLength={280}
          style={styles.input}
          testID="incident-description-input"
        />
        <Pressable
          onPress={() => onSubmit(selected, description.trim())}
          disabled={loading}
          style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}
          testID="incident-submit-button"
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{copy.sendReport}</Text>}
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ReportSheet.displayName = "ReportSheet";

const styles = StyleSheet.create({
  background: { backgroundColor: colors.surface, borderRadius: 28 },
  handle: { width: 44, backgroundColor: "#A1A1AA" },
  content: { flex: 1, paddingHorizontal: 22, paddingBottom: 28 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 14, color: colors.inkSoft, marginTop: 4, marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  option: { width: "48%", minHeight: 100, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, padding: 14, justifyContent: "space-between" },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionText: { fontSize: 15, fontWeight: "800", color: colors.ink },
  input: { minHeight: 52, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.ink, fontSize: 15 },
  submit: { minHeight: 54, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 14 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import type { Language } from "../types";
import {
  getTutorialItems,
  TUTORIAL_CATEGORIES,
  TUTORIAL_PRIORITY_LABEL,
  type TutorialCategoryId,
  type TutorialItem,
} from "../services/survivalTutorial";
import { colors, radius, shadow, zIndex } from "../theme";

const PRIORITY_COLOR: Record<TutorialItem["priority"], string> = {
  urgent: "#DC2626",
  optional: "#8A5100",
  trick: "#7E57C2",
};

function localize(text: { id: string; en: string }, language: Language): string {
  return language === "en" ? text.en : text.id;
}

function priorityColor(item: TutorialItem): string {
  return PRIORITY_COLOR[item.priority];
}

function TutorialCard({ item, language, copy, testID }: {
  item: TutorialItem;
  language: Language;
  copy: Copy;
  testID: string;
}) {
  const [open, setOpen] = useState(false);
  const steps = language === "en" ? item.steps.en : item.steps.id;
  return (
    <View style={[styles.card, shadow]} testID={testID}>
      <Pressable
        onPress={() => setOpen((next) => !next)}
        style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
        testID={`${testID}-toggle`}
      >
        <View style={[styles.cardIcon, { backgroundColor: priorityColor(item) }]}>
          <MaterialCommunityIcons name={item.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{localize(item.title, language)}</Text>
          <Text style={styles.cardSummary} numberOfLines={open ? undefined : 2}>
            {localize(item.summary, language)}
          </Text>
        </View>
        <View style={styles.cardSide}>
          <View style={[styles.priorityTag, { backgroundColor: priorityColor(item) }]} testID={`${testID}-priority`}>
            <Text style={styles.priorityText}>{localize(TUTORIAL_PRIORITY_LABEL[item.priority], language)}</Text>
          </View>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.inkSoft} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.steps} testID={`${testID}-steps`}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNum}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SurvivalTutorialScreen({ copy, language, onClose }: {
  copy: Copy;
  language: Language;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<TutorialCategoryId | "all">("all");

  const items = useMemo(() => getTutorialItems(category), [category]);

  return (
    <View style={styles.overlay} testID="survival-tutorial-screen">
      <Pressable style={styles.backdrop} onPress={onClose} testID="survival-tutorial-backdrop" />
      <View style={[styles.sheet, { paddingTop: insets.top + 4 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]} testID="survival-tutorial-close-button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{copy.survivalTutorialTitle}</Text>
        </View>
        <Text style={styles.subtitle}>{copy.survivalTutorialSubtitle}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          <Pressable
            onPress={() => setCategory("all")}
            style={({ pressed }) => [styles.chip, category === "all" && styles.chipActive, pressed && styles.pressed]}
            testID="survival-tutorial-filter-all-button"
          >
            <MaterialCommunityIcons name="grid" size={16} color={category === "all" ? colors.onPrimaryContainer : colors.inkSoft} />
            <Text style={[styles.chipLabel, category === "all" && styles.chipLabelActive]}>{copy.allResources}</Text>
          </Pressable>
          {TUTORIAL_CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                testID={`survival-tutorial-filter-${cat.id}-button`}
              >
                <MaterialCommunityIcons name={cat.icon} size={16} color={active ? colors.onPrimaryContainer : colors.inkSoft} />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{localize(cat.label, language)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="book-open-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{copy.survivalTutorialEmpty}</Text>
            </View>
          ) : (
            items.map((item) => (
              <TutorialCard
                key={item.id}
                item={item}
                language={language}
                copy={copy}
                testID={`survival-tutorial-${item.id}-card`}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  sheet: { position: "relative", flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: "700" },
  subtitle: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginTop: 2, marginBottom: 10 },
  pressed: { opacity: 0.7 },
  chipsScroll: { maxHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  chipLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  chipLabelActive: { color: colors.onPrimaryContainer },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 140 },
  card: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  cardSummary: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 3 },
  cardSide: { alignItems: "flex-end", gap: 4 },
  priorityTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  steps: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNum: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  stepText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19 },
  emptyCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 28, alignItems: "center", marginTop: 16 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700", textAlign: "center" },
});

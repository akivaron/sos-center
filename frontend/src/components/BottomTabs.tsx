import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, shadow, zIndex } from "../theme";
import type { TabKey } from "../types";

const tabs: { key: TabKey; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: keyof Copy }[] = [
  { key: "map", icon: "map-marker-radius", label: "map" },
  { key: "reports", icon: "alert-box-outline", label: "reports" },
  { key: "chat", icon: "access-point-network", label: "chat" },
  { key: "profile", icon: "account-circle-outline", label: "profile" },
];

export function BottomTabs({ current, copy, bottom, onChange, onSOS }: {
  current: TabKey;
  copy: Copy;
  bottom: number;
  onChange: (tab: TabKey) => void;
  onSOS: () => void;
}) {
  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = current === tab.key;
    return (
      <Pressable
        key={tab.key}
        onPress={() => {
          void Haptics.selectionAsync();
          onChange(tab.key);
        }}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        testID={`${tab.key}-tab-button`}
      >
        <View style={[styles.indicator, active && styles.indicatorActive]}>
          <MaterialCommunityIcons name={tab.icon} size={23} color={active ? colors.onPrimaryContainer : colors.inkSoft} />
        </View>
        <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{copy[tab.label]}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.shell, { height: 80 + bottom, paddingBottom: bottom }]} testID="main-tab-bar">
      <View style={styles.row}>
        {tabs.slice(0, 2).map(renderTab)}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onSOS();
          }}
          style={({ pressed }) => [styles.sos, pressed && styles.sosPressed]}
          testID="sos-trigger-button"
        >
          <Text style={styles.sosText}>{copy.sos}</Text>
        </Pressable>
        {tabs.slice(2).map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: zIndex.bottomNav, backgroundColor: colors.surfaceContainer, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flex: 1, flexDirection: "row", paddingHorizontal: 8 },
  item: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  indicatorActive: { backgroundColor: colors.secondaryContainer },
  pressed: { opacity: 0.65 },
  label: { fontSize: 11, fontWeight: "600", color: colors.inkSoft },
  activeLabel: { color: colors.onPrimaryContainer, fontWeight: "700" },
  sos: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surfaceContainer, marginHorizontal: 4, ...shadow },
  sosText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  sosPressed: { transform: [{ scale: 0.92 }] },
});
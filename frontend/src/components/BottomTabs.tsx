import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors } from "../theme";
import type { TabKey } from "../types";

const tabs: { key: TabKey; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: keyof Copy }[] = [
  { key: "map", icon: "map-marker-radius", label: "map" },
  { key: "reports", icon: "alert-box-outline", label: "reports" },
  { key: "chat", icon: "access-point-network", label: "chat" },
  { key: "profile", icon: "account-circle-outline", label: "profile" },
];

export function BottomTabs({ current, copy, bottom, onChange }: {
  current: TabKey;
  copy: Copy;
  bottom: number;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <View style={[styles.shell, { height: 80 + bottom, paddingBottom: bottom }]} testID="main-tab-bar">
      <View style={styles.row}>
        {tabs.map((tab) => {
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
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceContainer, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flex: 1, flexDirection: "row", paddingHorizontal: 8 },
  item: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  indicatorActive: { backgroundColor: colors.secondaryContainer },
  pressed: { opacity: 0.65 },
  label: { fontSize: 11, fontWeight: "600", color: colors.inkSoft },
  activeLabel: { color: colors.onPrimaryContainer, fontWeight: "700" },
});
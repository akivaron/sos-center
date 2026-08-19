import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, shadow } from "../theme";
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
    <BlurView intensity={85} tint="light" style={[styles.shell, { bottom: bottom + 12 }]} testID="main-tab-bar">
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
              <MaterialCommunityIcons name={tab.icon} size={23} color={active ? colors.brand : colors.inkSoft} />
              <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{copy[tab.label]}</Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  shell: { position: "absolute", left: 16, right: 16, height: 72, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", ...shadow },
  row: { flex: 1, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.72)", paddingHorizontal: 6 },
  item: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 3 },
  pressed: { opacity: 0.55, transform: [{ scale: 0.96 }] },
  label: { fontSize: 10, fontWeight: "700", color: colors.inkSoft },
  activeLabel: { color: colors.brand },
});
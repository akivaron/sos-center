import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "../theme";
import type { NotificationKind } from "../types";

export const notificationIcon: Record<NotificationKind, { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
  incident_new: { name: "map-marker-alert", color: colors.brand },
  incident_update: { name: "bell-ring-outline", color: colors.warning },
  discussion: { name: "forum-outline", color: colors.info },
  verdict: { name: "shield-check-outline", color: colors.success },
  sos: { name: "alarm", color: colors.brand },
  system: { name: "cog-outline", color: colors.inkSoft },
};

export function NotificationBell({ unread, onPress, testID = "notification-bell-button" }: {
  unread: number;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]} testID={testID}>
      <MaterialCommunityIcons name="bell-outline" size={22} color={colors.info} />
      {unread > 0 ? (
        <View style={styles.badge} testID="notification-unread-badge">
          <Text style={styles.badgeText} numberOfLines={1}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: radius.medium, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", lineHeight: 12 },
});

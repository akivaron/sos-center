import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, shadow } from "../theme";

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4200);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <Pressable onPress={onDismiss} style={styles.toast} testID="status-toast">
      <View style={styles.icon}><MaterialCommunityIcons name="shield-check" size={19} color="#FFFFFF" /></View>
      <Text style={styles.text}>{message}</Text>
      <MaterialCommunityIcons name="close" size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", top: 8, left: 18, right: 18, minHeight: 58, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, ...shadow },
  icon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "700" },
});
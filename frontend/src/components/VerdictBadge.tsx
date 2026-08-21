import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import type { Verdict } from "../types";
import { colors } from "../theme";

type Meta = { label: string; color: string; icon: "shield-check" | "alert-outline" | "help-circle" | "alert-octagon" };

export function verdictMeta(verdict: Verdict | undefined, copy: Copy): Meta {
  switch (verdict) {
    case "likely_safe":
      return { label: copy.verdictLikelySafe, color: colors.success, icon: "shield-check" };
    case "suspicious":
      return { label: copy.verdictSuspicious, color: colors.warning, icon: "alert-outline" };
    case "likely_scam":
      return { label: copy.verdictLikelyScam, color: colors.brand, icon: "alert-octagon" };
    default:
      return { label: copy.verdictUnverified, color: colors.outline, icon: "help-circle" };
  }
}

export function VerdictBadge({ verdict, copy }: { verdict?: Verdict; copy: Copy }) {
  const meta = verdictMeta(verdict, copy);
  return (
    <View style={[styles.badge, { backgroundColor: `${meta.color}1A`, borderColor: `${meta.color}55` }]} testID="verdict-badge">
      <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, borderRadius: 13, paddingHorizontal: 9, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: "700" },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors } from "../theme";

export function LocationGate({
  visible,
  canAskAgain,
  loading,
  copy,
  onRequest,
  onDismiss,
}: {
  visible: boolean;
  canAskAgain: boolean;
  loading: boolean;
  copy: Copy;
  onRequest: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="location-permission-sheet">
          <View style={styles.icon}><MaterialCommunityIcons name="crosshairs-gps" size={28} color={colors.info} /></View>
          <Text style={styles.title}>{copy.locationTitle}</Text>
          <Text style={styles.body}>{copy.locationBody}</Text>
          <Pressable
            onPress={canAskAgain ? onRequest : () => Linking.openSettings()}
            style={styles.primary}
            testID={canAskAgain ? "location-request-button" : "location-settings-button"}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{canAskAgain ? copy.allowLocation : copy.openSettings}</Text>}
          </Pressable>
          <Pressable onPress={onDismiss} style={styles.secondary} testID="location-skip-button">
            <Text style={styles.secondaryText}>{copy.continueWithout}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.5)", justifyContent: "flex-end" },
  card: { minHeight: "52%", backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, alignItems: "center" },
  icon: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: colors.ink, textAlign: "center" },
  body: { fontSize: 16, lineHeight: 24, color: colors.inkSoft, textAlign: "center", marginTop: 12, marginBottom: 28 },
  primary: { width: "100%", minHeight: 54, borderRadius: 18, backgroundColor: colors.info, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondary: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", marginTop: 8 },
  secondaryText: { color: colors.inkSoft, fontSize: 15, fontWeight: "700" },
});
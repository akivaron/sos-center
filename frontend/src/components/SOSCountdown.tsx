import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";

export function SOSCountdown({ visible, copy, onCancel, onComplete }: {
  visible: boolean;
  copy: Copy;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [count, setCount] = useState(5);
  const completed = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setCount(5);
    completed.current = false;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const timer = setInterval(() => {
      setCount((current) => Math.max(0, current - 1));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (visible && count === 0 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  }, [visible, count, onComplete]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.screen} testID="sos-countdown-modal">
        <Text style={styles.eyebrow}>{copy.sosSending}</Text>
        <Text style={styles.count} testID="sos-countdown-number">{count}</Text>
        <Text style={styles.signal}>RESQ EMERGENCY BROADCAST</Text>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]} testID="sos-cancel-button">
          <Text style={styles.cancelText}>{copy.cancel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", padding: 28 },
  eyebrow: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center", opacity: 0.9 },
  count: { color: "#FFFFFF", fontSize: 148, lineHeight: 170, fontWeight: "900", letterSpacing: -8, marginVertical: 8 },
  signal: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  cancel: { position: "absolute", bottom: "13%", left: 28, right: 28, minHeight: 60, backgroundColor: "#FFFFFF", borderRadius: 30, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#B91C1C", fontSize: 18, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
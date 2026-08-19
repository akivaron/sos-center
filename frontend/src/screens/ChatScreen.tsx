import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { sendMeshMessage, startMesh, stopMesh, type MeshPeer } from "../services/mesh";
import { colors } from "../theme";
import type { MeshMessage, User } from "../types";

type MeshState = "idle" | "active" | "denied" | "settings" | "disabled" | "unsupported";

export function ChatScreen({ copy, user }: { copy: Copy; user: User | null }) {
  const [state, setState] = useState<MeshState>("idle");
  const [attempts, setAttempts] = useState(0);
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [text, setText] = useState("");

  useEffect(() => () => stopMesh(), []);

  const activate = async () => {
    if (state === "settings") return void Linking.openSettings();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    try {
      const result = await startMesh(
        user?.name ?? "Guest",
        setPeers,
        (body, sender) => setMessages((current) => [...current, {
          id: `rx_${Date.now()}`,
          sender,
          body,
          createdAt: Date.now(),
          status: "delivered",
          mine: false,
          ttl: 4,
        }]),
      );
      if (result.status === "active") setState("active");
      else if (result.status === "denied") setState(nextAttempts >= 2 ? "settings" : "denied");
      else if (result.status === "disabled") setState("disabled");
      else setState("unsupported");
    } catch {
      setState(Platform.OS === "web" ? "unsupported" : nextAttempts >= 2 ? "settings" : "denied");
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const id = `msg_${Date.now()}`;
    const message: MeshMessage = { id, sender: user?.name ?? "Guest", body, createdAt: Date.now(), status: "queued", mine: true, ttl: 4 };
    setMessages((current) => [...current, message]);
    if (!selectedPeer) return;
    try {
      await sendMeshMessage(selectedPeer, body);
      setMessages((current) => current.map((item) => item.id === id ? { ...item, status: "delivered" } : item));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setMessages((current) => current.map((item) => item.id === id ? { ...item, status: "relayed" } : item));
    }
  };

  const buttonText = state === "settings" ? copy.openSettings : state === "active" ? copy.searching : copy.activateBluetooth;
  const statusText = state === "unsupported" ? copy.bluetoothUnavailable : state === "denied" || state === "settings" ? copy.bluetoothDenied : state === "disabled" ? copy.offline : copy.meshBody;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="mesh-chat-screen">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={8}>
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="access-point-network" size={27} color={colors.info} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{copy.meshTitle}</Text>
            <Text style={styles.peerCount}>{peers.length} {copy.peers}</Text>
          </View>
          <View style={[styles.liveDot, state === "active" && styles.liveDotActive]} />
        </View>

        {state !== "active" ? (
          <View style={styles.setup} testID="mesh-setup-card">
            <View style={styles.radar}>
              <View style={styles.radarInner}><MaterialCommunityIcons name="bluetooth" size={40} color={colors.info} /></View>
            </View>
            <Text style={styles.setupTitle}>{copy.meshTitle}</Text>
            <Text style={styles.setupBody}>{statusText}</Text>
            <Pressable onPress={() => void activate()} style={({ pressed }) => [styles.activate, pressed && styles.pressed]} testID="mesh-activate-button">
              <MaterialCommunityIcons name={state === "settings" ? "cog" : "bluetooth-connect"} size={21} color="#FFFFFF" />
              <Text style={styles.activateText}>{buttonText}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.peerStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peerRow}>
                {peers.length === 0 ? <Text style={styles.searching}>{copy.searching}</Text> : peers.map((peer) => (
                  <Pressable key={peer.id} onPress={() => setSelectedPeer(peer.id)} style={[styles.peerChip, selectedPeer === peer.id && styles.peerChipActive]} testID={`mesh-peer-${peer.id}-button`}>
                    <MaterialCommunityIcons name="cellphone-wireless" size={17} color={selectedPeer === peer.id ? "#FFFFFF" : colors.info} />
                    <Text style={[styles.peerName, selectedPeer === peer.id && styles.peerNameActive]} numberOfLines={1}>{peer.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <ScrollView style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
              {messages.length === 0 ? (
                <View style={styles.chatEmpty}><MaterialCommunityIcons name="message-processing-outline" size={38} color="#A1A1AA" /><Text style={styles.chatEmptyText}>{copy.meshBody}</Text></View>
              ) : messages.map((message) => (
                <View key={message.id} style={[styles.bubble, message.mine ? styles.mine : styles.theirs]} testID={`mesh-message-${message.id}`}>
                  {!message.mine ? <Text style={styles.sender}>{message.sender}</Text> : null}
                  <Text style={[styles.messageText, message.mine && styles.mineText]}>{message.body}</Text>
                  <Text style={[styles.delivery, message.mine && styles.mineDelivery]}>{copy[`${message.status}Status` as "queuedStatus"]}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.composer}>
              <TextInput value={text} onChangeText={setText} placeholder={copy.messagePlaceholder} placeholderTextColor="#A1A1AA" style={styles.input} multiline maxLength={500} testID="mesh-message-input" />
              <Pressable onPress={() => void send()} style={({ pressed }) => [styles.send, pressed && styles.pressed]} testID="mesh-send-button">
                <MaterialCommunityIcons name="send" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" }, flex: { flex: 1 },
  header: { minHeight: 82, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 }, title: { color: colors.ink, fontSize: 20, fontWeight: "900" }, peerCount: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 3 },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#D4D4D8" }, liveDotActive: { backgroundColor: colors.success },
  setup: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 92 },
  radar: { width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(37,99,235,0.07)", alignItems: "center", justifyContent: "center" },
  radarInner: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#BFDBFE" },
  setupTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center", marginTop: 24 },
  setupBody: { color: colors.inkSoft, fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 10, maxWidth: 330 },
  activate: { minHeight: 54, borderRadius: 18, backgroundColor: colors.info, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 22, marginTop: 24 },
  activateText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  peerStrip: { height: 62, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }, peerRow: { alignItems: "center", gap: 8, paddingHorizontal: 16 },
  peerChip: { height: 38, maxWidth: 160, borderRadius: 19, borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  peerChipActive: { backgroundColor: colors.info, borderColor: colors.info }, peerName: { maxWidth: 110, color: colors.info, fontSize: 12, fontWeight: "800" }, peerNameActive: { color: "#FFFFFF" }, searching: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },
  messages: { flex: 1 }, messageContent: { padding: 16, paddingBottom: 120, gap: 10 }, chatEmpty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 30 }, chatEmptyText: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }, mine: { alignSelf: "flex-end", backgroundColor: colors.info, borderBottomRightRadius: 6 }, theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  sender: { color: colors.info, fontSize: 10, fontWeight: "900", marginBottom: 4 }, messageText: { color: colors.ink, fontSize: 15, lineHeight: 21 }, mineText: { color: "#FFFFFF" }, delivery: { color: colors.inkSoft, fontSize: 9, fontWeight: "800", marginTop: 5 }, mineDelivery: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  composer: { position: "absolute", left: 12, right: 12, bottom: 92, minHeight: 58, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "flex-end", padding: 7, gap: 8 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: 11, paddingVertical: 11, color: colors.ink, fontSize: 15 }, send: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.info, alignItems: "center", justifyContent: "center" },
});
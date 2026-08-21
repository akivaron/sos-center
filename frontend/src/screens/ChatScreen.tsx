import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { useMesh, type MeshChatApi } from "../context/MeshContext";
import type { MeshConversation } from "../types";
import { colors, radius, shadow, zIndex } from "../theme";
import { BROADCAST_ID } from "../services/meshStore";

type MeshStatus = MeshChatApi["status"];

function statusText(status: MeshStatus, copy: Copy): string {
  switch (status) {
    case "unsupported": return copy.bluetoothUnavailable;
    case "denied": return copy.bluetoothDenied;
    case "disabled": return copy.offline;
    case "settings": return copy.bluetoothDenied;
    case "starting": return copy.meshConnecting;
    default: return copy.meshBody;
  }
}

export function ChatScreen({ copy }: { copy: Copy }) {
  const mesh = useMesh();
  const [pairPeerId, setPairPeerId] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState("");
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConv = useMemo(
    () => mesh.conversations.find((c) => c.id === mesh.activeId) ?? null,
    [mesh.conversations, mesh.activeId],
  );

  useEffect(() => {
    if (mesh.messages.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [mesh.messages.length]);

  const activate = async () => {
    if (mesh.status === "settings") {
      await Linking.openSettings();
      return;
    }
    await mesh.activate();
  };

  if (mesh.status !== "active") {
    const buttonText = mesh.status === "settings" ? copy.openSettings : mesh.status === "starting" ? copy.meshConnecting : copy.activateBluetooth;
    return (
      <SafeAreaView style={styles.screen} edges={["top"]} testID="mesh-chat-screen">
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="access-point-network" size={27} color={colors.info} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{copy.meshTitle}</Text>
            <Text style={styles.peerCount}>{mesh.peers.length} {copy.meshNearbyDevices}</Text>
          </View>
          <View style={styles.liveDot} />
        </View>
        <View style={styles.setup} testID="mesh-setup-card">
          <View style={styles.radar}>
            <View style={styles.radarInner}><MaterialCommunityIcons name="bluetooth" size={40} color={colors.info} /></View>
          </View>
          <Text style={styles.setupTitle}>{copy.meshTitle}</Text>
          <Text style={styles.setupBody}>{statusText(mesh.status, copy)}</Text>
          <Pressable
            onPress={() => void activate()}
            disabled={mesh.busy}
            style={({ pressed }) => [styles.activate, pressed && styles.pressed, mesh.busy && styles.disabled]}
            testID="mesh-activate-button"
          >
            {mesh.busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name={mesh.status === "settings" ? "cog" : "bluetooth-connect"} size={21} color="#FFFFFF" />}
            <Text style={styles.activateText}>{buttonText}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!mesh.activeId) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]} testID="mesh-chat-screen">
        <View style={styles.header}>
          <View style={styles.headerIcon}><MaterialCommunityIcons name="access-point-network" size={27} color={colors.info} /></View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{copy.meshConversations}</Text>
            <Text style={styles.peerCount}>{mesh.peers.length} {copy.meshNearbyDevices}</Text>
          </View>
          <View style={[styles.liveDot, styles.liveDotActive]} />
        </View>
        <ConversationList copy={copy} mesh={mesh} onOpen={(peerId) => void mesh.openConversation(peerId)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="mesh-chat-screen">
      <ThreadHeader
        copy={copy}
        conv={activeConv}
        peer={mesh.peers.find((p) => p.id === mesh.activeId) ?? null}
        onBack={() => void mesh.openConversation(null)}
        onPair={() => activeConv?.peerId && setPairPeerId(activeConv.peerId)}
        onUnpair={() => activeConv?.peerId && void mesh.unpairPeer(activeConv.peerId)}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messageContent}
        keyboardShouldPersistTaps="handled"
      >
        {mesh.messages.length === 0 ? (
          <View style={styles.chatEmpty}>
            <MaterialCommunityIcons name="message-processing-outline" size={38} color="#A1A1AA" />
            <Text style={styles.chatEmptyText}>{copy.meshSelectChat}</Text>
          </View>
        ) : mesh.messages.map((message) => (
          <View key={message.id} style={[styles.bubble, message.mine ? styles.mine : styles.theirs]} testID={`mesh-message-${message.id}`}>
            {!message.mine ? <Text style={styles.sender}>{message.senderName}</Text> : null}
            <Text style={[styles.messageText, message.mine && styles.mineText]}>{message.body}</Text>
            {message.encrypted ? <MaterialCommunityIcons name="lock" size={11} color={message.mine ? colors.onPrimaryContainer : colors.info} style={styles.lock} /> : null}
            {message.mine ? <Text style={[styles.delivery, styles.mineDelivery]}>{copy[`${message.status}Status` as "queuedStatus"]}</Text> : null}
          </View>
        ))}
        {mesh.typingPeer ? (
          <View style={[styles.bubble, styles.theirs]}>
            <Text style={styles.messageText}>{copy.meshTyping}</Text>
          </View>
        ) : null}
      </ScrollView>
      <Composer
        copy={copy}
        encrypted={!!activeConv?.encrypted}
        onChange={() => {
          void mesh.sendTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => void mesh.sendTyping(false), 2500);
        }}
        onSend={(text) => {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          void mesh.sendMessage(text);
        }}
      />
      <PairSheet
        copy={copy}
        peerId={pairPeerId}
        peer={mesh.peers.find((p) => p.id === pairPeerId) ?? null}
        pairing={pairing}
        error={pairError}
        code={pairCode}
        onCode={setPairCode}
        onClose={() => { setPairPeerId(null); setPairCode(""); setPairError(null); }}
        onConfirm={async () => {
          if (!pairPeerId) return;
          setPairing(true);
          setPairError(null);
          try {
            const pairing = await mesh.pairPeer(pairPeerId, pairCode);
            setPairing(false);
            setPairPeerId(null);
            setPairCode("");
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void mesh.openConversation(pairPeerId);
            void pairing;
          } catch {
            setPairing(false);
            setPairError(copy.meshPairFail ?? "Gagal memasangkan");
          }
        }}
      />
    </SafeAreaView>
  );
}

type MeshApi = MeshChatApi;

function ConversationList({ copy, mesh, onOpen }: { copy: Copy; mesh: MeshApi; onOpen: (peerId: string | null) => void }) {
  const rows = buildRows(mesh, copy);
  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
      {rows.length === 0 ? (
        <View style={styles.chatEmpty}>
          <MaterialCommunityIcons name="bluetooth-off" size={36} color="#A1A1AA" />
          <Text style={styles.chatEmptyText}>{copy.meshNoPeers}</Text>
        </View>
      ) : rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => { void Haptics.selectionAsync(); onOpen(row.peerId); }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          testID={`mesh-conversation-${row.key}`}
        >
          <View style={[styles.avatar, row.online ? styles.avatarOnline : null]}>
            <MaterialCommunityIcons name={row.peerId === null ? "bullhorn" : row.simulated ? "robot" : "account"} size={22} color={row.online ? "#FFFFFF" : colors.inkSoft} />
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
              {row.encrypted ? <MaterialCommunityIcons name="lock" size={13} color={colors.success} /> : null}
              <Text style={styles.rowTime}>{row.lastAt ? formatTime(row.lastAt, copy) : ""}</Text>
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.rowPreview} numberOfLines={1}>{row.lastMessage || copy.meshSelectChat}</Text>
              {row.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{row.unread}</Text></View> : null}
            </View>
          </View>
          <View style={[styles.onlineDot, row.online && styles.onlineDotOn]} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function buildRows(mesh: MeshApi, copy: Copy) {
  type Row = { key: string; peerId: string | null; name: string; online: boolean; encrypted: boolean; lastMessage: string; lastAt: number; unread: number; simulated?: boolean };
  const rows: Row[] = [];
  const byPeer = new Map<string, MeshConversation>();
  mesh.conversations.forEach((c) => { if (c.peerId) byPeer.set(c.peerId, c); });

  const broadcast = mesh.conversations.find((c) => c.id === BROADCAST_ID);
  if (broadcast) {
    rows.push({ key: BROADCAST_ID, peerId: null, name: copy.meshBroadcastName, online: mesh.peers.length > 0, encrypted: false, lastMessage: broadcast.lastMessage, lastAt: broadcast.lastAt, unread: broadcast.unread });
  }

  mesh.peers.forEach((peer) => {
    const conv = byPeer.get(peer.id);
    rows.push({
      key: peer.id,
      peerId: peer.id,
      name: peer.name,
      online: peer.online,
      encrypted: peer.paired,
      lastMessage: conv?.lastMessage ?? "",
      lastAt: conv?.lastAt ?? 0,
      unread: conv?.unread ?? 0,
      simulated: peer.simulated,
    });
  });

  mesh.conversations.forEach((c) => {
    if (!c.peerId) return;
    if (mesh.peers.some((p) => p.id === c.peerId)) return;
    rows.push({ key: c.id, peerId: c.peerId, name: c.name || c.peerId, online: false, encrypted: c.encrypted, lastMessage: c.lastMessage, lastAt: c.lastAt, unread: c.unread });
  });

  return rows.sort((a, b) => {
    if (a.peerId === null) return -1;
    if (b.peerId === null) return 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return b.lastAt - a.lastAt;
  });
}

function ThreadHeader({ copy, conv, peer, onBack, onPair, onUnpair }: {
  copy: Copy; conv: MeshConversation | null; peer: import("../types").MeshPeer | null;
  onBack: () => void; onPair: () => void; onUnpair: () => void;
}) {
  const isBroadcast = !conv?.peerId;
  return (
    <View style={styles.threadHeader}>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]} testID="mesh-back-button">
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.ink} />
      </Pressable>
      <View style={styles.threadText}>
        <Text style={styles.threadName} numberOfLines={1}>{isBroadcast ? copy.meshBroadcastName : (conv?.name || peer?.name || "ResQ Peer")}</Text>
        <Text style={styles.threadSub}>
          {isBroadcast ? copy.meshBroadcastSubtitle : peer?.online ? copy.meshOnline : copy.meshOffline}
          {!isBroadcast && conv?.encrypted ? ` • ${copy.meshEncrypted}` : ""}
        </Text>
      </View>
      {!isBroadcast ? (
        conv?.encrypted ? (
          <Pressable onPress={onUnpair} style={({ pressed }) => [styles.pairBtn, pressed && styles.pressed]} testID="mesh-unpair-button">
            <MaterialCommunityIcons name="link-variant-off" size={18} color={colors.success} />
          </Pressable>
        ) : (
          <Pressable onPress={onPair} style={({ pressed }) => [styles.pairBtn, pressed && styles.pressed]} testID="mesh-pair-button">
            <MaterialCommunityIcons name="link-variant" size={18} color={colors.info} />
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function Composer({ copy, encrypted, onChange, onSend }: {
  copy: Copy; encrypted: boolean; onChange: () => void; onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={8}>
      <View style={styles.composer}>
        {encrypted ? <MaterialCommunityIcons name="lock" size={16} color={colors.success} style={styles.composerLock} /> : null}
        <TextInput
          value={text}
          onChangeText={(value) => { setText(value); if (value.trim()) onChange(); }}
          placeholder={copy.meshComposerPlaceholder}
          placeholderTextColor="#A1A1AA"
          style={styles.input}
          multiline
          maxLength={500}
          testID="mesh-message-input"
        />
        <Pressable
          onPress={() => { const t = text.trim(); if (!t) return; setText(""); onSend(t); }}
          style={({ pressed }) => [styles.send, pressed && styles.pressed]}
          testID="mesh-send-button"
        >
          <MaterialCommunityIcons name="send" size={21} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function PairSheet({ copy, peerId, peer, pairing, error, code, onCode, onClose, onConfirm }: {
  copy: Copy; peerId: string | null; peer: import("../types").MeshPeer | null;
  pairing: boolean; error: string | null; code: string;
  onCode: (value: string) => void; onClose: () => void; onConfirm: () => void;
}) {
  if (!peerId) return null;
  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.sheetBackdrop} testID="mesh-pair-sheet">
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{copy.meshPairTitle}</Text>
        <Text style={styles.sheetSubtitle}>{peer?.name ?? "ResQ Peer"}</Text>
        <Text style={styles.sheetHint}>{copy.meshPairHint}</Text>
        <TextInput
          value={code}
          onChangeText={onCode}
          placeholder={copy.meshPairCodePlaceholder}
          placeholderTextColor="#A1A1AA"
          autoCapitalize="none"
          style={styles.codeInput}
          maxLength={32}
          testID="mesh-pair-code-input"
        />
        {error ? <Text style={styles.sheetError}>{error}</Text> : null}
        <View style={styles.sheetActions}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]} testID="mesh-pair-cancel">
            <Text style={styles.sheetCancelText}>{copy.meshPairCancel}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={pairing || code.trim().length === 0}
            style={({ pressed }) => [styles.sheetBtn, styles.sheetConfirm, (pairing || !code.trim()) && styles.disabled, pressed && styles.pressed]}
            testID="mesh-pair-confirm"
          >
            {pairing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sheetConfirmText}>{copy.meshPairConfirm}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
    </Modal>
  );
}

function formatTime(ts: number, copy: Copy): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return copy.justNow;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}j`;
  return new Date(ts).toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { minHeight: 80, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface },
  headerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 }, title: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  peerCount: { color: colors.inkSoft, fontSize: 12, fontWeight: "500", marginTop: 3 },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#D4D4D8" }, liveDotActive: { backgroundColor: colors.success },
  setup: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 92 },
  radar: { width: 156, height: 156, borderRadius: 78, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  radarInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  setupTitle: { color: colors.ink, fontSize: 26, lineHeight: 33, fontWeight: "700", textAlign: "center", marginTop: 24 },
  setupBody: { color: colors.inkSoft, fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 10, maxWidth: 330 },
  activate: { minHeight: 56, borderRadius: 28, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 24, marginTop: 24 },
  activateText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" }, pressed: { opacity: 0.78 }, disabled: { opacity: 0.5 },
  list: { flex: 1 }, listContent: { padding: 12, paddingBottom: 120, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: colors.surfaceContainer, borderRadius: radius.medium, ...shadow },
  rowPressed: { opacity: 0.85 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  avatarOnline: { backgroundColor: colors.info },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  rowTime: { color: colors.inkSoft, fontSize: 11 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  rowPreview: { flex: 1, color: colors.inkSoft, fontSize: 13 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#C9C2BF" },
  onlineDotOn: { backgroundColor: colors.success },
  threadHeader: { minHeight: 64, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  threadText: { flex: 1, paddingHorizontal: 4 },
  threadName: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  threadSub: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  pairBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.surfaceContainer },
  messages: { flex: 1 }, messageContent: { padding: 16, paddingBottom: 120, gap: 10 },
  chatEmpty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 30 },
  chatEmptyText: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
  bubble: { maxWidth: "82%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primaryContainer, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceContainer, borderBottomLeftRadius: 4 },
  sender: { color: colors.primary, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  messageText: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  mineText: { color: colors.onPrimaryContainer },
  lock: { position: "absolute", top: 6, right: 6 },
  delivery: { color: colors.inkSoft, fontSize: 9, fontWeight: "600", marginTop: 5 },
  mineDelivery: { color: colors.inkSoft, textAlign: "right" },
  composer: { position: "absolute", left: 12, right: 12, bottom: 92, minHeight: 58, borderRadius: 28, backgroundColor: colors.surfaceContainer, flexDirection: "row", alignItems: "flex-end", padding: 7, gap: 8, ...shadow },
  composerLock: { marginLeft: 8, marginBottom: 18 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: 11, paddingVertical: 11, color: colors.ink, fontSize: 15 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sheetBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(33,26,25,0.35)", justifyContent: "flex-end", zIndex: zIndex.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, alignItems: "center", ...shadow },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  sheetSubtitle: { color: colors.inkSoft, fontSize: 14, marginTop: 2 },
  sheetHint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 12, maxWidth: 320 },
  codeInput: { width: "100%", marginTop: 16, height: 52, borderRadius: 14, backgroundColor: colors.surfaceContainer, paddingHorizontal: 16, color: colors.ink, fontSize: 18, textAlign: "center", letterSpacing: 3 },
  sheetError: { color: colors.brand, fontSize: 13, marginTop: 10 },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 18, width: "100%" },
  sheetBtn: { flex: 1, minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sheetCancel: { backgroundColor: colors.surfaceContainer },
  sheetCancelText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  sheetConfirm: { backgroundColor: colors.primary },
  sheetConfirmText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },
});

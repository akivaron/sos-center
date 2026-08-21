import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../api";
import type { Copy } from "../i18n";
import { colors, radius } from "../theme";
import type { DiscussionChannel, DiscussionPost, Incident, User } from "../types";
import { DISCUSSION_CHANNELS } from "../types";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru";
  if (mins < 60) return `${mins} m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} j`;
  return `${Math.floor(hrs / 24)} h`;
}

function normalizeTopic(topic: string | undefined): DiscussionChannel {
  return (DISCUSSION_CHANNELS as readonly string[]).includes(topic ?? "")
    ? (topic as DiscussionChannel)
    : "umum";
}

const channelLabel = (copy: Copy) => ({
  umum: copy.channelUmum,
  koordinasi: copy.channelKoordinasi,
  info: copy.channelInfo,
  bantuan: copy.channelBantuan,
});

export function IncidentDiscussion({ incidentId, posts, copy, user, onAdded, onRequireAuth }: {
  incidentId: string;
  posts: DiscussionPost[];
  copy: Copy;
  user: User | null;
  onAdded: (updated: Incident) => void;
  onRequireAuth?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeChannel, setActiveChannel] = useState<DiscussionChannel>("umum");

  const sorted = [...posts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const labels = channelLabel(copy);
  const counts = DISCUSSION_CHANNELS.reduce<Record<string, number>>((acc, channel) => {
    acc[channel] = sorted.filter((post) => normalizeTopic(post.topic) === channel).length;
    return acc;
  }, {});
  const visible = sorted.filter((post) => normalizeTopic(post.topic) === activeChannel);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    if (!user) return onRequireAuth?.();
    setBusy(true);
    try {
      const updated = await api.addIncidentComment(incidentId, body, activeChannel);
      onAdded(updated);
      setText("");
    } catch {
      /* keep composer open; post may retry later */
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="incident-discussion">
      <View style={styles.head}>
        <MaterialCommunityIcons name="forum-outline" size={16} color={colors.inkSoft} />
        <Text style={styles.headText}>{copy.discussionTitle}</Text>
        <Text style={styles.count}>{posts.length}</Text>
      </View>

      <Text style={styles.channelsLabel}>{copy.discussionChannels}</Text>
      <View style={styles.channels} testID="discussion-channels">
        {DISCUSSION_CHANNELS.map((channel) => {
          const selected = channel === activeChannel;
          return (
            <Pressable
              key={channel}
              onPress={() => setActiveChannel(channel)}
              style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
              testID={`discussion-channel-${channel}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{labels[channel]}</Text>
              <Text style={[styles.chipCount, selected && styles.chipCountActive]}>{counts[channel]}</Text>
            </Pressable>
          );
        })}
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.empty}>{copy.discussionEmpty}</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>{copy.discussionEmpty}</Text>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item} testID="discussion-post">
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.author_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.bubble}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.author_name}</Text>
                  <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                </View>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
        />
      )}
      {user ? (
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`${copy.discussionPlaceholder} · ${labels[activeChannel]}`}
            placeholderTextColor={colors.outline}
            multiline
            maxLength={500}
            style={styles.input}
            testID="discussion-input"
          />
          <Pressable
            onPress={submit}
            disabled={busy || text.trim().length === 0}
            style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || !text.trim()) && styles.disabled]}
            testID="discussion-send-button"
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />}
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onRequireAuth} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]} testID="discussion-signin-button">
          <MaterialCommunityIcons name="login" size={16} color={colors.primary} />
          <Text style={styles.signInText}>{copy.signInToContribute}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headText: { color: colors.ink, fontSize: 13, fontWeight: "700", flex: 1 },
  count: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", backgroundColor: colors.surfaceContainer, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  channelsLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "700", marginBottom: 6, marginTop: 2 },
  channels: { flexDirection: "row", gap: 6, marginBottom: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 30, borderRadius: 15, paddingHorizontal: 11, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  chipCount: { color: colors.inkSoft, fontSize: 10, fontWeight: "700", backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  chipCountActive: { color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.24)" },
  empty: { color: colors.inkSoft, fontSize: 12, fontStyle: "italic", paddingVertical: 4 },
  list: { gap: 10 },
  item: { flexDirection: "row", gap: 9 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.secondaryContainer, alignItems: "center", justifyContent: "center", marginTop: 1 },
  avatarText: { color: colors.onPrimaryContainer, fontSize: 13, fontWeight: "800" },
  bubble: { flex: 1, backgroundColor: colors.surfaceContainer, borderRadius: radius.large, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  time: { color: colors.outline, fontSize: 10, fontWeight: "600" },
  body: { color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 2 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: radius.large, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, color: colors.ink, fontSize: 14, textAlignVertical: "top" },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  signIn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: radius.large, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, marginTop: 12 },
  signInText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});

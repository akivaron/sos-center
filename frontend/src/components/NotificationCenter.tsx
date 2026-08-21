import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import { useNotifications } from "../context/NotificationContext";
import { notificationIcon } from "./NotificationBell";
import type { AppNotification, NotificationKind } from "../types";

function timeAgo(iso: string, copy: Copy): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return copy.justNow;
  if (mins < 60) return `${mins} ${copy.minutesAgo}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${copy.hoursAgo}`;
  return `${Math.floor(hrs / 24)} h`;
}

const kindLabel = (kind: NotificationKind, copy: Copy): string => {
  switch (kind) {
    case "incident_new":
    case "incident_update":
      return copy.notifTypeIncident;
    case "discussion":
      return copy.notifTypeDiscussion;
    case "verdict":
      return copy.notifTypeVerdict;
    case "sos":
      return copy.notifTypeSos;
    default:
      return copy.notifTypeSystem;
  }
};

type Filter = "all" | NotificationKind;

export function NotificationCenter({ copy, onSelect }: {
  copy: Copy;
  onSelect: (notification: AppNotification) => void;
}) {
  const { notifications, centerOpen, closeCenter, markAllRead, markRead, clear } = useNotifications();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");

  const filters: Filter[] = useMemo(
    () => ["all", "incident_new", "incident_update", "discussion", "verdict", "sos", "system"],
    [],
  );

  const visibleItems = useMemo(
    () => (filter === "all" ? notifications : notifications.filter((item) => item.kind === filter)),
    [filter, notifications],
  );

  const renderItem = (item: AppNotification) => {
    const icon = notificationIcon[item.kind];
    return (
      <Pressable
        key={item.id}
        onPress={() => { markRead(item.id); onSelect(item); }}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        testID={`notification-item-${item.id}`}
      >
        <View style={[styles.itemIcon, { backgroundColor: `${icon.color}1A` }]}>
          <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            {!item.read ? <View style={styles.unreadDot} testID={`notification-unread-${item.id}`} /> : null}
          </View>
          <Text style={styles.itemText} numberOfLines={2}>{item.body}</Text>
          <View style={styles.itemMeta}>
            <View style={[styles.tag, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={styles.tagText}>{kindLabel(item.kind, copy)}</Text>
            </View>
            <Text style={styles.itemTime}>{timeAgo(item.created_at, copy)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={centerOpen} animationType="fade" transparent onRequestClose={closeCenter} testID="notification-center-modal">
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={closeCenter} testID="notification-center-backdrop" />
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.headTitle}>{copy.notificationsTitle}</Text>
            <View style={styles.headActions}>
              <Pressable onPress={markAllRead} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]} testID="notification-mark-all-button">
                <Text style={styles.textButtonLabel}>{copy.notificationsMarkAllRead}</Text>
              </Pressable>
              <Pressable onPress={clear} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]} testID="notification-clear-button">
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.inkSoft} />
              </Pressable>
              <Pressable onPress={closeCenter} style={({ pressed }) => [styles.close, pressed && styles.pressed]} testID="notification-close-button">
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterRow} testID="notification-filters">
            {filters.map((item) => {
              const selected = item === filter;
              const label = item === "all" ? copy.allIncidents : kindLabel(item, copy);
              return (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={({ pressed }) => [styles.filterChip, selected && styles.filterChipActive, pressed && styles.pressed]}
                  testID={`notification-filter-${item}`}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {visibleItems.length === 0 ? (
              <View style={styles.empty} testID="notification-empty-state">
                <MaterialCommunityIcons name="bell-off-outline" size={34} color={colors.outline} />
                <Text style={styles.emptyText}>{copy.notificationsEmpty}</Text>
              </View>
            ) : (
              visibleItems.map(renderItem)
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(33,26,25,0.42)", justifyContent: "flex-end", zIndex: zIndex.overlay },
  backdropPress: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, maxHeight: "82%", paddingTop: 10, paddingHorizontal: 16, ...shadow },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: 12 },
  headTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: colors.ink },
  headActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  textButton: { paddingHorizontal: 4, paddingVertical: 4 },
  textButtonLabel: { fontSize: 12, fontWeight: "700", color: colors.info },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  filters: { maxHeight: 40, marginBottom: 8 },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  filterTextActive: { color: "#FFFFFF" },
  list: { maxHeight: 480 },
  listContent: { gap: 10, paddingBottom: 8 },
  item: { flexDirection: "row", gap: 12, backgroundColor: colors.surfaceSoft, borderRadius: radius.large, padding: 12, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1, minWidth: 0 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  itemText: { fontSize: 13, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: "700", color: colors.inkSoft },
  itemTime: { fontSize: 11, fontWeight: "600", color: colors.outline },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 13, color: colors.inkSoft, fontStyle: "italic" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});

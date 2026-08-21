import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Copy } from "../i18n";
import type { Coordinates, FamilyCircle, User } from "../types";
import { colors, radius, shadow, zIndex } from "../theme";

type NetworkState = "online" | "weak" | "offline";

function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function formatAgo(iso: string, copy: Copy): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return copy.justNow;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return `${minutes} ${copy.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${copy.hoursAgo}`;
}

function MemberRow({ member, copy, isSelf, coordinates, onRemove }: {
  member: FamilyCircle["members"][number];
  copy: Copy;
  isSelf: boolean;
  coordinates: Coordinates | null;
  onRemove: () => void;
}) {
  const loc = member.location;
  const distance = loc && coordinates
    ? haversineMeters(coordinates, { latitude: loc.latitude, longitude: loc.longitude })
    : null;
  return (
    <View style={styles.memberRow} testID={`family-member-${member.user_id}-row`}>
      <View style={styles.memberAvatar}>
        <MaterialCommunityIcons name="account" size={22} color={isSelf ? colors.onPrimaryContainer : colors.primary} />
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
          {isSelf ? <View style={styles.youBadge}><Text style={styles.badgeText}>{copy.youBadge}</Text></View> : null}
          {member.role === "owner" ? <View style={styles.ownerBadge}><Text style={styles.badgeText}>{copy.ownerBadge}</Text></View> : null}
        </View>
        <Text style={styles.memberMeta}>
          {loc ? (
            <>
              <Text style={[styles.sourceChip, loc.source === "mesh" ? styles.sourceMesh : styles.sourceGps]}>
                {loc.source === "mesh" ? copy.sourceMesh : copy.sourceGps}
              </Text>
              {"  "}{copy.lastSeen} {formatAgo(loc.updated_at, copy)}
              {distance !== null ? `  •  ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`}` : ""}
            </>
          ) : copy.memberNoLocation}
        </Text>
      </View>
      {!isSelf ? (
        <Pressable onPress={onRemove} hitSlop={10} style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]} testID={`family-remove-${member.user_id}-button`}>
          <MaterialCommunityIcons name="account-remove-outline" size={20} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FamilyCircleScreen({ copy, user, network, coordinates, circles, error, onCreate, onJoin, onRemove, onClose, onOpenMesh }: {
  copy: Copy;
  user: User | null;
  network: NetworkState;
  coordinates: Coordinates | null;
  circles: FamilyCircle[];
  error: string | null;
  onCreate: (name?: string) => Promise<FamilyCircle>;
  onJoin: (code: string) => Promise<FamilyCircle>;
  onRemove: (circleId: string, userId: string) => Promise<{ ok: boolean; deleted: boolean }>;
  onClose: () => void;
  onOpenMesh: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [toast, setToast] = useState<string | null>(error);
  const [busy, setBusy] = useState(false);

  const flash = (message: string | null) => setToast(message);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim() || undefined);
      setName("");
      flash(null);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const value = code.trim().toUpperCase();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onJoin(value);
      setCode("");
      flash(null);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (circle: FamilyCircle, memberUserId: string) => {
    try {
      await onRemove(circle.id, memberUserId);
      flash(null);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    }
  };

  const sharing = circles.length > 0 && !!coordinates;

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay} testID="family-circle-screen">
      <Pressable style={styles.backdrop} onPress={onClose} testID="family-backdrop" />
      <View style={[styles.sheet, { paddingTop: insets.top + 4 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]} testID="family-close-button">
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{copy.familyCircle}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{copy.familySubtitle}</Text>

        {sharing ? (
          <View style={styles.shareBanner}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={colors.success} />
            <Text style={styles.shareText}>{copy.locationSharingOn}</Text>
          </View>
        ) : null}

        {circles.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><MaterialCommunityIcons name="account-group-outline" size={40} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{copy.familyEmptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.familyEmptyBody}</Text>
          </View>
        ) : (
          circles.map((circle) => {
            const isOwner = circle.owner_id === user?.user_id;
            return (
              <View key={circle.id} style={styles.circleCard} testID={`family-circle-${circle.id}-card`}>
                <View style={styles.circleHead}>
                  <View style={styles.circleIcon}><MaterialCommunityIcons name="account-group" size={22} color="#FFFFFF" /></View>
                  <View style={styles.circleTitleWrap}>
                    <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
                    <Text style={styles.circleSub}>{circle.members.length} {copy.members}</Text>
                  </View>
                </View>
                {isOwner && circle.invite_code ? (
                  <View style={styles.codeBox}>
                    <View style={styles.codeTextWrap}>
                      <Text style={styles.codeLabel}>{copy.inviteCodeLabel}</Text>
                      <Text style={styles.codeValue} selectable testID={`family-invite-code-${circle.id}`}>{circle.invite_code}</Text>
                    </View>
                  </View>
                ) : null}
                <Text style={styles.membersLabel}>{copy.members}</Text>
                {circle.members.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    copy={copy}
                    isSelf={member.user_id === user?.user_id}
                    coordinates={coordinates}
                    onRemove={() => void handleRemove(circle, member.user_id)}
                  />
                ))}
                {!isOwner ? (
                  <Pressable onPress={() => void handleRemove(circle, user?.user_id ?? "")} style={({ pressed }) => [styles.leaveBtn, pressed && styles.pressed]} testID={`family-leave-${circle.id}-button`}>
                    <MaterialCommunityIcons name="logout" size={18} color={colors.brand} />
                    <Text style={styles.leaveText}>{copy.leaveCircle}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        {!user ? (
          <View style={styles.signInCard}><Text style={styles.signInText}>{copy.signInNeeded}</Text></View>
        ) : (
          <View style={styles.createCard}>
            <Text style={styles.createTitle}>{copy.createCircle}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={copy.circleNamePlaceholder}
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
                testID="family-name-input"
              />
              <Pressable onPress={() => void handleCreate()} disabled={busy} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} testID="family-create-button">
                <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{copy.createCircle}</Text>
              </Pressable>
            </View>
            <View style={styles.divider} />
            <Text style={styles.createTitle}>{copy.joinWithCode}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={copy.inviteCodePlaceholder}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="characters"
                style={[styles.input, styles.codeInput]}
                testID="family-code-input"
              />
              <Pressable onPress={() => void handleJoin()} disabled={busy || !code.trim()} style={({ pressed }) => [styles.primaryBtn, (!code.trim()) && styles.disabledBtn, pressed && styles.pressed]} testID="family-join-button">
                <MaterialCommunityIcons name="login" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{copy.joinWithCode}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {network === "offline" && circles.length > 0 ? (
          <Pressable onPress={onOpenMesh} style={({ pressed }) => [styles.meshHint, pressed && styles.pressed]} testID="family-mesh-hint-button">
            <MaterialCommunityIcons name="bluetooth-connect" size={20} color={colors.info} />
            <Text style={styles.meshHintText}>{copy.meshShareHint}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {toast ? (
        <View style={[styles.toast, { bottom: 24 }]} pointerEvents="none" testID="family-toast">
          <Text style={styles.toastText} numberOfLines={2}>{toast}</Text>
        </View>
      ) : null}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  sheet: { position: "relative", flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  header: { minHeight: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface },
  closeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 140 },
  subtitle: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: 16 },
  pressed: { opacity: 0.7 },
  shareBanner: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#DCFCE7", borderRadius: radius.large, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },
  shareText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  emptyCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 24, alignItems: "center", marginBottom: 16 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  circleCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 16, marginBottom: 16, ...shadow },
  circleHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  circleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  circleTitleWrap: { flex: 1 },
  circleName: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  circleSub: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  codeBox: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeTextWrap: { flex: 1 },
  codeLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  codeValue: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: 2, marginTop: 2 },
  membersLabel: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  memberBody: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  youBadge: { backgroundColor: colors.secondaryContainer, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  ownerBadge: { backgroundColor: colors.primaryContainer, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: colors.onPrimaryContainer, fontSize: 10, fontWeight: "700" },
  memberMeta: { color: colors.inkSoft, fontSize: 12, marginTop: 3, flexWrap: "wrap" },
  sourceChip: { fontWeight: "800" },
  sourceGps: { color: colors.success },
  sourceMesh: { color: colors.info },
  removeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  leaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  leaveText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  createCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 16, marginBottom: 16 },
  createTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, color: colors.ink, fontSize: 15, ...shadow },
  codeInput: { letterSpacing: 2, fontWeight: "700", textTransform: "uppercase" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, borderRadius: 24, backgroundColor: colors.primary, paddingHorizontal: 16, ...shadow },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  disabledBtn: { opacity: 0.5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  signInCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 18, alignItems: "center" },
  signInText: { color: colors.inkSoft, fontSize: 14, fontWeight: "600", textAlign: "center" },
  meshHint: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#DBEAFE", borderRadius: radius.large, paddingHorizontal: 14, paddingVertical: 12 },
  meshHintText: { flex: 1, color: colors.info, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  toast: { position: "absolute", left: 20, right: 20, backgroundColor: colors.dark, borderRadius: radius.medium, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../api";
import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import type { Incident, User } from "../types";
import { CommunityReports } from "./CommunityReports";
import { IncidentDiscussion } from "./IncidentDiscussion";
import { IncidentPhotos } from "./IncidentPhotos";
import { ReportSheet } from "./ReportSheet";
import { VerdictBadge } from "./VerdictBadge";

const typeColor = { fire: "#BA1A1A", flood: "#00639B", earthquake: "#6750A4", crash: "#8A5100", other: "#5D5D66" } as const;
const typeIcon = { fire: "fire", flood: "waves", earthquake: "pulse", crash: "car-emergency", other: "alert-circle-outline" } as const;

export function IncidentInfoCard({ incident, user, copy, onClose, onReported, onUpdated, onDirect, onRequireAuth }: {
  incident: Incident;
  user: User | null;
  copy: Copy;
  onClose: () => void;
  onReported?: (updated: Incident) => void;
  onUpdated?: (updated: Incident) => void;
  onDirect?: (incident: Incident) => void;
  onRequireAuth?: () => void;
}) {
  const [data, setData] = useState<Incident>(incident);
  const [reporting, setReporting] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => setData(incident), [incident]);

  useEffect(() => {
    setFollowing(incident.following ?? false);
    setFollowerCount(incident.follower_count ?? 0);
  }, [incident.following, incident.follower_count]);

  useEffect(() => {
    if (!user) {
      setFollowing(false);
      setFollowerCount(0);
      return;
    }
    let active = true;
    void api.incidentFollowStatus(data.id).then((status) => {
      if (active) {
        setFollowing(status.following);
        setFollowerCount(status.follower_count);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user, data.id]);

  const toggleFollow = async () => {
    if (!user) return onRequireAuth?.();
    setFollowBusy(true);
    try {
      const status = following
        ? await api.unfollowIncident(data.id)
        : await api.followIncident(data.id);
      setFollowing(status.following);
      setFollowerCount(status.follower_count);
    } catch {
      /* keep current state; the request may retry */
    } finally {
      setFollowBusy(false);
    }
  };

  const photo = api.mediaUrl(data.photo_url);
  const accent = typeColor[data.incident_type];

  const applyUpdate = (updated: Incident) => {
    setData(updated);
    onUpdated?.(updated);
  };

  const submitReport = async (input: { kind: "scam" | "real"; reason: string; note: string }) => {
    setReporting(true);
    try {
      const updated = await api.reportIncident(data.id, input);
      applyUpdate(updated);
      onReported?.(updated);
    } catch {
      /* keep card open; report may retry later */
    } finally {
      setReporting(false);
    }
  };

  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.overlay} testID="incident-detail-card">
      <Pressable style={styles.backdrop} onPress={onClose} testID="incident-detail-backdrop" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.topRow}>
        <View style={[styles.icon, { backgroundColor: accent }]}><MaterialCommunityIcons name={typeIcon[data.incident_type]} size={23} color="#FFFFFF" /></View>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{copy[data.incident_type]}</Text>
          <Text style={styles.reporter}>{copy.reportedBy} {data.reporter_name} • {new Date(data.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <View style={[styles.severity, { backgroundColor: `${accent}18` }]}><Text style={[styles.severityText, { color: accent }]}>{copy[data.severity]}</Text></View>
        <View style={styles.followGroup}>
          <Pressable
            onPress={toggleFollow}
            disabled={followBusy}
            accessibilityLabel={following ? copy.following : copy.followUpdate}
            style={({ pressed }) => [styles.followButton, pressed && styles.pressed, following && styles.followButtonActive]}
            testID="incident-follow-button"
          >
            <MaterialCommunityIcons name={following ? "bell" : "bell-outline"} size={22} color={following ? colors.brand : colors.ink} />
          </Pressable>
          {followerCount > 0 ? <Text style={styles.followCount}>{followerCount}</Text> : null}
        </View>
        <Pressable onPress={onClose} style={styles.close} testID="incident-detail-close-button"><MaterialCommunityIcons name="close" size={22} color={colors.ink} /></Pressable>
      </View>

      <View style={styles.verdictRow}>
        <VerdictBadge verdict={data.verdict} copy={copy} />
        <Pressable
          onPress={() => setSheet(true)}
          disabled={reporting}
          style={({ pressed }) => [styles.reportButton, pressed && styles.pressed, reporting && styles.disabled]}
          testID="incident-report-button"
        >
          {reporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="flag-variant" size={16} color="#FFFFFF" />}
          <Text style={styles.reportButtonText}>{copy.reportAction}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={220} testID="incident-evidence-photo" />
            <View style={styles.photoLabel}><MaterialCommunityIcons name="image-check-outline" size={14} color="#FFFFFF" /><Text style={styles.photoLabelText}>{copy.evidencePhoto}</Text></View>
          </View>
        ) : (
          <View style={styles.photoEmpty}><MaterialCommunityIcons name="image-off-outline" size={26} color={colors.outline} /><Text style={styles.photoEmptyText}>{copy.evidencePhoto}</Text></View>
        )}
        <Text style={styles.description}>{data.description}</Text>
        <Pressable
          onPress={() => onDirect?.(data)}
          disabled={!onDirect}
          style={({ pressed }) => [styles.directButton, pressed && styles.pressed, !onDirect && styles.disabled]}
          testID="incident-direct-button"
        >
          <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
          <Text style={styles.directButtonText}>{copy.directToIncident}</Text>
          <MaterialCommunityIcons name="map-marker-distance" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={styles.stats}>
          <View style={styles.stat}><MaterialCommunityIcons name="account-injury-outline" size={19} color={colors.primary} /><Text style={styles.statText}>{data.casualty_count} {copy.victims}</Text></View>
          <View style={styles.stat}><MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.info} /><Text style={styles.statText}>{data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}</Text></View>
        </View>
        {data.assistance_needed ? (
          <View style={styles.help}><MaterialCommunityIcons name="hand-heart-outline" size={21} color={colors.primary} /><View style={styles.helpText}><Text style={styles.helpLabel}>{copy.needs}</Text><Text style={styles.helpBody}>{data.assistance_needed}</Text></View></View>
        ) : null}
        <IncidentPhotos
          incidentId={data.id}
          photos={data.contributor_photos ?? []}
          copy={copy}
          user={user}
          onAdded={applyUpdate}
          onRequireAuth={onRequireAuth}
        />
        <View style={styles.divider} />
        <CommunityReports reports={data.community_reports ?? []} copy={copy} />
        <IncidentDiscussion
          incidentId={data.id}
          posts={data.discussion ?? []}
          copy={copy}
          user={user}
          onAdded={applyUpdate}
          onRequireAuth={onRequireAuth}
        />
      </ScrollView>

      <ReportSheet
        visible={sheet}
        title={copy.reportSheetTitle}
        copy={copy}
        onClose={() => setSheet(false)}
        onSubmit={submitReport}
      />
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.36)" },
  sheet: { maxHeight: "90%", backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, overflow: "hidden", ...shadow },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  topRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 8, paddingVertical: 10 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  titleGroup: { flex: 1 }, title: { color: colors.ink, fontSize: 18, fontWeight: "700" }, reporter: { color: colors.inkSoft, fontSize: 10, lineHeight: 15, marginTop: 2 },
  severity: { height: 30, borderRadius: 8, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, severityText: { fontSize: 11, fontWeight: "700" },
  followGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  followButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft },
  followButtonActive: { borderColor: colors.brand, backgroundColor: `${colors.brand}12` },
  followCount: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", minWidth: 16, textAlign: "center" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  verdictRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border },
  reportButton: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, borderRadius: 15, backgroundColor: colors.primary, paddingHorizontal: 12 },
  reportButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingBottom: 18 },
  photoWrap: { height: 128, borderRadius: radius.large, overflow: "hidden", backgroundColor: colors.surfaceContainer }, photo: { width: "100%", height: "100%" },
  photoLabel: { position: "absolute", left: 8, bottom: 8, height: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: "rgba(33,26,25,0.78)", flexDirection: "row", alignItems: "center", gap: 5 }, photoLabelText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  photoEmpty: { height: 74, borderRadius: radius.large, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center", gap: 5 }, photoEmptyText: { color: colors.inkSoft, fontSize: 11 },
  description: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 13 },
  directButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: radius.large, backgroundColor: colors.info, marginTop: 12, ...shadow },
  directButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, stat: { minHeight: 38, borderRadius: 10, backgroundColor: colors.surfaceContainer, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 }, statText: { color: colors.inkSoft, fontSize: 11, fontWeight: "600" },
  help: { minHeight: 58, borderRadius: radius.large, backgroundColor: colors.primaryContainer, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginTop: 10 }, helpText: { flex: 1 }, helpLabel: { color: colors.onPrimaryContainer, fontSize: 10, fontWeight: "700" }, helpBody: { color: colors.onPrimaryContainer, fontSize: 13, lineHeight: 18, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 16 },
  pressed: { opacity: 0.82 },
});

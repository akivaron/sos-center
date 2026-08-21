import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import type { Copy } from "../i18n";
import { ReportFormModal } from "../components/ReportFormModal";
import { VerdictBadge } from "../components/VerdictBadge";
import { colors, radius, shadow, zIndex } from "../theme";
import type { Coordinates, Incident, IncidentType, ReportDraft, StoredDraft, User } from "../types";
import {
  draftFromIncident,
  loadDrafts,
  newLocalId,
  removeDraft,
  saveDraft,
} from "../services/reportDrafts";

const filters: ("all" | IncidentType)[] = ["all", "fire", "flood", "earthquake", "crash"];
const icon = { fire: "fire", flood: "waves", earthquake: "pulse", crash: "car-emergency", other: "alert-circle" } as const;
const accent = { fire: "#DC2626", flood: "#2563EB", earthquake: "#7C3AED", crash: "#F59E0B", other: "#52525B" } as const;

type Scope = "all" | "mine";
type EditingState = {
  mode: "create" | "edit" | "draft";
  incident?: Incident;
  incidentId?: string;
  localId?: string;
  draft: ReportDraft;
} | null;

export function ReportsScreen({ copy, user, incidents, coordinates, onIncidentsChange, onToast }: {
  copy: Copy;
  user: User | null;
  incidents: Incident[];
  coordinates: Coordinates | null;
  onIncidentsChange: (incidents: Incident[]) => void;
  onToast: (message: string) => void;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [filter, setFilter] = useState<"all" | IncidentType>("all");
  const [drafts, setDrafts] = useState<StoredDraft[]>([]);
  const [editing, setEditing] = useState<EditingState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);

  useEffect(() => {
    if (scope === "mine") void loadDrafts().then(setDrafts);
  }, [scope]);

  const myIncidents = useMemo(
    () => (user ? incidents.filter((item) => item.reporter_id === user.user_id) : []),
    [incidents, user],
  );

  const visible = useMemo(
    () => filter === "all" ? incidents : incidents.filter((item) => item.incident_type === filter),
    [filter, incidents],
  );

  const openNewDraft = () => {
    if (!user) return onToast(copy.signInNeeded);
    setEditing({ mode: "create", draft: { incidentType: "fire", severity: "high", description: "", casualtyCount: 0, assistanceNeeded: "", photo: null } });
  };

  const openEdit = (incident: Incident) => {
    setEditing({ mode: "edit", incident, incidentId: incident.id, draft: draftFromIncident(incident) });
  };

  const openDraft = (stored: StoredDraft) => {
    setEditing({ mode: "draft", incidentId: stored.incidentId, localId: stored.localId, draft: stored.draft });
  };

  const closeModel = () => setEditing(null);

  const handleSubmit = async (draft: ReportDraft) => {
    if (!user) return;
    setSubmitting(true);
    try {
      let photo_file_id: string | null = editing?.incident?.photo_file_id ?? null;
      if (draft.photo) {
        const upload = await api.uploadIncidentPhoto(draft.photo);
        photo_file_id = upload.file_id;
      }
      const payload = {
        incident_type: draft.incidentType,
        severity: draft.severity,
        description: draft.description,
        casualty_count: draft.casualtyCount,
        assistance_needed: draft.assistanceNeeded,
        photo_file_id,
      };
      if (editing && (editing.mode === "edit" || editing.incidentId)) {
        const id = editing.incidentId ?? editing.incident?.id;
        if (!id) return;
        const updated = await api.updateIncident(id, payload);
        onIncidentsChange(incidents.map((item) => (item.id === id ? updated : item)));
      } else {
        if (!coordinates) { onToast(copy.locationNeeded); return; }
        const created = await api.createIncident({ ...payload, photo_file_id: photo_file_id ?? undefined, ...coordinates });
        onIncidentsChange([created, ...incidents]);
      }
      if (editing?.localId) setDrafts(await removeDraft(editing.localId));
      onToast(editing && (editing.mode === "edit" || editing.incidentId) ? copy.savedChanges : copy.reportPublished);
      closeModel();
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (draft: ReportDraft) => {
    const localId = editing?.localId ?? newLocalId();
    const stored: StoredDraft = {
      localId,
      incidentId: editing?.incidentId ?? editing?.incident?.id,
      draft,
      created_at: new Date().toISOString(),
    };
    setDrafts(await saveDraft(stored));
    onToast(copy.draftSaved);
    closeModel();
  };

  const deleteDraftLocal = async (localId: string) => {
    setDrafts(await removeDraft(localId));
    onToast(copy.draftDeleted);
  };

  const keepAsDraft = async (incident: Incident) => {
    setDeleteTarget(null);
    const stored: StoredDraft = {
      localId: newLocalId(),
      incidentId: incident.id,
      draft: draftFromIncident(incident),
      created_at: new Date().toISOString(),
    };
    setDrafts(await saveDraft(stored));
    onToast(copy.draftSaved);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deleteIncident(target.id);
      onIncidentsChange(incidents.filter((item) => item.id !== target.id));
      setDrafts((current) => current.filter((d) => d.incidentId !== target.id));
      onToast(copy.reportDeleted);
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : copy.retry);
    }
  };

  const locationLabel = coordinates
    ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
    : copy.reportSubtitle;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]} testID="reports-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RESQ • LIVE</Text>
        <Text style={styles.title}>{copy.recentReports}</Text>
        <Text style={styles.count}>{incidents.length} {copy.reports.toLowerCase()}</Text>
      </View>
      <View style={styles.scopeChrome}>
        <Pressable onPress={() => setScope("all")} style={styles.scopeTarget} testID="reports-scope-all-button">
          <Text style={[styles.scopeLabel, scope === "all" && styles.scopeLabelActive]}>{copy.allReports}</Text>
        </Pressable>
        <Pressable onPress={() => setScope("mine")} style={styles.scopeTarget} testID="reports-scope-mine-button">
          <Text style={[styles.scopeLabel, scope === "mine" && styles.scopeLabelActive]}>{copy.myReports}</Text>
          {user ? <View style={styles.scopeBadge}><Text style={styles.scopeBadgeText}>{myIncidents.length}</Text></View> : null}
        </Pressable>
      </View>

      {scope === "mine" ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {user ? (
            <Pressable onPress={openNewDraft} style={({ pressed }) => [styles.newDraft, pressed && styles.pressed]} testID="new-draft-button">
              <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
              <Text style={styles.newDraftText}>{copy.newDraft}</Text>
            </Pressable>
          ) : (
            <View style={styles.signInNote}><Text style={styles.signInNoteText}>{copy.signInNeeded}</Text></View>
          )}

          {drafts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{copy.draftTitle}</Text>
              {drafts.map((item) => (
                <View key={item.localId} style={styles.draftCard} testID={`draft-card-${item.localId}`}>
                  <View style={styles.draftBody}>
                    <Text style={styles.draftType}>{copy[item.draft.incidentType]}</Text>
                    <Text style={styles.draftDesc} numberOfLines={2}>{item.draft.description || copy.nearbyAlert}</Text>
                    <Text style={styles.draftMeta}>{new Date(item.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => openDraft(item)} style={styles.actionButton} testID={`draft-edit-${item.localId}-button`}>
                      <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
                      <Text style={styles.actionText}>{copy.editReport}</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteDraftLocal(item.localId)} style={[styles.actionButton, styles.actionDanger]} testID={`draft-delete-${item.localId}-button`}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color={colors.brand} />
                      <Text style={[styles.actionText, styles.actionDangerText]}>{copy.deleteReport}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.myIncidentsTitle}</Text>
            {myIncidents.length === 0 ? (
              <View style={styles.emptyInline} testID="my-reports-empty-state">
                <Text style={styles.emptyInlineText}>{copy.noMyReports}</Text>
              </View>
            ) : myIncidents.map((item) => (
              <View key={item.id} style={styles.card} testID={`my-report-card-${item.id}`}>
                <View style={[styles.cardIcon, { backgroundColor: `${accent[item.incident_type]}18` }]}>
                  <MaterialCommunityIcons name={icon[item.incident_type]} size={25} color={accent[item.incident_type]} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{copy[item.incident_type]}</Text>
                    <View style={[styles.severity, { backgroundColor: `${accent[item.incident_type]}14` }]}><Text style={[styles.severityText, { color: accent[item.incident_type] }]}>{item.severity.toUpperCase()}</Text></View>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>{item.description || copy.nearbyAlert}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEdit(item)} style={styles.iconAction} hitSlop={8} testID={`edit-report-${item.id}-button`}>
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => setDeleteTarget(item)} style={[styles.iconAction, styles.iconActionDanger]} hitSlop={8} testID={`delete-report-${item.id}-button`}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={colors.brand} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.filterChrome}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {filters.map((item) => {
                const selected = item === filter;
                const label = item === "all" ? copy.reports : copy[item];
                return (
                  <Pressable
                    key={item}
                    onPress={() => setFilter(item)}
                    style={styles.chipTarget}
                    testID={`reports-filter-${item}-button`}
                  >
                    <Text style={[styles.chip, selected && styles.chipSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {visible.length === 0 ? (
              <View style={styles.empty} testID="reports-empty-state">
                <View style={styles.emptyIcon}><MaterialCommunityIcons name="shield-check-outline" size={36} color={colors.success} /></View>
                <Text style={styles.emptyTitle}>{copy.safeZone}</Text>
                <Text style={styles.emptyBody}>{copy.noReports}</Text>
              </View>
            ) : visible.map((item) => (
              <View key={item.id} style={styles.card} testID={`report-card-${item.id}`}>
                <View style={[styles.cardIcon, { backgroundColor: `${accent[item.incident_type]}18` }]}>
                  <MaterialCommunityIcons name={icon[item.incident_type]} size={25} color={accent[item.incident_type]} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{copy[item.incident_type]}</Text>
                    <View style={[styles.severity, { backgroundColor: `${accent[item.incident_type]}14` }]}><Text style={[styles.severityText, { color: accent[item.incident_type] }]}>{item.severity.toUpperCase()}</Text></View>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>{item.description || copy.nearbyAlert}</Text>
                  {item.assistance_needed ? <Text style={styles.assistance} numberOfLines={1}>{item.assistance_needed}</Text> : null}
                  <View style={styles.metaRow}>
                    {item.casualty_count > 0 ? <Text style={styles.metaPill}><MaterialCommunityIcons name="account-injury-outline" size={11} /> {item.casualty_count}</Text> : null}
                    {item.photo_file_id ? <Text style={styles.metaPill}><MaterialCommunityIcons name="image-outline" size={11} /> Foto</Text> : null}
                  </View>
                  <Text style={styles.meta}>{item.reporter_name} • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                  {item.verdict ? <View style={styles.verdictRow}><VerdictBadge verdict={item.verdict} copy={copy} /></View> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <ReportFormModal
        visible={editing !== null}
        copy={copy}
        loading={submitting}
        mode={editing?.mode === "edit" ? "edit" : "create"}
        initialDraft={editing?.draft ?? null}
        locationLabel={locationLabel}
        onClose={closeModel}
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
      />

      {deleteTarget ? (
        <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.confirmOverlay} testID="delete-confirm-dialog">
          <Pressable style={styles.confirmBackdrop} onPress={() => setDeleteTarget(null)} testID="delete-confirm-backdrop" />
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{copy.deleteConfirmTitle}</Text>
            <Text style={styles.confirmBody}>{copy.deleteConfirmBody}</Text>
              <Pressable onPress={() => keepAsDraft(deleteTarget)} style={styles.confirmDraft} testID="delete-keep-draft-button">
              <Text style={styles.confirmDraftText}>{copy.keepDraft}</Text>
            </Pressable>
            <View style={styles.confirmRow}>
              <Pressable onPress={() => setDeleteTarget(null)} style={[styles.confirmButton, styles.confirmCancel]} testID="delete-cancel-button">
                <Text style={styles.confirmCancelText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={[styles.confirmButton, styles.confirmDelete]} testID="delete-confirm-button">
                <Text style={styles.confirmDeleteText}>{copy.confirmDelete}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, backgroundColor: colors.surface },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: "700", marginTop: 3 },
  count: { color: colors.inkSoft, fontSize: 13, fontWeight: "500", marginTop: 4 },
  scopeChrome: { height: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  scopeTarget: { height: 40, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfaceContainer },
  scopeLabel: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  scopeLabelActive: { color: colors.onPrimaryContainer },
  scopeBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  scopeBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
  filterChrome: { height: 56, backgroundColor: colors.surface },
  filterRow: { alignItems: "center", gap: 8, paddingHorizontal: 20 },
  chipTarget: { height: 44, flexShrink: 0, justifyContent: "center" },
  chip: { height: 36, lineHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 16, color: colors.inkSoft, fontSize: 13, fontWeight: "600", overflow: "hidden" },
  chipSelected: { color: colors.onPrimaryContainer, backgroundColor: colors.secondaryContainer, borderColor: colors.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 128, gap: 12 },
  section: { marginTop: 8 },
  sectionTitle: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10, marginTop: 6 },
  newDraft: { height: 48, borderRadius: 14, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  newDraftText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },
  signInNote: { borderRadius: 14, backgroundColor: colors.surfaceContainer, padding: 16 },
  signInNoteText: { color: colors.inkSoft, fontSize: 13, fontWeight: "600", textAlign: "center" },
  draftCard: { borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 14, gap: 10 },
  draftBody: { gap: 3 },
  draftType: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  draftDesc: { color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  draftMeta: { color: colors.outline, fontSize: 11, fontWeight: "600", marginTop: 3 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  actionText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  actionDanger: { borderColor: colors.brand },
  actionDangerText: { color: colors.brand },
  card: { minHeight: 112, borderRadius: 16, backgroundColor: colors.surfaceContainer, padding: 16, flexDirection: "row", gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  severity: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  severityText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  description: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 7 },
  assistance: { color: colors.primary, fontSize: 12, fontWeight: "600", marginTop: 5 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  metaPill: { color: colors.inkSoft, fontSize: 10, fontWeight: "600", backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  meta: { color: colors.outline, fontSize: 11, fontWeight: "600", marginTop: 7 },
  verdictRow: { marginTop: 8, alignItems: "flex-start" },
  cardActions: { justifyContent: "center", gap: 10 },
  iconAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  iconActionDanger: { borderColor: colors.border },
  empty: { alignItems: "center", paddingTop: 72, paddingHorizontal: 28 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 18, textAlign: "center" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: "center" },
  emptyInline: { paddingVertical: 24, alignItems: "center" },
  emptyInlineText: { color: colors.inkSoft, fontSize: 14, fontWeight: "600", textAlign: "center" },
  confirmOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: zIndex.overlay, justifyContent: "flex-end" },
  confirmBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,26,25,0.42)" },
  confirmSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.extraLarge, borderTopRightRadius: radius.extraLarge, padding: 22, paddingBottom: 28, ...shadow },
  confirmTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  confirmBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 8 },
  confirmDraft: { marginTop: 16, height: 48, borderRadius: 24, backgroundColor: colors.secondaryContainer, alignItems: "center", justifyContent: "center" },
  confirmDraftText: { color: colors.onPrimaryContainer, fontSize: 15, fontWeight: "700" },
  confirmRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  confirmButton: { flex: 1, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  confirmCancel: { backgroundColor: colors.surfaceContainer },
  confirmCancelText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  confirmDelete: { backgroundColor: colors.brand },
  confirmDeleteText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.82 },
});

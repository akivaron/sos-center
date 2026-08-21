import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api";
import { IncidentAutocomplete, OsmAreaAutocomplete, type OsmPlace } from "../components/OsmAutocomplete";
import { ReportSheet } from "../components/ReportSheet";
import type { Copy } from "../i18n";
import type { Coordinates, DonationCampaign, DonationPledge, DonationTagKind, Incident, LocalPhoto, User, Verdict } from "../types";
import { colors, radius, shadow, zIndex } from "../theme";

function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function formatAgo(iso: string, copy: Copy): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return copy.justNow;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return `${minutes} ${copy.minutesAgo}`;
  return `${Math.floor(minutes / 60)} ${copy.hoursAgo}`;
}

function CampaignProgress({ campaign, copy }: { campaign: DonationCampaign; copy: Copy }) {
  const progress = Math.min(100, Math.round((campaign.collected_amount / Math.max(1, campaign.target_amount)) * 100));
  return (
    <>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {formatRupiah(campaign.collected_amount)} {copy.ofTarget} {formatRupiah(campaign.target_amount)} ({progress}%)
      </Text>
    </>
  );
}

function CampaignCard({ campaign, copy, onPress }: {
  campaign: DonationCampaign;
  copy: Copy;
  onPress: () => void;
}) {
  const tagLabel = campaign.tag_kind === "incident" ? copy.campaignTaggedIncident : copy.campaignTaggedArea;
  const tagName = campaign.tag_kind === "incident"
    ? (campaign.incident_type ?? campaign.incident_id ?? "")
    : (campaign.area_name ?? "");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`donation-campaign-${campaign.id}-card`}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name="hand-heart" size={22} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{campaign.title}</Text>
          <Text style={styles.cardSub}>
            {tagLabel}{tagName ? ` • ${tagName}` : ""} • {copy.donorsCount.replace("{count}", String(campaign.pledges.length))}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkSoft} />
      </View>
      {campaign.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{campaign.description}</Text>
      ) : null}
      <CampaignProgress campaign={campaign} copy={copy} />
    </Pressable>
  );
}

function DonorRow({ pledge, copy }: { pledge: DonationPledge; copy: Copy }) {
  return (
    <View style={styles.donorRow} testID={`donation-donor-${pledge.id}-row`}>
      <View style={styles.donorAvatar}>
        <MaterialCommunityIcons name="account" size={18} color={colors.primary} />
      </View>
      <View style={styles.donorBody}>
        <View style={styles.donorNameRow}>
          <Text style={styles.donorName} numberOfLines={1}>{pledge.donor_name}</Text>
          <Text style={styles.donorAmount}>{formatRupiah(pledge.amount)}</Text>
        </View>
        {pledge.message ? (
          <Text style={styles.donorMessage}>“{pledge.message}”</Text>
        ) : null}
        <Text style={styles.donorTime}>{formatAgo(pledge.created_at, copy)}</Text>
      </View>
    </View>
  );
}

function verdictColor(verdict?: Verdict): string {
  if (verdict === "likely_safe") return colors.success;
  if (verdict === "suspicious") return colors.warning;
  if (verdict === "likely_scam") return colors.brand;
  return colors.info;
}

function verdictLabel(verdict: Verdict | undefined, copy: Copy): string {
  if (verdict === "likely_safe") return copy.verdictLikelySafe;
  if (verdict === "suspicious") return copy.verdictSuspicious;
  if (verdict === "likely_scam") return copy.verdictLikelyScam;
  return copy.verdictUnverified;
}

function CampaignDetail({ campaign, copy, user, busy, onBack, onDonate, onReport }: {
  campaign: DonationCampaign;
  copy: Copy;
  user: User | null;
  busy: boolean;
  onBack: () => void;
  onDonate: (amount: number, message: string) => void;
  onReport: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const amountValue = parseInt(amount, 10);
  const canDonate = !busy && Number.isFinite(amountValue) && amountValue > 0;

  const sortedPledges = [...campaign.pledges].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <View testID="donation-detail-view">
      <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.backRow, pressed && styles.pressed]} testID="donation-detail-back-button">
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} />
        <Text style={styles.backText}>{copy.backToList}</Text>
      </Pressable>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardIcon}><MaterialCommunityIcons name="hand-heart" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{campaign.title}</Text>
            <Text style={styles.cardSub}>{copy.reportedBy} {campaign.organizer_name}</Text>
          </View>
          <Pressable onPress={onReport} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]} testID="donation-report-button">
            <MaterialCommunityIcons name="flag-outline" size={22} color={colors.brand} />
          </Pressable>
        </View>
        <View style={[styles.verdictChip, { backgroundColor: verdictColor(campaign.verdict as Verdict) + "22" }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color={verdictColor(campaign.verdict as Verdict)} />
          <Text style={[styles.verdictText, { color: verdictColor(campaign.verdict as Verdict) }]}>
            {verdictLabel(campaign.verdict as Verdict, copy)}
            {campaign.real_reports || campaign.scam_reports
              ? ` (${campaign.real_reports ?? 0}/${(campaign.real_reports ?? 0) + (campaign.scam_reports ?? 0)})`
              : ""}
          </Text>
        </View>
        {(campaign.photos?.length ?? 0) > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {campaign.photos!.map((photo) => {
              const uri = api.mediaUrl(photo.photo_url);
              return (
                <View key={photo.file_id} style={styles.photoTile} testID={`donation-photo-${photo.file_id}`}>
                  {uri ? <Image source={{ uri }} style={styles.photoImage} contentFit="cover" transition={200} /> : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
        {campaign.description ? (
          <Text style={styles.cardDesc}>{campaign.description}</Text>
        ) : null}
        <CampaignProgress campaign={campaign} copy={copy} />
      </View>

      {user ? (
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>{copy.donateAction}</Text>
          <Text style={styles.fieldLabel}>{copy.pledgeAmountLabel}</Text>
          <TextInput
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
            placeholder="50000"
            placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad"
            style={styles.input}
            testID="donation-detail-amount-input"
          />
          <Text style={styles.fieldLabel}>{copy.hopeLabel}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={copy.hopePlaceholder}
            placeholderTextColor={colors.inkSoft}
            multiline
            maxLength={200}
            style={[styles.input, styles.textArea]}
            testID="donation-detail-message-input"
          />
          <Pressable
            onPress={() => {
              if (!canDonate) return;
              onDonate(amountValue, message.trim());
              setAmount("");
              setMessage("");
            }}
            disabled={!canDonate}
            style={({ pressed }) => [styles.primaryBtn, styles.submitBtn, styles.fullBtn, !canDonate && styles.disabledBtn, pressed && styles.pressed]}
            testID="donation-detail-donate-button"
          >
            <MaterialCommunityIcons name="heart-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{copy.donateAction}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.signInCard}><Text style={styles.signInText}>{copy.signInNeeded}</Text></View>
      )}

      <Text style={styles.sectionTitle}>{copy.donorsTitle} ({sortedPledges.length})</Text>
      {sortedPledges.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyBody}>{copy.noDonors}</Text></View>
      ) : (
        <View style={styles.card}>
          {sortedPledges.map((pledge) => (
            <DonorRow key={pledge.id} pledge={pledge} copy={copy} />
          ))}
        </View>
      )}
    </View>
  );
}

export function DonationsScreen({ copy, user, coordinates, incidents, onClose }: {
  copy: Copy;
  user: User | null;
  coordinates: Coordinates | null;
  incidents: Incident[];
  onClose: () => void;
}) {
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [tagKind, setTagKind] = useState<DonationTagKind>("area");
  const [incidentId, setIncidentId] = useState<string>("");
  const [areaName, setAreaName] = useState("");
  const [areaCoords, setAreaCoords] = useState<Coordinates | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const selected = selectedId ? campaigns.find((campaign) => campaign.id === selectedId) ?? null : null;

  const flash = useCallback((message: string | null) => setToast(message), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCampaigns(await api.donations.list(coordinates ?? undefined));
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setLoading(false);
    }
  }, [coordinates, copy.retry, flash]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pickPhotos = async () => {
    if (picking) return;
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (Platform.OS !== "web" && permission.canAskAgain && !permission.granted) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (Platform.OS !== "web" && !permission.granted) {
      flash(copy.photoDenied);
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        selectionLimit: 4 - photos.length,
        allowsMultipleSelection: true,
      });
      if (result.canceled) return;
      const next = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `donation-${Date.now()}-${index}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      }));
      setPhotos((prev) => [...prev, ...next].slice(0, 4));
    } finally {
      setPicking(false);
    }
  };

  const handleCreate = async () => {
    if (!user || creating) return;
    const targetValue = parseInt(target, 10);
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0) return;
    const coords = tagKind === "area" ? (areaCoords ?? coordinates) : coordinates;
    if (tagKind === "area" && !coords) {
      flash(copy.campaignNeedsLocation);
      return;
    }
    setCreating(true);
    try {
      const campaign = await api.donations.create({
        title: title.trim(),
        description: description.trim(),
        target_amount: targetValue,
        tag_kind: tagKind,
        incident_id: tagKind === "incident" ? incidentId : undefined,
        area_name: tagKind === "area" ? areaName.trim() : undefined,
        longitude: coords?.longitude,
        latitude: coords?.latitude,
      });
      for (const photo of photos) {
        try {
          await api.donations.addPhoto(campaign.id, photo);
        } catch {
          /* skip failed upload; campaign is already created */
        }
      }
      setTitle("");
      setDescription("");
      setTarget("");
      setAreaName("");
      setAreaCoords(null);
      setPhotos([]);
      setShowForm(false);
      flash(copy.campaignCreated);
      await refresh();
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setCreating(false);
    }
  };

  const handleDonate = async (campaign: DonationCampaign, amount: number, message: string) => {
    if (!user) {
      flash(copy.signInNeeded);
      return;
    }
    setBusyId(campaign.id);
    try {
      const updated = await api.donations.pledge(campaign.id, amount, message);
      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      flash(copy.donationThanks);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    } finally {
      setBusyId(null);
    }
  };

  const handleReport = async (input: { kind: "scam" | "real"; reason: string; note: string }) => {
    if (!selected) return;
    try {
      const updated = await api.donations.report(selected.id, input);
      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      flash(copy.donationReported);
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : copy.retry);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay} testID="donations-screen">
      <Pressable style={styles.backdrop} onPress={onClose} testID="donations-backdrop" />
      <View style={[styles.sheet, { paddingTop: insets.top + 4 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]} testID="donations-close-button">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{copy.donations}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{copy.donationsSubtitle}</Text>

          {selected ? (
            <CampaignDetail
              campaign={selected}
              copy={copy}
              user={user}
              busy={busyId === selected.id}
              onBack={() => setSelectedId(null)}
              onDonate={(amount, message) => void handleDonate(selected, amount, message)}
              onReport={() => setReportOpen(true)}
            />
          ) : (
            <>
          {!user ? (
            <View style={styles.signInCard}><Text style={styles.signInText}>{copy.signInNeeded}</Text></View>
          ) : null}

          {loading ? (
            <View style={styles.emptyCard}><Text style={styles.emptyBody}>…</Text></View>
          ) : campaigns.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><MaterialCommunityIcons name="hand-heart-outline" size={40} color={colors.primary} /></View>
              <Text style={styles.emptyTitle}>{copy.donations}</Text>
              <Text style={styles.emptyBody}>{copy.noCampaigns}</Text>
            </View>
          ) : (
            campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} copy={copy} onPress={() => setSelectedId(campaign.id)} />
            ))
          )}
            </>
          )}

          {user && !selected ? (
            showForm ? (
              <View style={styles.createCard}>
                <Text style={styles.createTitle}>{copy.createCampaign}</Text>
                <Text style={styles.fieldLabel}>{copy.campaignTitleLabel}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={copy.campaignTitlePlaceholder}
                  placeholderTextColor={colors.inkSoft}
                  style={styles.input}
                  testID="donation-title-input"
                />
                <Text style={styles.fieldLabel}>{copy.campaignDescLabel}</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={[styles.input, styles.textArea]}
                  testID="donation-description-input"
                />
                <Text style={styles.fieldLabel}>{copy.campaignPhotosLabel}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoTile} testID={`donation-photo-preview-${index}`}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" transition={150} />
                      <Pressable
                        onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                        style={styles.photoRemove}
                        hitSlop={6}
                        testID={`donation-photo-remove-${index}`}
                      >
                        <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < 4 ? (
                    <Pressable
                      onPress={() => void pickPhotos()}
                      disabled={picking || creating}
                      style={({ pressed }) => [styles.photoAddTile, pressed && styles.pressed]}
                      testID="donation-photo-add-button"
                    >
                      {picking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.primary} />
                          <Text style={styles.photoAddText}>{copy.pickCampaignPhotos}</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Text style={styles.fieldLabel}>{copy.targetAmountLabel}</Text>
                <TextInput
                  value={target}
                  onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, ""))}
                  placeholder="1000000"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="number-pad"
                  style={styles.input}
                  testID="donation-target-input"
                />
                <Text style={styles.fieldLabel}>{copy.tagKindLabel}</Text>
                <View style={styles.chipRow}>
                  <Pressable onPress={() => setTagKind("incident")} style={({ pressed }) => [styles.chip, tagKind === "incident" && styles.chipActive, pressed && styles.pressed]} testID="donation-tag-incident-chip">
                    <MaterialCommunityIcons name="alert-box-outline" size={16} color={tagKind === "incident" ? "#FFFFFF" : colors.inkSoft} />
                    <Text style={[styles.chipText, tagKind === "incident" && styles.chipTextActive]}>{copy.tagIncident}</Text>
                  </Pressable>
                  <Pressable onPress={() => setTagKind("area")} style={({ pressed }) => [styles.chip, tagKind === "area" && styles.chipActive, pressed && styles.pressed]} testID="donation-tag-area-chip">
                    <MaterialCommunityIcons name="map-marker-radius" size={16} color={tagKind === "area" ? "#FFFFFF" : colors.inkSoft} />
                    <Text style={[styles.chipText, tagKind === "area" && styles.chipTextActive]}>{copy.tagArea}</Text>
                  </Pressable>
                </View>
                {tagKind === "incident" ? (
                  <>
                    <Text style={styles.fieldLabel}>{copy.pickIncidentLabel}</Text>
                    <IncidentAutocomplete
                      selectedId={incidentId}
                      incidents={incidents}
                      onSelect={(incident) => setIncidentId(incident?.id ?? "")}
                      placeholder={copy.pickIncidentLabel}
                      testPrefix="donation-incident"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>{copy.areaNameLabel}</Text>
                    <OsmAreaAutocomplete
                      value={areaName}
                      onChangeText={(text) => {
                        setAreaName(text);
                        if (areaCoords) setAreaCoords(null);
                      }}
                      onSelect={(place: OsmPlace) => {
                        setAreaName(place.displayName.split(",")[0]);
                        setAreaCoords({ latitude: place.latitude, longitude: place.longitude });
                      }}
                      placeholder={copy.areaNamePlaceholder}
                      testPrefix="donation-area"
                    />
                    {areaCoords || coordinates ? (
                      <Text style={styles.locationHint}>
                        {copy.useMyLocation}: {(areaCoords ?? coordinates)?.latitude.toFixed(4)}, {(areaCoords ?? coordinates)?.longitude.toFixed(4)}
                      </Text>
                    ) : (
                      <Text style={styles.locationHint}>{copy.campaignNeedsLocation}</Text>
                    )}
                  </>
                )}
                <View style={styles.formActions}>
                  <Pressable onPress={() => setShowForm(false)} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} testID="donation-cancel-button">
                    <Text style={styles.secondaryBtnText}>{copy.cancel}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleCreate()}
                    disabled={creating || !title.trim() || !parseInt(target, 10) || (tagKind === "incident" && !incidentId)}
                    style={({ pressed }) => [styles.primaryBtn, styles.submitBtn, (creating || !title.trim() || !parseInt(target, 10) || (tagKind === "incident" && !incidentId)) && styles.disabledBtn, pressed && styles.pressed]}
                    testID="donation-submit-button"
                  >
                    <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>{copy.createCampaign}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowForm(true)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]} testID="donation-create-open-button">
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{copy.createCampaign}</Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>
        {toast ? (
          <View style={[styles.toast, { bottom: 24 }]} pointerEvents="none" testID="donations-toast">
            <Text style={styles.toastText} numberOfLines={2}>{toast}</Text>
          </View>
        ) : null}
        <ReportSheet
          visible={reportOpen}
          title={selected ? `${copy.reportSheetTitle} — ${selected.title}` : copy.reportSheetTitle}
          copy={copy}
          onClose={() => setReportOpen(false)}
          onSubmit={(input) => void handleReport(input)}
        />
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
  emptyCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 24, alignItems: "center", marginBottom: 16 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  card: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 16, marginBottom: 16, ...shadow },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  cardSub: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  cardDesc: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 10 },
  verdictChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  verdictText: { fontSize: 12, fontWeight: "700" },
  photoRow: { gap: 8, marginTop: 12, paddingRight: 4 },
  photoTile: { width: 96, height: 96, borderRadius: radius.medium, overflow: "hidden", backgroundColor: colors.surfaceContainerHigh },
  photoImage: { width: "100%", height: "100%" },
  photoRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(33,26,25,0.75)", alignItems: "center", justifyContent: "center" },
  photoAddTile: { width: 96, height: 96, borderRadius: radius.medium, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", gap: 4 },
  photoAddText: { color: colors.onPrimaryContainer, fontSize: 10, fontWeight: "700", textAlign: "center" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh, marginTop: 12, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  progressText: { color: colors.inkSoft, fontSize: 12, fontWeight: "600", marginTop: 6 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, alignSelf: "flex-start" },
  backText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 8, marginBottom: 10 },
  donorRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  donorAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" },
  donorBody: { flex: 1 },
  donorNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  donorName: { color: colors.ink, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  donorAmount: { color: colors.success, fontSize: 13, fontWeight: "800" },
  donorMessage: { color: colors.inkSoft, fontSize: 13, fontStyle: "italic", lineHeight: 18, marginTop: 3 },
  donorTime: { color: colors.inkSoft, fontSize: 11, marginTop: 3 },
  fullBtn: { alignSelf: "stretch", justifyContent: "center", marginTop: 14 },
  input: { minHeight: 48, backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 14, color: colors.ink, fontSize: 15, ...shadow },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, borderRadius: 24, backgroundColor: colors.primary, paddingHorizontal: 16, ...shadow },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  disabledBtn: { opacity: 0.5 },
  signInCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 18, alignItems: "center", marginBottom: 16 },
  signInText: { color: colors.inkSoft, fontSize: 14, fontWeight: "600", textAlign: "center" },
  createCard: { backgroundColor: colors.surfaceContainer, borderRadius: radius.large, padding: 16, marginBottom: 16 },
  createTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  fieldLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  locationHint: { color: colors.inkSoft, fontSize: 12, marginTop: 8 },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  secondaryBtn: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  submitBtn: { paddingHorizontal: 18 },
  fab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 26, backgroundColor: colors.primary, marginBottom: 16, ...shadow },
  toast: { position: "absolute", left: 20, right: 20, backgroundColor: colors.dark, borderRadius: radius.medium, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
});

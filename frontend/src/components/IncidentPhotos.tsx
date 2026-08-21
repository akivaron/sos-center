import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Platform } from "react-native";

import { api } from "../api";
import type { Copy } from "../i18n";
import { colors, radius } from "../theme";
import type { ContributorPhoto, Incident, LocalPhoto, User } from "../types";

export function IncidentPhotos({ incidentId, photos, copy, user, onAdded, onRequireAuth }: {
  incidentId: string;
  photos: ContributorPhoto[];
  copy: Copy;
  user: User | null;
  onAdded: (updated: Incident) => void;
  onRequireAuth?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const addPhoto = async () => {
    if (!user) return onRequireAuth?.();
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (Platform.OS !== "web" && permission.canAskAgain && !permission.granted) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (Platform.OS !== "web" && !permission.granted) {
      setBlocked(!permission.canAskAgain);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, quality: 0.72, selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const local: LocalPhoto = {
      uri: asset.uri,
      name: asset.fileName ?? `contrib-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    };
    setBusy(true);
    try {
      const updated = await api.addIncidentPhoto(incidentId, local);
      onAdded(updated);
    } catch {
      /* keep card open; upload may retry later */
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="incident-contributor-photos">
      <View style={styles.head}>
        <MaterialCommunityIcons name="image-multiple-outline" size={16} color={colors.inkSoft} />
        <Text style={styles.headText}>{copy.contributorPhotos}</Text>
        <Text style={styles.count}>{photos.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
        {photos.map((photo) => {
          const uri = api.mediaUrl(photo.photo_url);
          return (
            <View key={photo.file_id} style={styles.thumb} testID="contributor-photo-thumb">
              {uri ? <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" transition={200} /> : null}
              <View style={styles.thumbLabel}>
                <Text style={styles.thumbLabelText} numberOfLines={1}>{photo.contributor_name}</Text>
              </View>
            </View>
          );
        })}
        <Pressable
          onPress={blocked ? () => Linking.openSettings() : addPhoto}
          disabled={busy}
          style={({ pressed }) => [styles.addTile, pressed && styles.pressed, busy && styles.disabled]}
          testID="add-contributor-photo-button"
        >
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialCommunityIcons name="plus" size={26} color={colors.primary} />}
          <Text style={styles.addTileText}>{blocked ? copy.openSettings : copy.addContributorPhoto}</Text>
        </Pressable>
      </ScrollView>
      <Text style={styles.hint}>{copy.contributorPhotosHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headText: { color: colors.ink, fontSize: 13, fontWeight: "700", flex: 1 },
  count: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", backgroundColor: colors.surfaceContainer, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  gallery: { gap: 10, paddingRight: 4 },
  thumb: { width: 104, height: 104, borderRadius: radius.large, overflow: "hidden", backgroundColor: colors.surfaceContainer },
  thumbImage: { width: "100%", height: "100%" },
  thumbLabel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(33,26,25,0.7)" },
  thumbLabelText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  addTile: { width: 104, height: 104, borderRadius: radius.large, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center", gap: 6 },
  addTileText: { color: colors.onPrimaryContainer, fontSize: 12, fontWeight: "700" },
  hint: { color: colors.inkSoft, fontSize: 11, lineHeight: 16, marginTop: 8 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, radius, shadow, zIndex } from "../theme";
import { MAP_LAYERS, mapLayerLabel, type MapLayerKey } from "./mapLayers";

export function LayerPicker({ top, right, copy, value, onSelect, onClose }: {
  top: number;
  right: number;
  copy: Copy;
  value: MapLayerKey;
  onSelect: (layer: MapLayerKey) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.backdrop, { top }]} testID="layer-picker">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="layer-backdrop" />
      <View style={[styles.panel, { right }]} testID="layer-panel">
        <Text style={styles.title}>{copy.layerTitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {MAP_LAYERS.map((layer) => {
            const selected = layer.key === value;
            return (
              <Pressable
                key={layer.key}
                onPress={() => { onSelect(layer.key); onClose(); }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                testID={`layer-${layer.key}-button`}
              >
                <View style={[styles.swatch, selected && styles.swatchActive]}>
                  <MaterialCommunityIcons name={layer.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={selected ? colors.onPrimary : colors.inkSoft} />
                </View>
                <Text style={[styles.optionLabel, selected && styles.optionLabelActive]} numberOfLines={1}>
                  {mapLayerLabel(copy, layer.key)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: zIndex.overlay },
  panel: { position: "absolute", top: 0, width: 300, borderRadius: radius.large, backgroundColor: colors.surface, padding: 14, ...shadow },
  title: { color: colors.ink, fontSize: 12, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  row: { gap: 10, alignItems: "flex-start" },
  option: { width: 72, alignItems: "center", gap: 6 },
  swatch: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: colors.outline, backgroundColor: colors.surfaceContainer, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderColor: colors.primary, backgroundColor: colors.secondaryContainer },
  optionLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "600", textAlign: "center" },
  optionLabelActive: { color: colors.onPrimaryContainer },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});

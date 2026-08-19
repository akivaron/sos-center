import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { colors } from "../theme";
import type { Coordinates, Incident } from "../types";

const markerColor = {
  fire: "#DC2626",
  flood: "#2563EB",
  earthquake: "#7C3AED",
  crash: "#F59E0B",
  other: "#52525B",
} as const;

const markerIcon = {
  fire: "fire",
  flood: "waves",
  earthquake: "pulse",
  crash: "car-emergency",
  other: "alert-circle",
} as const;

export function MapFallback({
  incidents,
  coordinates,
  onIncidentPress,
}: {
  incidents: Incident[];
  coordinates: Coordinates | null;
  onIncidentPress: (incident: Incident) => void;
}) {
  const { width, height } = useWindowDimensions();
  const mapHeight = Math.max(height, 680);

  const position = (incident: Incident, index: number) => {
    const center = coordinates ?? { latitude: -6.2088, longitude: 106.8456 };
    const x = width / 2 + (incident.longitude - center.longitude) * 5000;
    const y = mapHeight / 2 - (incident.latitude - center.latitude) * 5000;
    return {
      left: Math.max(30, Math.min(width - 62, Number.isFinite(x) ? x : 60 + index * 52)),
      top: Math.max(150, Math.min(mapHeight - 230, Number.isFinite(y) ? y : 190 + index * 56)),
    };
  };

  return (
    <View style={[styles.map, { height: mapHeight }]} testID="map-fallback-canvas">
      <View style={[styles.water, { width: width * 0.32 }]} />
      {[0.19, 0.34, 0.53, 0.69, 0.84].map((ratio) => (
        <View key={`h-${ratio}`} style={[styles.roadHorizontal, { top: mapHeight * ratio }]} />
      ))}
      {[0.17, 0.42, 0.64, 0.82].map((ratio) => (
        <View key={`v-${ratio}`} style={[styles.roadVertical, { left: width * ratio }]} />
      ))}
      <View style={[styles.artery, { top: mapHeight * 0.43, left: -80 }]} />
      <Text style={[styles.mapLabel, { top: mapHeight * 0.28, left: width * 0.3 }]}>RESQ DISTRICT</Text>
      <Text style={[styles.waterLabel, { top: mapHeight * 0.54 }]}>RIVER</Text>
      {coordinates ? (
        <View style={[styles.userHalo, { left: width / 2 - 20, top: mapHeight / 2 - 20 }]} testID="user-location-marker">
          <View style={styles.userDot} />
        </View>
      ) : null}
      {incidents.map((incident, index) => (
        <Pressable
          key={incident.id}
          onPress={() => onIncidentPress(incident)}
          style={[styles.marker, position(incident, index), { backgroundColor: markerColor[incident.incident_type] }]}
          testID={`incident-marker-${incident.id}`}
        >
          <MaterialCommunityIcons name={markerIcon[incident.incident_type]} size={21} color="#FFFFFF" />
          <View style={[styles.severityDot, incident.severity === "critical" && styles.criticalDot]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { position: "absolute", inset: 0, backgroundColor: colors.mapLand, overflow: "hidden" },
  water: { position: "absolute", right: -50, top: 0, bottom: 0, backgroundColor: colors.mapWater, transform: [{ skewX: "-8deg" }] },
  roadHorizontal: { position: "absolute", left: -20, right: -20, height: 8, backgroundColor: colors.mapRoad, transform: [{ rotate: "-3deg" }] },
  roadVertical: { position: "absolute", top: -40, bottom: -40, width: 7, backgroundColor: colors.mapRoad, transform: [{ rotate: "8deg" }] },
  artery: { position: "absolute", width: "120%", height: 14, backgroundColor: "#F7C86B", transform: [{ rotate: "18deg" }] },
  mapLabel: { position: "absolute", color: "#8A8175", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  waterLabel: { position: "absolute", right: 20, color: "#6A9DB8", fontSize: 11, fontWeight: "800", transform: [{ rotate: "90deg" }] },
  userHalo: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(37,99,235,0.2)", alignItems: "center", justifyContent: "center" },
  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.info, borderWidth: 3, borderColor: "#FFFFFF" },
  marker: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#18181B", shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },
  severityDot: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#F7C86B", borderWidth: 2, borderColor: "#FFFFFF" },
  criticalDot: { backgroundColor: "#FF5449" },
});
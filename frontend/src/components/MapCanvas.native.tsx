import Mapbox from "@rnmapbox/maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import type { Coordinates, Incident } from "../types";
import { MapFallback } from "./MapFallback";

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
if (token) Mapbox.setAccessToken(token);

const icons = {
  fire: "fire",
  flood: "waves",
  earthquake: "pulse",
  crash: "car-emergency",
  other: "alert-circle",
} as const;
const markerColors = { fire: "#BA1A1A", flood: "#00639B", earthquake: "#6750A4", crash: "#8A5100", other: "#5D5D66" } as const;

export default function MapCanvas(props: {
  incidents: Incident[];
  coordinates: Coordinates | null;
  onIncidentPress: (incident: Incident) => void;
}) {
  if (!token) return <MapFallback {...props} />;
  const center: [number, number] = props.coordinates
    ? [props.coordinates.longitude, props.coordinates.latitude]
    : [106.8456, -6.2088];

  return (
    <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} logoEnabled={false}>
      <Mapbox.Camera centerCoordinate={center} zoomLevel={13} animationDuration={700} />
      {props.coordinates ? <Mapbox.UserLocation visible /> : null}
      {props.incidents.map((incident) => (
        <Mapbox.PointAnnotation
          id={incident.id}
          key={incident.id}
          coordinate={[incident.longitude, incident.latitude]}
          onSelected={() => props.onIncidentPress(incident)}
        >
          <View style={[styles.marker, { backgroundColor: markerColors[incident.incident_type] }]}>
            <MaterialCommunityIcons name={icons[incident.incident_type]} size={20} color="#FFFFFF" />
            <View style={[styles.severityDot, incident.severity === "critical" && styles.criticalDot]} />
          </View>
        </Mapbox.PointAnnotation>
      ))}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  severityDot: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#F7C86B", borderWidth: 2, borderColor: "#FFFFFF" },
  criticalDot: { backgroundColor: "#FF5449" },
});
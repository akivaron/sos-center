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
          <View style={styles.marker}>
            <MaterialCommunityIcons name={icons[incident.incident_type]} size={20} color="#FFFFFF" />
          </View>
        </Mapbox.PointAnnotation>
      ))}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#DC2626", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
});
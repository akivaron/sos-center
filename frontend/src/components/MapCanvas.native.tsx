import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import { StyleSheet, Text, View } from "react-native";

import type { Coordinates, FamilyLocation, Incident, SurvivalResource } from "../types";
import { isValidCoordinates } from "../utils/geo";
import { clusterIncidents, zoomForCluster } from "../utils/cluster";
import { DEFAULT_MAP_LAYER, mapLayerStyle, type MapLayerKey } from "./mapLayers";

export interface MapHandle {
  focusUserLocation: () => void;
}

const icons = {
  fire: "fire",
  flood: "waves",
  earthquake: "pulse",
  crash: "car-emergency",
  other: "alert-circle",
} as const;
const markerColors = { fire: "#BA1A1A", flood: "#00639B", earthquake: "#6750A4", crash: "#8A5100", other: "#5D5D66" } as const;
const resourceColors = { water: "#0288D1", basecamp: "#6D4C41", shelter: "#2E7D32", food: "#F9A825", camping: "#7E57C2", river: "#0097A7", settlement: "#C2185B" } as const;
const resourceIcons = { water: "water", basecamp: "tent", shelter: "home", food: "food", camping: "terrain", river: "waves", settlement: "home-city" } as const;

const MapCanvas = forwardRef<MapHandle, {
  incidents: Incident[];
  coordinates: Coordinates | null;
  route: Coordinates[] | null;
  follow?: boolean;
  destination?: Coordinates | null;
  layer?: MapLayerKey;
  family?: FamilyLocation[];
  resources?: SurvivalResource[];
  onIncidentPress: (incident: Incident) => void;
  onFamilyPress?: (location: FamilyLocation) => void;
  onResourcePress?: (resource: SurvivalResource) => void;
}>((props, ref) => {
  const cameraRef = useRef<MapLibreGL.CameraRef>(null);
  const framedRef = useRef(false);
  const [zoom, setZoom] = useState(13);

  const clusters = useMemo(
    () => clusterIncidents(props.incidents, zoom),
    [props.incidents, zoom],
  );

  useImperativeHandle(ref, () => ({
    focusUserLocation() {
      if (!isValidCoordinates(props.coordinates)) return;
      cameraRef.current?.flyTo({
        center: [props.coordinates.longitude, props.coordinates.latitude],
        zoom: 15,
        duration: 800,
      });
    },
  }));

  const center: [number, number] = isValidCoordinates(props.coordinates)
    ? [props.coordinates.longitude, props.coordinates.latitude]
    : [106.8456, -6.2088];

  const routeGeoJSON = props.route && props.route.length > 1
    ? {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: props.route.map((p) => [p.longitude, p.latitude]),
        },
      }
    : null;

  const routeForFrame = props.route && props.route.length > 1 ? props.route : null;
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    if (!props.follow) {
      framedRef.current = false;
      return;
    }
    if (routeForFrame && !framedRef.current) {
      framedRef.current = true;
      const lons = routeForFrame.map((p) => p.longitude).filter((n) => Number.isFinite(n));
      const lats = routeForFrame.map((p) => p.latitude).filter((n) => Number.isFinite(n));
      if (lons.length && lats.length) {
        cam.fitBounds(
          [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
          { duration: 600 },
        );
      }
    }
  }, [props.follow, routeForFrame]);

  return (
    <MapLibreGL.Map
      style={styles.map}
      mapStyle={mapLayerStyle(props.layer ?? DEFAULT_MAP_LAYER)}
      testID="osm-map"
      onRegionDidChange={(event) => setZoom(event.nativeEvent.zoom)}
    >
      <MapLibreGL.Camera ref={cameraRef} center={center} zoom={13} duration={700} trackUserLocation={props.follow && props.coordinates && isValidCoordinates(props.coordinates) ? "course" : undefined} />
      {props.coordinates && isValidCoordinates(props.coordinates) ? <MapLibreGL.UserLocation /> : null}
      {routeGeoJSON ? (
        <MapLibreGL.GeoJSONSource id="route-source" data={routeGeoJSON}>
          <MapLibreGL.Layer
            id="route-line"
            source="route-source"
            type="line"
            paint={{ "line-color": "#1A73E8", "line-width": 6, "line-opacity": 0.85 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </MapLibreGL.GeoJSONSource>
      ) : null}
      {props.destination ? (
        <MapLibreGL.Marker
          id="route-destination"
          lngLat={[props.destination.longitude, props.destination.latitude]}
        >
          <View style={[styles.destMarker]} />
        </MapLibreGL.Marker>
      ) : null}
      {clusters.map((cluster) => {
        if (cluster.count === 1) {
          const incident = cluster.incidents[0];
          return (
            <MapLibreGL.Marker
              key={cluster.id}
              id={cluster.id}
              lngLat={[incident.longitude, incident.latitude]}
              onPress={() => props.onIncidentPress(incident)}
            >
              <View style={[styles.marker, { backgroundColor: markerColors[incident.incident_type] }]}>
                <MaterialCommunityIcons name={icons[incident.incident_type]} size={20} color="#FFFFFF" />
                <View style={[styles.severityDot, incident.severity === "critical" && styles.criticalDot]} />
              </View>
            </MapLibreGL.Marker>
          );
        }
        return (
          <MapLibreGL.Marker
            key={cluster.id}
            id={cluster.id}
            lngLat={[cluster.longitude, cluster.latitude]}
            onPress={() => {
              cameraRef.current?.flyTo({
                center: [cluster.longitude, cluster.latitude],
                zoom: zoomForCluster(zoom),
                duration: 500,
              });
            }}
          >
            <View style={[styles.cluster, cluster.hasCritical && styles.clusterCritical]}>
              <Text style={styles.clusterText}>{cluster.count}</Text>
            </View>
          </MapLibreGL.Marker>
        );
      })}
      {(props.family ?? []).map((item) => (
        <MapLibreGL.Marker
          key={`family-${item.user_id}`}
          id={`family-${item.user_id}`}
          lngLat={[item.location.longitude, item.location.latitude]}
          onPress={() => props.onFamilyPress?.(item)}
        >
          <View style={[styles.familyMarker, item.location.source === "mesh" && styles.familyMarkerMesh]}>
            <MaterialCommunityIcons name="account-group" size={18} color="#FFFFFF" />
          </View>
        </MapLibreGL.Marker>
      ))}
      {(props.resources ?? []).map((item) => (
        <MapLibreGL.Marker
          key={`resource-${item.id}`}
          id={`resource-${item.id}`}
          lngLat={[item.longitude, item.latitude]}
          onPress={() => props.onResourcePress?.(item)}
        >
          <View style={[styles.resourceMarker, { backgroundColor: resourceColors[item.type] }]}>
            <MaterialCommunityIcons name={resourceIcons[item.type]} size={18} color="#FFFFFF" />
          </View>
        </MapLibreGL.Marker>
      ))}
    </MapLibreGL.Map>
  );
});

export default MapCanvas;

MapCanvas.displayName = "MapCanvas";

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  severityDot: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#F7C86B", borderWidth: 2, borderColor: "#FFFFFF" },
  criticalDot: { backgroundColor: "#FF5449" },
  destMarker: { width: 22, height: 22, borderRadius: 11, borderWidth: 4, borderColor: "#FFFFFF", backgroundColor: "#0B7A3B" },
  cluster: { minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 22, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#1A73E8", alignItems: "center", justifyContent: "center" },
  clusterCritical: { backgroundColor: "#BA1A1A" },
  clusterText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  familyMarker: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  familyMarkerMesh: { backgroundColor: "#2563EB" },
  resourceMarker: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
});

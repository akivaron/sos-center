import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import L from "leaflet";

import type { Coordinates, FamilyLocation, Incident, SurvivalResource, SurvivalResourceType } from "../types";
import { isValidCoordinates } from "../utils/geo";
import { clusterIncidents, zoomForCluster } from "../utils/cluster";
import { DEFAULT_MAP_LAYER, getMapLayer, type MapLayerKey } from "./mapLayers";

const ROUTE_COLOR = "#1A73E8";

export interface MapHandle {
  focusUserLocation: () => void;
}

const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456];

const markerColor: Record<Incident["incident_type"], string> = {
  fire: "#DC2626",
  flood: "#2563EB",
  earthquake: "#7C3AED",
  crash: "#F59E0B",
  other: "#52525B",
};

const markerEmoji: Record<Incident["incident_type"], string> = {
  fire: "🔥",
  flood: "🌊",
  earthquake: "⚡",
  crash: "🚗",
  other: "❗",
};

const resourceColor: Record<SurvivalResourceType, string> = {
  water: "#0288D1",
  basecamp: "#6D4C41",
  shelter: "#2E7D32",
  food: "#F9A825",
  camping: "#7E57C2",
  river: "#0097A7",
  settlement: "#C2185B",
};

const resourceEmoji: Record<SurvivalResourceType, string> = {
  water: "💧",
  basecamp: "⛺",
  shelter: "🏠",
  food: "🍚",
  camping: "🏕️",
  river: "🌊",
  settlement: "🏘️",
};

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (!document.getElementById("osm-leaflet-css")) {
    const link = document.createElement("link");
    link.id = "osm-leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  if (!document.getElementById("osm-marker-css")) {
    const style = document.createElement("style");
    style.id = "osm-marker-css";
    style.textContent = `
      .leaflet-container { background: #e8eef0; }
      .osm-marker {
        width: 44px; height: 44px; border-radius: 22px; border: 3px solid #fff;
        background: #52525B; display: flex; align-items: center; justify-content: center;
        font-size: 20px; line-height: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        position: relative;
      }
      .osm-severity {
        position: absolute; top: -2px; right: -2px; width: 12px; height: 12px;
        border-radius: 6px; background: #F7C86B; border: 2px solid #fff;
      }
      .osm-severity.critical { background: #FF5449; }
      .osm-dest {
        width: 28px; height: 28px; border-radius: 14px; border: 4px solid #fff;
        background: #0B7A3B; box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        position: relative;
      }
      .osm-dest::after {
        content: ""; position: absolute; top: 50%; left: 50%; width: 8px; height: 8px;
        border-radius: 4px; background: #fff;         transform: translate(-50%, -50%);
      }
      .osm-cluster {
        width: 44px; height: 44px; border-radius: 22px; border: 3px solid #fff;
        background: #1A73E8; color: #fff; font-weight: 800; font-size: 15px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      }
      .osm-cluster.critical { background: #BA1A1A; }
      .osm-family {
        width: 40px; height: 40px; border-radius: 22px; border: 3px solid #fff;
        background: #16A34A; display: flex; align-items: center; justify-content: center;
        font-size: 18px; line-height: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.28);
      }
      .osm-family.mesh { background: #2563EB; }
      .osm-resource {
        width: 38px; height: 38px; border-radius: 19px; border: 3px solid #fff;
        background: #0B7A3B; display: flex; align-items: center; justify-content: center;
        font-size: 18px; line-height: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      }
    `;
    document.head.appendChild(style);
  }
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const userRef = useRef<L.CircleMarker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const familyRef = useRef<L.LayerGroup | null>(null);
  const resourceRef = useRef<L.LayerGroup | null>(null);
  const centeredOnceRef = useRef(false);
  const followFramedRef = useRef(false);
  const onPressRef = useRef(props.onIncidentPress);
  onPressRef.current = props.onIncidentPress;
  const onResourcePressRef = useRef(props.onResourcePress);
  onResourcePressRef.current = props.onResourcePress;
  const [zoom, setZoom] = useState(13);
  const zoomRef = useRef(13);
  zoomRef.current = zoom;

  useImperativeHandle(ref, () => ({
    focusUserLocation() {
      const map = mapRef.current;
      if (!map || !isValidCoordinates(props.coordinates)) return;
      map.flyTo([props.coordinates.latitude, props.coordinates.longitude], 15, { duration: 0.8 });
    },
  }));

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    const route = props.route;
    if (route && route.length > 1) {
      routeRef.current = L.polyline(
        route.map((p) => [p.latitude, p.longitude] as [number, number]),
        { color: ROUTE_COLOR, weight: 6, opacity: 0.85, lineJoin: "round", lineCap: "round" },
      ).addTo(map);
      map.fitBounds(routeRef.current.getBounds(), { padding: [60, 60] });
    }
  }, [props.route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destRef.current) {
      destRef.current.remove();
      destRef.current = null;
    }
    if (props.destination) {
      destRef.current = L.marker(
        [props.destination.latitude, props.destination.longitude],
        {
          icon: L.divIcon({
            className: "",
            html: '<div class="osm-dest"></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          zIndexOffset: 1000,
        },
      ).addTo(map);
    }
  }, [props.destination]);

  useEffect(() => {
    ensureStyles();
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const center: [number, number] = props.coordinates
      ? [props.coordinates.latitude, props.coordinates.longitude]
      : DEFAULT_CENTER;

    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(center, 13);
    const initial = getMapLayer(props.layer ?? DEFAULT_MAP_LAYER);
    tileRef.current = L.tileLayer(initial.tiles[0], {
      maxZoom: initial.maxZoom,
      subdomains: initial.subdomains,
      attribution: initial.attribution,
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    setZoom(map.getZoom());
    map.on("zoomend", () => { setZoom(map.getZoom()); });

    mapRef.current = map;
    return () => {
      map.off("zoomend");
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layersRef.current = null;
      userRef.current = null;
      resourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const tile = tileRef.current;
    if (!map || !tile) return;
    const next = getMapLayer(props.layer ?? DEFAULT_MAP_LAYER);
    tile.setUrl(next.tiles[0], false);
    tile.options.maxZoom = next.maxZoom;
    tile.options.subdomains = next.subdomains;
    tile.options.attribution = next.attribution;
    map.attributionControl?.setPrefix(next.attribution);
  }, [props.layer]);

  const clusters = useMemo(
    () => clusterIncidents(props.incidents, zoom),
    [props.incidents, zoom],
  );

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    clusters.forEach((cluster) => {
      if (cluster.count === 1) {
        const incident = cluster.incidents[0];
        const dot = incident.severity === "critical"
          ? '<span class="osm-severity critical"></span>'
          : '<span class="osm-severity"></span>';
        const html =
          `<div class="osm-marker" style="background:${markerColor[incident.incident_type] ?? "#52525B"}">` +
          `${markerEmoji[incident.incident_type] ?? "❗"}${dot}</div>`;
        const marker = L.marker([incident.latitude, incident.longitude], {
          icon: L.divIcon({ className: "", html, iconSize: [44, 44], iconAnchor: [22, 22] }),
        }).addTo(layers);
        marker.on("click", () => onPressRef.current(incident));
        return;
      }
      const html =
        `<div class="osm-cluster${cluster.hasCritical ? " critical" : ""}">${cluster.count}</div>`;
      const marker = L.marker([cluster.latitude, cluster.longitude], {
        icon: L.divIcon({ className: "", html, iconSize: [44, 44], iconAnchor: [22, 22] }),
      }).addTo(layers);
      marker.on("click", () => {
        map.flyTo([cluster.latitude, cluster.longitude], zoomForCluster(zoomRef.current), { duration: 0.5 });
      });
    });
  }, [clusters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userRef.current) {
      userRef.current.remove();
      userRef.current = null;
    }
    if (props.coordinates) {
      userRef.current = L.circleMarker([props.coordinates.latitude, props.coordinates.longitude], {
        radius: 8,
        color: "#2563EB",
        weight: 3,
        fillColor: "#2563EB",
        fillOpacity: 1,
      }).addTo(map);
      if (!centeredOnceRef.current) {
        centeredOnceRef.current = true;
        map.setView([props.coordinates.latitude, props.coordinates.longitude], 15);
      }
    }
  }, [props.coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (familyRef.current) {
      familyRef.current.remove();
      familyRef.current = null;
    }
    const family = props.family;
    if (!family || family.length === 0) return;
    const group = L.layerGroup().addTo(map);
    family.forEach((item) => {
      const mesh = item.location.source === "mesh";
      const html = `<div class="osm-family${mesh ? " mesh" : ""}">👪</div>`;
      const marker = L.marker([item.location.latitude, item.location.longitude], {
        icon: L.divIcon({ className: "", html, iconSize: [40, 40], iconAnchor: [20, 20] }),
        zIndexOffset: 500,
      }).addTo(group);
      marker.on("click", () => props.onFamilyPress?.(item));
    });
    familyRef.current = group;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.family, props.onFamilyPress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (resourceRef.current) {
      resourceRef.current.remove();
      resourceRef.current = null;
    }
    const resources = props.resources;
    if (!resources || resources.length === 0) return;
    const group = L.layerGroup().addTo(map);
    resources.forEach((item) => {
      const html =
        `<div class="osm-resource" style="background:${resourceColor[item.type]}">` +
        `${resourceEmoji[item.type]}</div>`;
      const marker = L.marker([item.latitude, item.longitude], {
        icon: L.divIcon({ className: "", html, iconSize: [38, 38], iconAnchor: [19, 19] }),
        zIndexOffset: 400,
      }).addTo(group);
      marker.on("click", () => onResourcePressRef.current?.(item));
    });
    resourceRef.current = group;
  }, [props.resources, props.onResourcePress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.follow) return;
    if (props.route && props.route.length > 1 && !followFramedRef.current) {
      const valid = props.route.every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      if (valid) {
        followFramedRef.current = true;
        const line = L.polyline(props.route.map((p) => [p.latitude, p.longitude] as [number, number]));
        map.fitBounds(line.getBounds(), { padding: [90, 90] });
        return;
      }
    }
    if (!props.follow) followFramedRef.current = false;
    if (props.coordinates && isValidCoordinates(props.coordinates)) {
      map.flyTo([props.coordinates.latitude, props.coordinates.longitude], 15, { duration: 0.6 });
    }
  }, [props.follow, props.coordinates, props.route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(id);
  }, [props.follow]);

  return <View ref={containerRef as never} style={styles.map} testID="osm-map" />;
});

export default MapCanvas;

MapCanvas.displayName = "MapCanvas";

const styles = StyleSheet.create({ map: { flex: 1 } });

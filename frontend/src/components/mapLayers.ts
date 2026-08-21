import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import type { Copy } from "../i18n";

export type MapLayerKey = "standard" | "topographic" | "satellite" | "dark" | "light";

export interface MapLayerDef {
  key: MapLayerKey;
  icon: string;
  tiles: string[];
  subdomains: string;
  maxZoom: number;
  attribution: string;
}

export const MAP_LAYERS: MapLayerDef[] = [
  {
    key: "standard",
    icon: "map",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    subdomains: "abc",
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  {
    key: "topographic",
    icon: "terrain",
    tiles: ["https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"],
    subdomains: "abc",
    maxZoom: 17,
    attribution: "© OpenStreetMap contributors · © OpenTopoMap (CC-BY-SA)",
  },
  {
    key: "satellite",
    icon: "satellite-variant",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    subdomains: "abc",
    maxZoom: 19,
    attribution: "© Esri, Maxar, Earthstar Geographics",
  },
  {
    key: "dark",
    icon: "weather-night",
    tiles: ["https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors · © CARTO",
  },
  {
    key: "light",
    icon: "map-outline",
    tiles: ["https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors · © CARTO",
  },
];

export const DEFAULT_MAP_LAYER: MapLayerKey = "standard";

export function getMapLayer(key: MapLayerKey): MapLayerDef {
  return MAP_LAYERS.find((layer) => layer.key === key) ?? MAP_LAYERS[0];
}

export function mapLayerLabel(copy: Copy, key: MapLayerKey): string {
  switch (key) {
    case "topographic":
      return copy.layerTopographic;
    case "satellite":
      return copy.layerSatellite;
    case "dark":
      return copy.layerDark;
    case "light":
      return copy.layerLight;
    case "standard":
    default:
      return copy.layerStandard;
  }
}

export function mapLayerStyle(key: MapLayerKey): StyleSpecification {
  const layer = getMapLayer(key);
  return {
    version: 8 as const,
    sources: {
      basemap: {
        type: "raster" as const,
        tiles: layer.tiles.map((tile) => tile.replace(/\{s\}/g, "a")),
        tileSize: 256,
        attribution: layer.attribution,
      },
    },
    layers: [{ id: "basemap", type: "raster" as const, source: "basemap" }],
  };
}

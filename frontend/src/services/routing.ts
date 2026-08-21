import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Coordinates } from "../types";

export type RouteSource = "online" | "cache" | "estimated";

export type ManeuverType =
  | "depart"
  | "straight"
  | "slight_left"
  | "left"
  | "slight_right"
  | "right"
  | "roundabout"
  | "arrive";

export type Maneuver = {
  latitude: number;
  longitude: number;
  type: ManeuverType;
  text: string;
  distanceAlong: number;
};

export type Route = {
  coordinates: Coordinates[];
  distance_m: number;
  time_s: number;
  source: RouteSource;
  maneuvers: Maneuver[];
};

const GRAPHHOPPER_URL = "https://routing.openstreetmap.de/route";
const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

const CACHE_PREFIX = "route:";
const cacheKey = (from: Coordinates, to: Coordinates) =>
  `${CACHE_PREFIX}${from.latitude.toFixed(4)},${from.longitude.toFixed(4)}>${to.latitude.toFixed(4)},${to.longitude.toFixed(4)}`;

async function readCache(from: Coordinates, to: Coordinates): Promise<Route | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(from, to));
    return raw ? (JSON.parse(raw) as Route) : null;
  } catch {
    return null;
  }
}

async function writeCache(from: Coordinates, to: Coordinates, route: Route): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(from, to), JSON.stringify(route));
  } catch {
    /* cache best-effort */
  }
}

function haversine(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const aLat = Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + aLat));
}

export function cumulativeDistances(coords: Coordinates[]): number[] {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  return cum;
}

export type RouteProjection = {
  index: number;
  distanceAlong: number;
  offRoute: number;
};

export function bearingTo(from: Coordinates, to: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const lat1 = rad(from.latitude);
  const lat2 = rad(to.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

export function projectOntoRoute(coords: Coordinates[], point: Coordinates, cum?: number[]): RouteProjection {
  const cumulative = cum ?? cumulativeDistances(coords);
  if (coords.length < 2) return { index: 0, distanceAlong: 0, offRoute: 0 };
  let bestSeg = 0;
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLat = b.latitude - a.latitude;
    const segLon = b.longitude - a.longitude;
    const segLenSq = segLat * segLat + segLon * segLon || 1e-12;
    const tRaw = ((point.latitude - a.latitude) * segLat +
      (point.longitude - a.longitude) * segLon) / segLenSq;
    const t = Math.max(0, Math.min(1, tRaw));
    const proj: Coordinates = {
      latitude: a.latitude + segLat * t,
      longitude: a.longitude + segLon * t,
    };
    const dist = haversine(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeg = i;
      bestT = t;
    }
  }
  const segLen = haversine(coords[bestSeg], coords[bestSeg + 1]) || 1;
  return {
    index: bestSeg,
    distanceAlong: cumulative[bestSeg] + bestT * segLen,
    offRoute: bestDist,
  };
}

function decodeValhallaPolyline(encoded: string, precision = 1e6): Coordinates[] {
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coords: Coordinates[] = [];
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result += (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result += (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += deltaLon;

    coords.push({ latitude: lat / precision, longitude: lon / precision });
  }
  return coords;
}

function ghSignToType(sign: number): ManeuverType {
  if (sign === 0) return "straight";
  if (sign === 1) return "slight_right";
  if (sign === -1) return "slight_left";
  if (sign === 2) return "right";
  if (sign === -2) return "left";
  if (sign >= 2) return "right";
  if (sign <= -2) return "left";
  return "roundabout";
}

function routeGraphHopper(from: Coordinates, to: Coordinates): Promise<Route | null> {
  const url =
    `${GRAPHHOPPER_URL}?point=${from.latitude},${from.longitude}` +
    `&point=${to.latitude},${to.longitude}&vehicle=car&points_encoded=false&locale=id&instructions=true`;
  return fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const path = data?.paths?.[0];
      if (!path?.points?.coordinates?.length) return null;
      const coordinates: Coordinates[] = path.points.coordinates.map(
        ([longitude, latitude]: [number, number]) => ({ latitude, longitude }),
      );
      const cumulative = cumulativeDistances(coordinates);
      const instructions = path.instructions ?? [];
      const maneuvers: Maneuver[] = instructions.map(
        (step: { text: string; sign: number; interval: [number, number] }, idx: number) => {
          const coordIndex = Math.min(step.interval?.[0] ?? 0, coordinates.length - 1);
          const type: ManeuverType =
            idx === 0 ? "depart" : idx === instructions.length - 1 ? "arrive" : ghSignToType(step.sign);
          return {
            latitude: coordinates[coordIndex].latitude,
            longitude: coordinates[coordIndex].longitude,
            type,
            text: step.text ?? "",
            distanceAlong: cumulative[coordIndex],
          };
        },
      );
      return {
        coordinates,
        distance_m: Math.round(path.distance ?? 0),
        time_s: Math.round((path.time ?? 0) / 1000),
        source: "online" as const,
        maneuvers,
      };
    })
    .catch(() => null);
}

function routeValhalla(from: Coordinates, to: Coordinates): Promise<Route | null> {
  const body = JSON.stringify({
    locations: [
      { lat: from.latitude, lon: from.longitude },
      { lat: to.latitude, lon: to.longitude },
    ],
    costing: "auto",
  });
  return fetch(`${VALHALLA_URL}?json=${encodeURIComponent(body)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const leg = data?.trip?.legs?.[0];
      if (!leg) return null;
      const coordinates = decodeValhallaPolyline(leg.shape ?? "");
      const cumulative = cumulativeDistances(coordinates);
      const maneuvers: Maneuver[] = (leg.maneuvers ?? []).map(
        (m: { type: number; instruction: string; begin_shape_index: number }, idx: number, all: unknown[]) => {
          const coordIndex = Math.min(m.begin_shape_index ?? 0, coordinates.length - 1);
          const baseType: ManeuverType =
            m.type === 1 || m.type === 2 || m.type === 3 || m.type === 4 || m.type === 5 || m.type === 6
              ? "roundabout"
              : idx === 0
                ? "depart"
                : idx === all.length - 1
                  ? "arrive"
                  : "straight";
          return {
            latitude: coordinates[coordIndex].latitude,
            longitude: coordinates[coordIndex].longitude,
            type: baseType,
            text: m.instruction ?? "",
            distanceAlong: cumulative[coordIndex],
          };
        },
      );
      return {
        coordinates,
        distance_m: Math.round((leg.summary?.length ?? 0) * 1000),
        time_s: Math.round(leg.summary?.time ?? 0),
        source: "online" as const,
        maneuvers,
      };
    })
    .catch(() => null);
}

function straightLine(from: Coordinates, to: Coordinates): Route {
  const steps = 24;
  const coords: Coordinates[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  const distance_m = Math.round(haversine(from, to));
  return {
    coordinates: coords,
    distance_m,
    time_s: Math.round((distance_m / 6.5) * 60),
    source: "estimated",
    maneuvers: [],
  };
}

export async function computeRoute(from: Coordinates, to: Coordinates, online = true): Promise<Route> {
  if (online) {
    try {
      const vh = await routeValhalla(from, to);
      if (vh) {
        void writeCache(from, to, vh);
        return vh;
      }
    } catch {
      /* fall through */
    }
    try {
      const gh = await routeGraphHopper(from, to);
      if (gh) {
        void writeCache(from, to, gh);
        return gh;
      }
    } catch {
      /* fall through */
    }
  }

  const cached = await readCache(from, to);
  if (cached) return { ...cached, source: "cache" };

  return straightLine(from, to);
}

export function formatRoute(route: Route, copy: { km: string; min: string; estimated: string }): string {
  const km = (route.distance_m / 1000).toFixed(1);
  const min = Math.max(1, Math.round(route.time_s / 60));
  const base = `${km} ${copy.km} • ${min} ${copy.min}`;
  return route.source === "estimated" ? `${base} (${copy.estimated})` : base;
}

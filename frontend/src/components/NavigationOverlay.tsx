import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Copy } from "../i18n";
import { colors, radius, shadow } from "../theme";
import type { Coordinates, Incident } from "../types";
import {
  bearingTo,
  cumulativeDistances,
  projectOntoRoute,
  type ManeuverType,
  type Route,
} from "../services/routing";

const MANEUVER_TEXT: Record<ManeuverType, keyof Copy> = {
  depart: "navDepart",
  straight: "navStraight",
  slight_left: "navSlightLeft",
  left: "navLeft",
  slight_right: "navSlightRight",
  right: "navRight",
  roundabout: "navRoundabout",
  arrive: "navArrive",
};

const MANEUVER_ICON: Record<ManeuverType, string> = {
  depart: "navigation",
  straight: "arrow-up",
  slight_left: "arrow-up-left",
  left: "arrow-left",
  slight_right: "arrow-up-right",
  right: "arrow-right",
  roundabout: "rotate-right",
  arrive: "flag-checkered",
};

function formatDistance(meters: number, copy: Copy): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} ${copy.km}`;
  return `${Math.round(meters)} ${copy.m}`;
}

export function NavigationOverlay({
  route,
  incident,
  coordinates,
  copy,
  onExit,
  destinationName,
}: {
  route: Route;
  incident: Incident | null;
  coordinates: Coordinates | null;
  copy: Copy;
  onExit: () => void;
  destinationName?: string | null;
}) {
  const cumulative = useMemo(() => cumulativeDistances(route.coordinates), [route]);

  const projection = useMemo(
    () => (coordinates ? projectOntoRoute(route.coordinates, coordinates, cumulative) : null),
    [route, coordinates, cumulative],
  );

  const traveled = projection?.distanceAlong ?? 0;
  const remaining = Math.max(0, route.distance_m - traveled);
  const offRoute = projection
    ? projection.offRoute > 75 && route.source !== "estimated" && traveled > 20 && remaining > 20
    : false;

  const ordered = useMemo(
    () => [...route.maneuvers].sort((a, b) => a.distanceAlong - b.distanceAlong),
    [route],
  );

  const next = ordered.find((m) => m.distanceAlong > traveled + 5) ?? null;
  const nextIndex = next ? ordered.indexOf(next) : -1;
  const after = nextIndex >= 0 ? ordered[nextIndex + 1] ?? null : null;

  const distanceToNext = next ? Math.max(0, next.distanceAlong - traveled) : remaining;
  const remainingTime = route.distance_m > 0
    ? Math.max(1, Math.round((route.time_s * remaining) / route.distance_m / 60))
    : Math.max(1, Math.round(route.time_s / 60));

  const nextType: ManeuverType = next?.type ?? (remaining <= 10 ? "arrive" : "straight");
  const nextText = next ? copy[MANEUVER_TEXT[next.type]] : copy.navArrive;

  const destination = incident
    ? { latitude: incident.latitude, longitude: incident.longitude }
    : route.coordinates[route.coordinates.length - 1];
  const bearing = coordinates ? bearingTo(coordinates, destination) : 0;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={[styles.topBar, { backgroundColor: colors.surface }, shadow]} pointerEvents="auto">
        <Pressable onPress={onExit} style={styles.exit} hitSlop={10} testID="nav-exit-button">
          <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
          <Text style={styles.exitText}>{copy.navExit}</Text>
        </Pressable>
        <View style={styles.eta}>
          <Text style={styles.etaDistance}>{formatDistance(remaining, copy)}</Text>
          <Text style={styles.etaTime}>{remainingTime} {copy.min}</Text>
        </View>
        <MaterialCommunityIcons name="navigation-variant" size={22} color={colors.brand} />
      </View>

      {offRoute ? (
        <View style={[styles.offRoute, { backgroundColor: colors.warning }]} pointerEvents="auto">
          <MaterialCommunityIcons name="alert-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offRouteText}>{copy.navOffRoute}</Text>
        </View>
      ) : null}

      <View style={styles.spacer} pointerEvents="none" />

      <View style={[styles.card, { backgroundColor: colors.surface }, shadow]} pointerEvents="auto" testID="nav-card">
        <View style={[styles.iconWrap, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name={MANEUVER_ICON[nextType] as never} size={42} color="#FFFFFF" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.maneuver} numberOfLines={1}>{nextText}</Text>
          <Text style={styles.distance}>
            {copy.navIn} {formatDistance(distanceToNext, copy)}
          </Text>
          {after ? (
            <Text style={styles.then} numberOfLines={1}>
              {copy.navThen} {copy[MANEUVER_TEXT[after.type]]}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.destHint} pointerEvents="none">
        <MaterialCommunityIcons name="map-marker-alert" size={14} color={colors.inkSoft} />
        <Text style={styles.destText}>{destinationName ?? (incident ? copy[incident.incident_type] : copy.navDestination)}</Text>
      </View>

      <View style={[styles.direction, shadow]} pointerEvents="none">
        <MaterialCommunityIcons name="navigation" size={20} color={colors.brand} style={[{ transform: [{ rotate: `${bearing}deg` }] }]} />
        <Text style={styles.directionText}>{copy.navDestination} · {formatDistance(remaining, copy)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  exit: { flexDirection: "row", alignItems: "center", gap: 4 },
  exitText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  eta: { flex: 1, alignItems: "flex-end" },
  etaDistance: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  etaTime: { color: colors.inkSoft, fontSize: 12, fontWeight: "600" },
  offRoute: { position: "absolute", top: 68, left: 16, right: 16, height: 34, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  offRouteText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  spacer: { flex: 1 },
  card: { position: "absolute", left: 12, right: 12, bottom: 28, borderRadius: radius.extraLarge, flexDirection: "row", alignItems: "center", padding: 16, gap: 16 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  maneuver: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  distance: { color: colors.brand, fontSize: 16, fontWeight: "700", marginTop: 2 },
  then: { color: colors.inkSoft, fontSize: 13, fontWeight: "600", marginTop: 4 },
  destHint: { position: "absolute", bottom: 4, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  destText: { color: colors.inkSoft, fontSize: 11, fontWeight: "600" },
  direction: { position: "absolute", bottom: 150, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, ...shadow },
  directionText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
});

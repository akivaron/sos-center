import type { Incident, IncidentType } from "../types";

export type Cluster = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  incidents: Incident[];
  representative: IncidentType;
  hasCritical: boolean;
};

const WORLD_SIZE = 256;
const CELL_PX = 64;

function project(lng: number, lat: number, zoom: number): [number, number] {
  const scale = WORLD_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return [x, y];
}

const SEVERITY_RANK: Record<Incident["severity"], number> = { moderate: 0, high: 1, critical: 2 };

/**
 * Grid-clusters incidents in screen space for the given zoom level.
 * Nearby markers merge into a single bubble when zoomed out and split
 * apart automatically as the user zooms in.
 */
export function clusterIncidents(incidents: Incident[], zoom: number): Cluster[] {
  if (incidents.length === 0) return [];

  const buckets = new Map<string, Incident[]>();
  for (const incident of incidents) {
    const [x, y] = project(incident.longitude, incident.latitude, zoom);
    const key = `${Math.floor(x / CELL_PX)}:${Math.floor(y / CELL_PX)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(incident);
    else buckets.set(key, [incident]);
  }

  const clusters: Cluster[] = [];
  for (const [key, group] of buckets) {
    if (group.length === 1) {
      const only = group[0];
      clusters.push({
        id: only.id,
        latitude: only.latitude,
        longitude: only.longitude,
        count: 1,
        incidents: group,
        representative: only.incident_type,
        hasCritical: only.severity === "critical",
      });
      continue;
    }

    let latSum = 0;
    let lngSum = 0;
    let hasCritical = false;
    const severityCounts: Record<IncidentType, number> = { fire: 0, flood: 0, earthquake: 0, crash: 0, other: 0 };
    let topSeverity = group[0].severity;
    for (const item of group) {
      latSum += item.latitude;
      lngSum += item.longitude;
      if (item.severity === "critical") hasCritical = true;
      severityCounts[item.incident_type] += 1;
      if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[topSeverity]) topSeverity = item.severity;
    }
    let representative: IncidentType = "other";
    let max = -1;
    (Object.keys(severityCounts) as IncidentType[]).forEach((type) => {
      if (severityCounts[type] > max) {
        max = severityCounts[type];
        representative = type;
      }
    });

    clusters.push({
      id: `cluster:${key}`,
      latitude: latSum / group.length,
      longitude: lngSum / group.length,
      count: group.length,
      incidents: group,
      representative,
      hasCritical,
    });
  }

  return clusters;
}

export const CLUSTER_MAX_ZOOM = 16;

export function zoomForCluster(currentZoom: number): number {
  return Math.min(CLUSTER_MAX_ZOOM, Math.floor(currentZoom) + 2);
}

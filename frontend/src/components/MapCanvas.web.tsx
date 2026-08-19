import type { Coordinates, Incident } from "../types";
import { MapFallback } from "./MapFallback";

export default function MapCanvas(props: {
  incidents: Incident[];
  coordinates: Coordinates | null;
  onIncidentPress: (incident: Incident) => void;
}) {
  return <MapFallback {...props} />;
}
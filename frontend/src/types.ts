export type Language = "id" | "en";
export type TabKey = "map" | "reports" | "chat" | "profile";
export type IncidentType = "fire" | "flood" | "earthquake" | "crash" | "other";
export type Severity = "moderate" | "high" | "critical";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
};

export type Incident = {
  id: string;
  incident_type: IncidentType;
  severity: Severity;
  description: string;
  longitude: number;
  latitude: number;
  reporter_id: string;
  reporter_name: string;
  created_at: string;
  distance_meters?: number | null;
};

export type Coordinates = { latitude: number; longitude: number };

export type MeshMessage = {
  id: string;
  sender: string;
  body: string;
  createdAt: number;
  status: "queued" | "relayed" | "delivered";
  mine: boolean;
  ttl: number;
};

export type QueuedSOS = {
  client_event_id: string;
  longitude: number;
  latitude: number;
  message: string;
  network_state: string;
};
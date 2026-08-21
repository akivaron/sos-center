import Constants from "expo-constants";

import { Platform } from "react-native";

import type { AppNotification, Coordinates, FamilyCircle, Incident, IncidentType, LocalPhoto, Severity, SOSSignal, User } from "./types";

export interface BadgeStatsResponse {
  relays: number;
  relay_acks: number;
  mule_transfers: number;
  anchor_seconds: number;
  gateway_upload_events: number;
}

const configuredUrl = Constants.expoConfig?.extra?.backendUrl as string | undefined;
const baseUrl = configuredUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
let sessionToken: string | null = null;

export function setApiToken(token: string | null) {
  sessionToken = token;
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("<")) {
    throw new Error(`Server returned an HTML page instead of JSON (status ${response.status}). Is the API server running?`);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid JSON response from server (status ${response.status}).`);
  }
}

function formatDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item.msg === "string" ? item.msg : JSON.stringify(item)))
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const data = (await safeJson(response)) as { detail?: unknown } | null;
      detail = formatDetail(data?.detail);
    } catch {
      /* ignore parse errors on the error body */
    }
    throw new Error(detail ?? `Request failed (${response.status})`);
  }
  return (await safeJson(response)) as T;
}

export const api = {
  mediaUrl: (path?: string | null) => path ? (path.startsWith("http") ? path : `${baseUrl}${path}`) : null,
  exchangeSession: (sessionId: string) =>
    request<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),
  me: () => request<User>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  setPin: (pin: string) =>
    request<{ ok: boolean; pin_set: boolean }>("/auth/pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  getPrivacy: () => request<{ hide_gps: boolean; hide_mesh: boolean }>("/auth/privacy"),
  updatePrivacy: (input: { hide_gps?: boolean; hide_mesh?: boolean }) =>
    request<{ ok: boolean; hide_gps: boolean; hide_mesh: boolean }>("/auth/privacy", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
  register: (email: string, password: string, name?: string) =>
    request<{ session_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(name ? { email, password, name } : { email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ session_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  incidents: (coords?: Coordinates) => {
    const query = coords
      ? `?longitude=${coords.longitude}&latitude=${coords.latitude}&radius_meters=50000`
      : "";
    return request<Incident[]>(`/incidents${query}`);
  },
  createIncident: (input: {
    incident_type: IncidentType;
    severity: Severity;
    description: string;
    casualty_count: number;
    assistance_needed: string;
    photo_file_id?: string;
    longitude: number;
    latitude: number;
  }) => request<Incident>("/incidents", { method: "POST", body: JSON.stringify(input) }),
  updateIncident: (id: string, input: {
    incident_type?: IncidentType;
    severity?: Severity;
    description?: string;
    casualty_count?: number;
    assistance_needed?: string;
    photo_file_id?: string | null;
  }) => request<Incident>(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteIncident: (id: string) =>
    request<{ ok: boolean }>(`/incidents/${id}`, { method: "DELETE" }),
  uploadIncidentPhoto: async (photo: LocalPhoto) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(photo.uri)).blob();
      form.append("file", blob, photo.name);
    } else {
      form.append("file", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    }
    const response = await fetch(`${baseUrl}/api/uploads/incident-photo`, {
      method: "POST",
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      body: form,
    });
    if (!response.ok) {
      let detail: string | undefined;
      try {
        const data = (await safeJson(response)) as { detail?: string } | null;
        detail = data?.detail;
      } catch {
        /* ignore parse errors on the error body */
      }
      throw new Error(detail ?? `Upload failed (${response.status})`);
    }
    return (await safeJson(response)) as Promise<{ file_id: string; file_url: string }>;
  },
  sendSOS: (input: {
    client_event_id: string;
    longitude: number;
    latitude: number;
    message: string;
    network_state: string;
  }) => request<SOSSignal>("/sos", { method: "POST", body: JSON.stringify(input) }),
  nearbyAlerts: (coords: Coordinates, radiusMeters = 10000) =>
    request<{ incidents: Incident[]; sos_signals: SOSSignal[] }>(
      `/alerts/nearby?longitude=${coords.longitude}&latitude=${coords.latitude}&radius_meters=${radiusMeters}`,
    ),
  reportIncident: (id: string, input: { kind: "scam" | "real"; reason?: string; note?: string }) =>
    request<Incident>(`/incidents/${id}/reports`, { method: "POST", body: JSON.stringify(input) }),
  reportSOS: (id: string, input: { kind: "scam" | "real"; reason?: string; note?: string }) =>
    request<SOSSignal>(`/sos/${id}/reports`, { method: "POST", body: JSON.stringify(input) }),
  addIncidentPhoto: async (id: string, photo: LocalPhoto) => {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(photo.uri)).blob();
      form.append("file", blob, photo.name);
    } else {
      form.append("file", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    }
    const response = await fetch(`${baseUrl}/api/incidents/${id}/photos`, {
      method: "POST",
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      body: form,
    });
    if (!response.ok) {
      let detail: string | undefined;
      try {
        const data = (await safeJson(response)) as { detail?: string } | null;
        detail = data?.detail;
      } catch {
        /* ignore parse errors on the error body */
      }
      throw new Error(detail ?? `Upload failed (${response.status})`);
    }
    return (await safeJson(response)) as Incident;
  },
  addIncidentComment: (id: string, body: string, topic?: string) =>
    request<Incident>(`/incidents/${id}/discussion`, {
      method: "POST",
      body: JSON.stringify(topic ? { body, topic } : { body }),
    }),
  followIncident: (id: string) =>
    request<{ following: boolean; follower_count: number }>(`/incidents/${id}/follow`, { method: "POST" }),
  unfollowIncident: (id: string) =>
    request<{ following: boolean; follower_count: number }>(`/incidents/${id}/follow`, { method: "DELETE" }),
  incidentFollowStatus: (id: string) =>
    request<{ following: boolean; follower_count: number }>(`/incidents/${id}/follow`),
  getNotifications: () => request<AppNotification[]>("/notifications"),
  syncBadges: (stats: {
    relays: number;
    relayAcks: number;
    muleTransfers: number;
    anchorSeconds: number;
    gatewayUploads: number;
  }) =>
    request<{ ok: boolean; badges: BadgeStatsResponse }>("/badges/sync", {
      method: "POST",
      body: JSON.stringify({
        relays: stats.relays,
        relay_acks: stats.relayAcks,
        mule_transfers: stats.muleTransfers,
        anchor_seconds: stats.anchorSeconds,
        gateway_upload_events: stats.gatewayUploads,
      }),
    }),
  getBadges: () => request<BadgeStatsResponse>("/badges"),
  markNotificationsRead: (input: { ids?: string[]; all?: boolean }) =>
    request<{ ok: boolean; updated: number }>("/notifications/read", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  familyCircles: {
    mine: () => request<FamilyCircle[]>("/family-circles"),
    create: (name?: string) =>
      request<FamilyCircle>("/family-circles", {
        method: "POST",
        body: JSON.stringify(name ? { name } : {}),
      }),
    join: (inviteCode: string) =>
      request<FamilyCircle>("/family-circles/join", {
        method: "POST",
        body: JSON.stringify({ invite_code: inviteCode }),
      }),
    shareLocation: (input: {
      longitude: number;
      latitude: number;
      accuracy?: number | null;
      source?: "gps" | "mesh";
    }) => request<{ circles: string[] }>("/family-circles/location", { method: "POST", body: JSON.stringify(input) }),
    removeMember: (circleId: string, userId: string) =>
      request<{ ok: boolean; deleted: boolean }>(`/family-circles/${circleId}/members/${userId}`, { method: "DELETE" }),
  },
};
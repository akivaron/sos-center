import Constants from "expo-constants";

import { Platform } from "react-native";

import type { Coordinates, Incident, IncidentType, LocalPhoto, Severity, User } from "./types";

const configuredUrl = Constants.expoConfig?.extra?.backendUrl as string | undefined;
const baseUrl = configuredUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
let sessionToken: string | null = null;

export function setApiToken(token: string | null) {
  sessionToken = token;
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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  exchangeSession: (sessionId: string) =>
    request<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),
  me: () => request<User>("/auth/me"),
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
    photo_file_id: string;
    longitude: number;
    latitude: number;
  }) => request<Incident>("/incidents", { method: "POST", body: JSON.stringify(input) }),
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
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail ?? `Upload failed (${response.status})`);
    }
    return response.json() as Promise<{ file_id: string; file_url: string }>;
  },
  sendSOS: (input: {
    client_event_id: string;
    longitude: number;
    latitude: number;
    message: string;
    network_state: string;
  }) => request("/sos", { method: "POST", body: JSON.stringify(input) }),
};
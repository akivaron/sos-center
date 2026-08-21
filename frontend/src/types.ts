export type Language = "id" | "en";
export type TabKey = "map" | "reports" | "chat" | "profile";
export type IncidentType = "fire" | "flood" | "earthquake" | "crash" | "other";
export type Severity = "moderate" | "high" | "critical";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  pin_set?: boolean;
  hide_gps?: boolean;
  hide_mesh?: boolean;
};

export type ContributorPhoto = {
  file_id: string;
  photo_url?: string | null;
  contributor_id: string;
  contributor_name: string;
  created_at: string;
};

export type DiscussionPost = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  topic?: string;
};

export const DISCUSSION_CHANNELS = ["umum", "koordinasi", "info", "bantuan"] as const;
export type DiscussionChannel = (typeof DISCUSSION_CHANNELS)[number];

export type Incident = {
  id: string;
  incident_type: IncidentType;
  severity: Severity;
  description: string;
  casualty_count: number;
  assistance_needed: string;
  photo_file_id?: string | null;
  photo_url?: string | null;
  longitude: number;
  latitude: number;
  reporter_id: string;
  reporter_name: string;
  created_at: string;
  distance_meters?: number | null;
  community_reports?: CommunityReport[];
  contributor_photos?: ContributorPhoto[];
  discussion?: DiscussionPost[];
  verdict?: Verdict;
  scam_reports?: number;
  real_reports?: number;
  following?: boolean;
  follower_count?: number;
};

export type LocalPhoto = {
  uri: string;
  name: string;
  type: string;
};

export type ReportDraft = {
  incidentType: IncidentType;
  severity: Severity;
  description: string;
  casualtyCount: number;
  assistanceNeeded: string;
  photo?: LocalPhoto | null;
};

export type StoredDraft = {
  localId: string;
  incidentId?: string;
  draft: ReportDraft;
  created_at: string;
};

export type Coordinates = { latitude: number; longitude: number };

export type CommunityReport = {
  reporter_id: string;
  reporter_name: string;
  kind: "scam" | "real";
  reason: string;
  note: string;
  created_at: string;
};

export type Verdict = "unverified" | "likely_safe" | "suspicious" | "likely_scam";

export type MeshPeerState = "active" | "denied" | "disabled" | "unsupported" | "settings";

export type MeshPeer = {
  id: string;
  name: string;
  rssi: number;
  paired: boolean;
  online: boolean;
  lastSeen: number;
  /** True for locally simulated peers (web demo / responder). */
  simulated?: boolean;
  /** Transport that discovered this peer. */
  link?: "ble" | "wifi" | "sim";
};

export type MeshDelivery = "queued" | "relayed" | "sent" | "delivered" | "read" | "failed";

export type MeshMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string | null;
  body: string;
  createdAt: number;
  status: MeshDelivery;
  mine: boolean;
  encrypted: boolean;
  ttl: number;
  hop: number;
  /** System notice rather than a chat line (pairing, join, errors). */
  system?: boolean;
};

export type MeshConversation = {
  id: string;
  peerId: string | null;
  name: string;
  paired: boolean;
  encrypted: boolean;
  lastMessage: string;
  lastAt: number;
  unread: number;
  online: boolean;
};

export type QueuedSOS = {
  client_event_id: string;
  longitude: number;
  latitude: number;
  message: string;
  network_state: string;
};

export type SOSSignal = {
  id: string;
  client_event_id: string;
  sender_id: string;
  sender_name: string;
  longitude: number;
  latitude: number;
  message: string;
  network_state: string;
  status: string;
  created_at: string;
  community_reports?: CommunityReport[];
  verdict?: Verdict;
  scam_reports?: number;
  real_reports?: number;
  via_mesh?: boolean;
};

export type LocationSource = "gps" | "mesh";

export type PrivacySettings = {
  hide_gps: boolean;
  hide_mesh: boolean;
};

export type CircleLocation = {
  longitude: number;
  latitude: number;
  accuracy: number | null;
  source: LocationSource;
  updated_at: string;
};

export type FamilyMember = {
  user_id: string;
  name: string;
  role: "owner" | "member";
  joined_at: string;
  location: CircleLocation | null;
};

export type FamilyCircle = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string | null;
  created_at: string;
  members: FamilyMember[];
};

export type FamilyLocation = {
  user_id: string;
  name: string;
  location: CircleLocation;
};

export type SurvivalResourceType = "water" | "basecamp" | "shelter" | "food" | "camping" | "river" | "settlement";

export type SurvivalResource = {
  id: string;
  type: SurvivalResourceType;
  name: string;
  latitude: number;
  longitude: number;
  note?: string;
  distance_meters?: number | null;
};

export type NotificationKind =
  | "incident_update"
  | "incident_new"
  | "discussion"
  | "verdict"
  | "sos"
  | "system";

export type NotificationAction =
  | { type: "open_incident"; incidentId: string }
  | { type: "open_map" }
  | { type: "open_chat" }
  | { type: "none" };

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  incidentId?: string;
  incidentType?: IncidentType;
  action?: NotificationAction;
  read: boolean;
  created_at: string;
};
import { storage } from "@/src/utils/storage";

import type { AppNotification, IncidentType, NotificationAction, NotificationKind } from "../types";

const KEY = "resq-notifications";
const MAX_ITEMS = 100;

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: AppNotification[] | null = null;

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

async function readAll(): Promise<AppNotification[]> {
  if (cache) return cache;
  const raw = await storage.getItem<string>(KEY, "[]");
  try {
    const parsed = JSON.parse(raw ?? "[]") as AppNotification[];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function getNotifications(): Promise<AppNotification[]> {
  return readAll();
}

export async function pushNotification(input: {
  kind: NotificationKind;
  title: string;
  body: string;
  incidentId?: string;
  incidentType?: IncidentType;
  action?: NotificationAction;
}): Promise<AppNotification> {
  const notification: AppNotification = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title,
    body: input.body,
    incidentId: input.incidentId,
    incidentType: input.incidentType,
    action: input.action ?? { type: "none" },
    read: false,
    created_at: new Date().toISOString(),
  };
  const all = await readAll();
  const next = [notification, ...all].slice(0, MAX_ITEMS);
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  emit();
  return notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const all = await readAll();
  const next = all.map((item) => (item.id === id ? { ...item, read: true } : item));
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  emit();
}

export async function markAllNotificationsRead(): Promise<void> {
  const all = await readAll();
  const next = all.map((item) => ({ ...item, read: true }));
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  emit();
}

export async function clearNotifications(): Promise<void> {
  cache = [];
  await storage.setItem(KEY, "[]");
  emit();
}

export async function mergeServerNotifications(incoming: AppNotification[]): Promise<void> {
  if (incoming.length === 0) return;
  const all = await readAll();
  const byId = new Map(all.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing) {
      // Keep the merged (server-authoritative) version but preserve local read state
      // only when the server copy is unread and the local copy was already read.
      byId.set(item.id, { ...item, read: existing.read || item.read });
    } else {
      byId.set(item.id, item);
    }
  }
  const next = [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  ).slice(0, MAX_ITEMS);
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  emit();
}

export async function getUnreadCount(): Promise<number> {
  const all = await readAll();
  return all.filter((item) => !item.read).length;
}

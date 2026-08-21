import { storage } from "@/src/utils/storage";

import type { Incident, ReportDraft, StoredDraft } from "../types";

const DRAFTS_KEY = "resq-report-drafts";

export async function loadDrafts(): Promise<StoredDraft[]> {
  const raw = await storage.getItem<string>(DRAFTS_KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredDraft[]) : [];
  } catch {
    return [];
  }
}

export async function saveDraft(draft: StoredDraft): Promise<StoredDraft[]> {
  const drafts = await loadDrafts();
  const next = drafts.filter((item) => item.localId !== draft.localId);
  next.unshift(draft);
  await storage.setItem(DRAFTS_KEY, JSON.stringify(next));
  return next;
}

export async function removeDraft(localId: string): Promise<StoredDraft[]> {
  const drafts = (await loadDrafts()).filter((item) => item.localId !== localId);
  await storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  return drafts;
}

export function draftFromIncident(incident: Incident): ReportDraft {
  return {
    incidentType: incident.incident_type,
    severity: incident.severity,
    description: incident.description,
    casualtyCount: incident.casualty_count,
    assistanceNeeded: incident.assistance_needed,
    photo: null,
  };
}

export function newLocalId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

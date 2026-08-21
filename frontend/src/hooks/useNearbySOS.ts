import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api";
import { meshBus } from "../services/meshBus";
import type { Coordinates, SOSSignal } from "../types";

const RECENT_WINDOW_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 8000;

function isRecent(signal: SOSSignal): boolean {
  const created = new Date(signal.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created < RECENT_WINDOW_MS;
}

export function useNearbySOS({
  coordinates,
  network,
  currentUserId,
  enabled = true,
}: {
  coordinates: Coordinates | null;
  network: "online" | "weak" | "offline";
  currentUserId?: string;
  enabled?: boolean;
}) {
  const [queue, setQueue] = useState<SOSSignal[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((signal: SOSSignal) => {
    if (signal.sender_id && signal.sender_id === currentUserId) return;
    if (!isRecent(signal)) return;
    if (seenRef.current.has(signal.client_event_id)) return;
    seenRef.current.add(signal.client_event_id);
    setQueue((current) => {
      if (current.some((item) => item.client_event_id === signal.client_event_id)) return current;
      return [...current, signal];
    });
  }, [currentUserId]);

  // Poll the backend for nearby SOS signals (online path).
  useEffect(() => {
    if (!enabled || !coordinates || network !== "online") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await api.nearbyAlerts(coordinates);
        if (cancelled) return;
        for (const signal of data.sos_signals) enqueue(signal);
      } catch {
        /* keep polling; network blips are tolerable */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [coordinates, network, enabled, enqueue]);

  // Listen for SOS relayed over the local mesh (offline path).
  useEffect(() => {
    if (!enabled) return;
    meshBus.setSOSListener((payload) => enqueue(payload));
    return () => meshBus.setSOSListener(null);
  }, [enabled, enqueue]);

  const dismiss = useCallback((clientEventId: string) => {
    setQueue((current) => current.filter((item) => item.client_event_id !== clientEventId));
  }, []);

  return { queue, active: queue[0] ?? null, dismiss };
}

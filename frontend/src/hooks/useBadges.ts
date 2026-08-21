import { useCallback, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

import { api } from "@/src/api";
import {
  BADGE_DEFINITIONS,
  badgeLevel,
  loadBadgeStats,
  metricFor,
  recordGatewayUpload,
  type BadgeDefinition,
  type BadgeLevel,
  type BadgeStats,
} from "@/src/services/badgeStore";

export interface BadgeView extends BadgeDefinition {
  level: BadgeLevel;
  value: number;
}

export function useBadges(user: { user_id: string } | null) {
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    void loadBadgeStats().then(setStats);
  }, []);

  const sync = useCallback(async (current: BadgeStats): Promise<boolean> => {
    try {
      await api.syncBadges(current);
      setSyncedAt(Date.now());
      return true;
    } catch {
      return false;
    }
  }, []);

  // Sync local counters to the account profile whenever connectivity returns.
  useEffect(() => {
    if (!user) return;
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (!online) {
        wasOffline = true;
        return;
      }
      if (!wasOffline) return;
      wasOffline = false;
      void (async () => {
        const current = await loadBadgeStats();
        setStats(current);
        // Gateway Hero: this device is the bridge pushing offline mesh
        // activity online. Count it once per offline period, then sync.
        if (current.relays > 0 || current.muleTransfers > 0) {
          const updated = await recordGatewayUpload();
          setStats(updated);
          await sync(updated);
        } else {
          await sync(current);
        }
      })();
    });
    return () => unsubscribe();
  }, [sync, user]);

  const badges: BadgeView[] = stats
    ? BADGE_DEFINITIONS.map((def) => ({ ...def, level: badgeLevel(def, stats), value: metricFor(def.id, stats) }))
    : [];

  return { stats, badges, syncedAt, syncNow: () => (stats ? sync(stats) : Promise.resolve(false)) };
}

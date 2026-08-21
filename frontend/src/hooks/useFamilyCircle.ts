import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api";
import { meshBus } from "../services/meshBus";
import type { Coordinates, FamilyCircle, FamilyLocation, PrivacySettings, User } from "../types";

const SHARE_INTERVAL_MS = 15000;
const POLL_INTERVAL_MS = 20000;

type NetworkState = "online" | "weak" | "offline";

export function useFamilyCircle(
  user: User | null,
  network: NetworkState,
  coordinates: Coordinates | null,
  privacy?: PrivacySettings | null,
) {
  const [circles, setCircles] = useState<FamilyCircle[]>([]);
  const [meshLocations, setMeshLocations] = useState<Record<string, FamilyLocation>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const knownMemberIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setCircles([]);
      return;
    }
    try {
      const list = await api.familyCircles.mine();
      setCircles(list);
      const ids = new Set<string>();
      list.forEach((circle) => circle.members.forEach((member) => ids.add(member.user_id)));
      knownMemberIds.current = ids;
    } catch {
      /* keep whatever we already have; network may be unavailable */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, refresh]);

  // Share my location: GPS to the backend when reachable, and always relay a
  // mesh ping so nearby offline family can still see me. Respect the user's
  // privacy choices to hide either source from other people.
  useEffect(() => {
    if (!user || !coordinates || circles.length === 0) return;
    let active = true;
    const share = async () => {
      const online = network !== "offline";
      if (online && !privacy?.hide_gps) {
        try {
          await api.familyCircles.shareLocation({
            ...coordinates,
            accuracy: null,
            source: "gps",
          });
        } catch {
          /* queued on reconnect */
        }
      }
      if (!privacy?.hide_mesh) {
        try {
          await meshBus.broadcastLocation({
            user_id: user.user_id,
            name: user.name,
            longitude: coordinates.longitude,
            latitude: coordinates.latitude,
            accuracy: null,
            source: "mesh",
            updated_at: new Date().toISOString(),
          });
        } catch {
          /* mesh not active */
        }
      }
      if (active) setLoading(false);
    };
    void share();
    const timer = setInterval(() => void share(), SHARE_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, coordinates, network, circles.length, privacy?.hide_gps, privacy?.hide_mesh]);

  // Receive mesh-relayed locations, but only for members of our circles.
  useEffect(() => {
    const handler = (payload: {
      user_id: string;
      name: string;
      longitude: number;
      latitude: number;
      accuracy: number | null;
      source: "mesh";
      updated_at: string;
    }) => {
      if (!user || payload.user_id === user.user_id) return;
      if (!knownMemberIds.current.has(payload.user_id)) return;
      setMeshLocations((prev) => ({
        ...prev,
        [payload.user_id]: {
          user_id: payload.user_id,
          name: payload.name,
          location: {
            longitude: payload.longitude,
            latitude: payload.latitude,
            accuracy: payload.accuracy,
            source: "mesh",
            updated_at: payload.updated_at,
          },
        },
      }));
    };
    meshBus.setLocationListener(handler);
    return () => meshBus.setLocationListener(null);
  }, [user]);

  const createCircle = useCallback(async (name?: string) => {
    if (!user) throw new Error("signin");
    setLoading(true);
    setError(null);
    try {
      const circle = await api.familyCircles.create(name);
      setCircles((prev) => [circle, ...prev]);
      return circle;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "create_failed");
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const joinCircle = useCallback(async (code: string) => {
    if (!user) throw new Error("signin");
    setLoading(true);
    setError(null);
    try {
      const circle = await api.familyCircles.join(code);
      setCircles((prev) => [...prev.filter((item) => item.id !== circle.id), circle]);
      return circle;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "join_failed");
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const removeMember = useCallback(async (circleId: string, memberUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.familyCircles.removeMember(circleId, memberUserId);
      await refresh();
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "remove_failed");
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const familyLocations = useMemo<FamilyLocation[]>(() => {
    const merged: Record<string, FamilyLocation> = {};
    circles.forEach((circle) => circle.members.forEach((member) => {
      if (member.user_id === user?.user_id) return;
      if (member.location) {
        merged[member.user_id] = { user_id: member.user_id, name: member.name, location: member.location };
      }
    }));
    Object.entries(meshLocations).forEach(([uid, familyLocation]) => {
      const existing = merged[uid];
      if (!existing || new Date(familyLocation.location.updated_at) >= new Date(existing.location.updated_at)) {
        merged[uid] = familyLocation;
      }
    });
    return Object.values(merged);
  }, [circles, meshLocations, user?.user_id]);

  return { circles, familyLocations, loading, error, refresh, createCircle, joinCircle, removeMember };
}

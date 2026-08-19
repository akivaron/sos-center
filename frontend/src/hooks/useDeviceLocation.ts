import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Coordinates } from "../types";

export function useDeviceLocation() {
  const [permission, setPermission] = useState<Location.PermissionResponse | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);

  const locate = useCallback(async () => {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setCoordinates({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  }, []);

  useEffect(() => {
    const check = async () => {
      const current = await Location.getForegroundPermissionsAsync();
      setPermission(current);
      if (current.granted) await locate();
      setLoading(false);
    };
    void check();
  }, [locate]);

  const request = useCallback(async () => {
    setLoading(true);
    const current = await Location.getForegroundPermissionsAsync();
    const result = current.granted
      ? current
      : current.canAskAgain
        ? await Location.requestForegroundPermissionsAsync()
        : current;
    setPermission(result);
    if (result.granted) await locate();
    setLoading(false);
    return result;
  }, [locate]);

  return { permission, coordinates, loading, request, locate };
}
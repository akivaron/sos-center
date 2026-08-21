import { useEffect, useRef, useState } from "react";

import { useNotifications } from "../context/NotificationContext";
import { useNearbySOS } from "../hooks/useNearbySOS";
import { SOSAlert } from "./SOSAlert";
import { SOSDetailCard } from "./SOSDetailCard";
import type { Copy } from "../i18n";
import type { Coordinates, SOSSignal } from "../types";
import type { NetworkState } from "../hooks/useNetworkState";

export function SOSWatcher({
  coordinates,
  network,
  currentUserId,
  copy,
  onViewMap,
  onActiveChange,
}: {
  coordinates: Coordinates | null;
  network: NetworkState;
  currentUserId?: string;
  copy: Copy;
  onViewMap: () => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const { active, dismiss } = useNearbySOS({ coordinates, network, currentUserId });
  const notifications = useNotifications();
  const [detail, setDetail] = useState<SOSSignal | null>(null);
  const notifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (active && detail && detail.client_event_id !== active.client_event_id) setDetail(null);
  }, [active, detail]);

  useEffect(() => {
    if (active && notifiedId.current !== active.client_event_id) {
      notifiedId.current = active.client_event_id;
      notifications.push({
        kind: "sos",
        title: copy.notifSosTitle,
        body: active.via_mesh ? `${copy.sosAlertViaMesh}` : `${copy.sosAlertTitle}`,
        action: { type: "open_map" },
      });
    }
    if (!active) notifiedId.current = null;
  }, [active, copy, notifications]);

  useEffect(() => { onActiveChange?.(!!active); }, [active, onActiveChange]);

  if (!active) return null;

  if (detail) {
    return (
      <SOSDetailCard
        signal={detail}
        copy={copy}
        onClose={() => setDetail(null)}
        onViewMap={() => { setDetail(null); dismiss(active.client_event_id); onViewMap(); }}
        onReported={(updated) => setDetail(updated)}
      />
    );
  }

  return (
    <SOSAlert
      signal={active}
      coordinates={coordinates}
      copy={copy}
      onViewMap={() => { dismiss(active.client_event_id); onViewMap(); }}
      onOpenDetail={() => setDetail(active)}
      onClose={() => dismiss(active.client_event_id)}
    />
  );
}

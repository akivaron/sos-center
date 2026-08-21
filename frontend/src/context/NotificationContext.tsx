import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { AppNotification } from "../types";
import {
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  mergeServerNotifications,
  pushNotification,
  subscribeNotifications,
} from "../services/notificationStore";

type NotificationInput = {
  kind: AppNotification["kind"];
  title: string;
  body: string;
  incidentId?: string;
  incidentType?: AppNotification["incidentType"];
  action?: AppNotification["action"];
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  centerOpen: boolean;
  push: (input: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  openCenter: () => void;
  closeCenter: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [centerOpen, setCenterOpen] = useState(false);
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void getNotifications().then((items) => {
      if (active) setNotifications(items);
    });
    const unsubscribe = subscribeNotifications(() => {
      void getNotifications().then((items) => {
        if (active) setNotifications(items);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Sync server-side notifications (follower updates/discussions) into the local
  // inbox when an account is signed in.
  useEffect(() => {
    if (!userId) return;
    let active = true;

    const sync = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const items = await api.getNotifications();
        if (!active) return;
        await mergeServerNotifications(items);
      } catch {
        /* offline or unavailable; retry on next tick */
      } finally {
        inFlight.current = false;
      }
    };

    void sync();
    const interval = setInterval(() => void sync(), 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId]);

  const value = useMemo<NotificationContextValue>(() => {
    const unreadCount = notifications.filter((item) => !item.read).length;
    return {
      notifications,
      unreadCount,
      centerOpen,
      push: (input) => {
        void pushNotification(input);
      },
      markRead: (id) => {
        void markNotificationRead(id);
        void api.markNotificationsRead({ ids: [id] }).catch(() => undefined);
      },
      markAllRead: () => {
        void markAllNotificationsRead();
        void api.markNotificationsRead({ all: true }).catch(() => undefined);
      },
      clear: () => {
        void clearNotifications();
      },
      openCenter: () => setCenterOpen(true),
      closeCenter: () => setCenterOpen(false),
    };
  }, [notifications, centerOpen]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}

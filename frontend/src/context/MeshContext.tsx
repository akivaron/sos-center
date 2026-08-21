// Shares a single mesh-chat session across screens (map detector + chat) so a
// device discovered on one screen is visible on the other and the Bluetooth
// transport is only ever started once.

import { createContext, useContext, type ReactNode } from "react";

import type { User } from "../types";
import { useMeshChat, type MeshChatApi } from "../hooks/useMeshChat";

export type { MeshChatApi };

const MeshContext = createContext<MeshChatApi | null>(null);

export function MeshProvider({ user, children }: { user: User | null; children: ReactNode }) {
  const mesh = useMeshChat(user);
  return <MeshContext.Provider value={mesh}>{children}</MeshContext.Provider>;
}

export function useMesh(): MeshChatApi {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used within a MeshProvider");
  return ctx;
}

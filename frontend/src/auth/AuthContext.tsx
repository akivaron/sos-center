import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, setApiToken } from "../api";
import type { User } from "../types";
import { storage } from "../utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "resq-session-token";
const sentSessionIds = new Set<string>();

type AuthValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function sessionIdFromUrl(url?: string | null) {
  if (!url) return null;
  const match = url.match(/[?#&]session_id=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const capturedUrl = useRef<string | null>(null);

  const applySession = useCallback(async (result: { session_token: string; user: User }) => {
    await storage.secureSet(TOKEN_KEY, result.session_token);
    setApiToken(result.session_token);
    setUser(result.user);
    setIsGuest(false);
    setError(null);
  }, []);

  const exchange = useCallback(async (sessionId: string) => {
    if (sentSessionIds.has(sessionId)) return false;
    sentSessionIds.add(sessionId);
    try {
      const result = await api.exchangeSession(sessionId);
      await applySession(result);
      return true;
    } catch (reason) {
      sentSessionIds.delete(sessionId);
      setError(reason instanceof Error ? reason.message : "Authentication failed");
      return false;
    }
  }, [applySession]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      capturedUrl.current = url;
      const sessionId = sessionIdFromUrl(url);
      if (sessionId) void exchange(sessionId);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    const bootstrap = async () => {
      try {
        let callbackId: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          callbackId = sessionIdFromUrl(`${window.location.search}${window.location.hash}`);
        } else {
          callbackId = sessionIdFromUrl(await Linking.getInitialURL());
        }
        if (callbackId) {
          const success = await exchange(callbackId);
          if (success && Platform.OS === "web" && typeof window !== "undefined") {
            window.history.replaceState(window.history.state, "", window.location.pathname);
          }
          return;
        }
        const token = await storage.secureGet(TOKEN_KEY, null);
        if (typeof token === "string" && token) {
          setApiToken(token);
          try {
            setUser(await api.me());
          } catch {
            setApiToken(null);
            await storage.secureRemove(TOKEN_KEY);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
    return () => subscription.remove();
  }, [exchange]);

  const login = useCallback(async () => {
    setError(null);
    const redirectUrl = Platform.OS === "web"
      ? `${window.location.origin}/`
      : Linking.createURL("/");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.assign(authUrl);
      return;
    }
    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const resultUrl = result.type === "success" ? result.url : null;
      const fallbackUrl = resultUrl ?? capturedUrl.current ?? (await Linking.getInitialURL());
      const sessionId = sessionIdFromUrl(fallbackUrl);
      if (sessionId) await exchange(sessionId);
      else setError("Login dibatalkan / Sign-in cancelled");
    } finally {
      setLoading(false);
    }
  }, [exchange]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await applySession(await api.login(email, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed");
      throw reason;
    }
  }, [applySession]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      await applySession(await api.register(email, password, name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration failed");
      throw reason;
    }
  }, [applySession]);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    setApiToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setIsGuest(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, isGuest, login, loginWithEmail, register, continueAsGuest, logout }),
    [user, loading, error, isGuest, login, loginWithEmail, register, continueAsGuest, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
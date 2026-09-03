"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authSessionSchema, login as loginRequest, type AuthSession } from "@/lib/api/auth";

const STORAGE_KEY = "game-store-auth";

type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSession(readStoredSession());
      setIsReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      async login(username: string, password: string) {
        const nextSession = await loginRequest(username, password);
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      },
      logout() {
        window.sessionStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [isReady, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

function readStoredSession(): AuthSession | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed = authSessionSchema.safeParse(JSON.parse(stored));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // A malformed browser value is treated as an expired session.
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  return null;
}

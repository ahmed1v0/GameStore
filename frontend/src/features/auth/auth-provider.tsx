"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthSession } from "@/lib/api/auth-schemas";
import { getMe } from "@/lib/api/auth";
import {
  connectSessionChannel,
  getServerSession,
  getSession,
  getSessionNotice,
  loginSession,
  logoutSession,
  refreshSession,
  subscribeSession,
  updateSessionUser,
} from "./session-store";

type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  startupError: string | null;
  retrySession(): void;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    getServerSession,
  );
  const [isReady, setIsReady] = useState(false);
  const notice = useSyncExternalStore(
    subscribeSession,
    getSessionNotice,
    getServerSession,
  );
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let previousId = getSession()?.user.id;
    return subscribeSession(() => {
      const nextId = getSession()?.user.id;
      if (previousId !== nextId) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      previousId = nextId;
    });
  }, [queryClient]);

  useEffect(() => {
    const disconnect = connectSessionChannel();
    try {
      window.sessionStorage.removeItem("game-store-auth");
    } catch {
      /* Storage may be disabled. */
    }
    return disconnect;
  }, []);

  useEffect(() => {
    let active = true;
    void refreshSession()
      .then(() => {
        if (active) {
          setStartupError(null);
          setIsReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setStartupError(
            "Could not check your session. Check the connection and retry.",
          );
          setIsReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = () => {
      const current = getSession();
      if (current && document.visibilityState === "visible" && !checking) {
        checking = true;
        void getMe(current.access, controller.signal)
          .then(updateSessionUser)
          .catch(() => {})
          .finally(() => {
            checking = false;
          });
      }
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const logout = useCallback(async () => {
    setLogoutError(false);
    try {
      await logoutSession();
    } catch {
      setLogoutError(true);
    }
  }, []);
  const login = useCallback(async (username: string, password: string) => {
    setLogoutError(false);
    await loginSession(username, password);
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      startupError,
      retrySession() {
        setStartupError(null);
        setIsReady(false);
        setAttempt((value) => value + 1);
      },
      login,
      logout,
    }),
    [session, isReady, startupError, logout, login],
  );
  return (
    <AuthContext.Provider value={value}>
      {notice && !session && (
        <div
          role="status"
          className="bg-[var(--accent)]/10 p-4 text-center text-sm text-[var(--accent)]"
        >
          {notice}
        </div>
      )}
      {logoutError && (
        <div
          role="alert"
          className="bg-[var(--danger)]/15 p-4 text-center text-sm"
        >
          Server sign-out failed. Your browser session may return on reload.{" "}
          <button onClick={() => void logout()} className="font-bold underline">
            Retry sign out
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}

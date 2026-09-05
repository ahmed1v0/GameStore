"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

export type AuthStatus =
  | "initializing"
  | "authenticated"
  | "anonymous"
  | "unavailable";

type AuthContextValue = {
  session: AuthSession | null;
  status: AuthStatus;
  isReady: boolean;
  notice: string | null;
  startupError: string | null;
  retrySession(): void;
  revalidateSession(): Promise<void>;
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
  const notice = useSyncExternalStore(
    subscribeSession,
    getSessionNotice,
    getServerSession,
  );
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState(false);
  const revalidation = useRef<Promise<void> | null>(null);
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
    setStatus("initializing");
    void refreshSession()
      .then((next) => {
        if (!active) return;
        setStartupError(null);
        setStatus(next ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!active) return;
        setStartupError(
          "Could not check your session. Check the connection and retry.",
        );
        setStatus(getSession() ? "authenticated" : "unavailable");
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (session) {
      setStartupError(null);
      setStatus("authenticated");
      return;
    }
    setStatus((current) =>
      current === "authenticated" ? "anonymous" : current,
    );
  }, [session]);

  const revalidateSession = useCallback((): Promise<void> => {
    if (revalidation.current) return revalidation.current;
    const current = getSession();
    if (!current) return Promise.resolve();

    const operation = getMe(current.access)
      .then((user) => {
        updateSessionUser(user);
      })
      .catch(() => {
        // apiRequest handles confirmed authentication rejection. Network failures
        // preserve the current session and should not interrupt the user.
      })
      .finally(() => {
        if (revalidation.current === operation) revalidation.current = null;
      });
    revalidation.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") {
        void revalidateSession();
      }
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [revalidateSession]);

  const logout = useCallback(async () => {
    setLogoutError(false);
    try {
      await logoutSession();
    } catch {
      setLogoutError(true);
    } finally {
      setStatus("anonymous");
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLogoutError(false);
    await loginSession(username, password);
    setStatus("authenticated");
    setStartupError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      status,
      isReady: status !== "initializing",
      notice,
      startupError,
      retrySession() {
        setStartupError(null);
        setStatus("initializing");
        setAttempt((value) => value + 1);
      },
      revalidateSession,
      login,
      logout,
    }),
    [
      session,
      status,
      notice,
      startupError,
      revalidateSession,
      logout,
      login,
    ],
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

import {
  authSessionSchema,
  messageSchema,
  type AuthSession,
  type AuthUser,
} from "@/lib/api/auth-schemas";
import { ApiError, authPost } from "@/lib/api/transport";

export const SESSION_EXPIRED_NOTICE =
  "Your session expired. Sign in again to continue.";
export const PASSWORD_CHANGED_NOTICE =
  "Password changed. Sign in again on all devices.";

let session: AuthSession | null = null;
let sessionNotice: string | null = null;
let epoch = 0;
let requestController = new AbortController();
let refreshing: Promise<AuthSession | null> | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let localLock: Promise<unknown> = Promise.resolve();

export const getSession = () => session;
export const getSessionNotice = () => sessionNotice;
export const getEpoch = () => epoch;
export const getRequestSignal = () => requestController.signal;
export const getServerSession = () => null;

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function clearSession(notice: string | null = null) {
  epoch += 1;
  refreshing = null;
  requestController.abort();
  requestController = new AbortController();
  session = null;
  sessionNotice = notice;
  emit();
}

function setSession(next: AuthSession) {
  if (session && session.user.id !== next.user.id) clearSession();
  session = next;
  sessionNotice = null;
  emit();
}

export function updateSessionUser(user: AuthUser) {
  if (session?.user.id === user.id) setSession({ ...session, user });
}

export function connectSessionChannel() {
  if (typeof BroadcastChannel === "undefined") return () => {};
  channel = new BroadcastChannel("game-store-session");
  const current = channel;
  current.onmessage = (event: MessageEvent) => {
    if (event.data === "logout") {
      clearSession("You signed out in another tab.");
      return;
    }
    if (event.data === "login") {
      clearSession();
      void refreshSession().catch(() => {});
    }
  };
  return () => {
    current.close();
    if (channel === current) channel = null;
  };
}

async function sessionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("game-store-auth-cookie", operation);
  }
  // Server locking remains authoritative on browsers without Web Locks.
  const pending = localLock.then(operation, operation);
  localLock = pending.catch(() => {});
  return pending;
}

export function refreshSession(
  showExpiredNotice = false,
): Promise<AuthSession | null> {
  if (refreshing) return refreshing;
  const started = epoch;
  const operation = sessionLock(async () => {
    if (started !== epoch) return null;
    try {
      const next = await authPost("/auth/refresh", authSessionSchema);
      if (started !== epoch) return null;
      setSession(next);
      return next;
    } catch (error) {
      if (
        started === epoch &&
        error instanceof ApiError &&
        error.status === 401
      ) {
        clearSession(showExpiredNotice ? SESSION_EXPIRED_NOTICE : null);
      }
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  });
  refreshing = operation;
  void operation
    .finally(() => {
      if (refreshing === operation) refreshing = null;
    })
    .catch(() => {});
  return operation;
}

export async function loginSession(username: string, password: string) {
  clearSession();
  const started = epoch;
  await sessionLock(async () => {
    if (started !== epoch) return;
    const next = await authPost("/auth/login", authSessionSchema, {
      username,
      password,
    });
    if (started !== epoch) return;
    setSession(next);
    channel?.postMessage("login");
  });
}

export async function logoutSession() {
  clearSession();
  channel?.postMessage("logout");
  await sessionLock(() => authPost("/auth/logout", messageSchema));
}

export async function changeSessionPassword(body: Record<string, string>) {
  const started = epoch;
  return sessionLock(async () => {
    if (started !== epoch)
      throw new DOMException("Account changed", "AbortError");
    let current = getSession();
    if (!current) throw new ApiError("Sign in to continue.", 401, null);
    try {
      await authPost(
        "/auth/change-password",
        messageSchema,
        body,
        current.access,
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      try {
        current = await authPost("/auth/refresh", authSessionSchema);
      } catch (refreshError) {
        if (
          started === epoch &&
          refreshError instanceof ApiError &&
          refreshError.status === 401
        ) {
          clearSession(SESSION_EXPIRED_NOTICE);
        }
        throw refreshError;
      }
      if (started !== epoch)
        throw new DOMException("Account changed", "AbortError");
      await authPost(
        "/auth/change-password",
        messageSchema,
        body,
        current.access,
      );
    }
    if (started === epoch)
      clearSession(PASSWORD_CHANGED_NOTICE);
    channel?.postMessage("logout");
  });
}

export async function resetSessionPassword(body: Record<string, string>) {
  return sessionLock(async () => {
    const result = await authPost("/auth/reset-password", messageSchema, body);
    clearSession();
    channel?.postMessage("logout");
    return result;
  });
}

import type { ZodType } from "zod";
import {
  clearSession,
  getEpoch,
  getRequestSignal,
  getSession,
  refreshSession,
  SESSION_EXPIRED_NOTICE,
  updateSessionUser,
} from "@/features/auth/session-store";
import { userSchema } from "./auth-schemas";
import { ApiError, rawRequest } from "./transport";
export { ApiError } from "./transport";

type ApiRequestOptions<T> = {
  schema: ZodType<T>;
  accessToken?: string | null;
  init?: RequestInit;
};

export async function apiRequest<T>(
  path: string,
  { schema, accessToken, init }: ApiRequestOptions<T>,
): Promise<T> {
  const authenticated = Boolean(accessToken);
  const started = getEpoch();
  const signal = authenticated ? getRequestSignal() : undefined;
  const requestSignal =
    signal && init?.signal
      ? AbortSignal.any([signal, init.signal])
      : (signal ?? init?.signal);

  const request = (access?: string) => {
    const headers = new Headers(init?.headers);
    if (access) headers.set("Authorization", `Bearer ${access}`);
    return rawRequest(path, schema, {
      ...init,
      headers,
      signal: requestSignal,
    });
  };

  const ensureCurrent = () => {
    requestSignal?.throwIfAborted();
    if (authenticated && started !== getEpoch())
      throw new DOMException("Account changed", "AbortError");
  };

  try {
    const result = await request(
      authenticated ? (getSession()?.access ?? accessToken!) : undefined,
    );
    ensureCurrent();
    return result;
  } catch (error) {
    ensureCurrent();
    if (!authenticated || !(error instanceof ApiError)) throw error;

    if (error.status === 403 && path.startsWith("/admin/")) {
      const user = await rawRequest("/auth/me", userSchema, {
        headers: { Authorization: `Bearer ${getSession()?.access}` },
        signal,
      });
      ensureCurrent();
      updateSessionUser(user);
      throw error;
    }

    if (error.status !== 401) throw error;

    const next = await refreshSession(true);
    if (!next) throw error;
    ensureCurrent();

    try {
      // Only confirmed authentication rejection is retried, never a network failure.
      const result = await request(next.access);
      ensureCurrent();
      return result;
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401)
        clearSession(SESSION_EXPIRED_NOTICE);
      throw retryError;
    }
  }
}

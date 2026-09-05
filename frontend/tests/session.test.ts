import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ post: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/api/transport", async (original) => ({
  ...(await original<typeof import("@/lib/api/transport")>()),
  authPost: mocks.post,
  rawRequest: mocks.request,
}));

const user = {
  id: 1,
  username: "customer",
  email: "customer@example.com",
  role: "user" as const,
  is_active: true,
  is_superuser: false,
  email_verified: true,
  verification_required: true,
  email_verification_enabled: true,
  date_joined: "2026-09-05",
};
const session = { access: "access-one", user };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetModules();
  mocks.post.mockReset();
  mocks.request.mockReset();
});

describe("session lifecycle", () => {
  it("keeps the password-change confirmation visible after signing out", async () => {
    const store = await import("@/features/auth/session-store");
    mocks.post
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ detail: "Changed" });
    await store.refreshSession();
    await store.changeSessionPassword({
      current_password: "old",
      password: "new",
      password_confirm: "new",
    });
    expect(store.getSession()).toBeNull();
    expect(store.getSessionNotice()).toContain("Password changed");
  });
  it("restores through refresh without browser token storage", async () => {
    mocks.post.mockResolvedValue(session);
    const store = await import("@/features/auth/session-store");
    await store.refreshSession();
    expect(store.getSession()).toEqual(session);
    expect(mocks.post).toHaveBeenCalledWith("/auth/refresh", expect.anything());
    expect(sessionStorage.getItem("game-store-auth")).toBeNull();
    expect(localStorage.getItem("game-store-auth")).toBeNull();
  });

  it("shares one refresh for concurrent requests", async () => {
    const pending = deferred<typeof session>();
    mocks.post.mockReturnValue(pending.promise);
    const store = await import("@/features/auth/session-store");
    const first = store.refreshSession();
    const second = store.refreshSession();
    pending.resolve(session);
    expect(await first).toEqual(session);
    expect(await second).toEqual(session);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("uses a shared browser lock for cookie operations", async () => {
    const lock = vi.fn((_name: string, run: () => Promise<unknown>) => run());
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: lock },
    });
    mocks.post.mockResolvedValue(session);
    const store = await import("@/features/auth/session-store");
    await store.refreshSession();
    expect(lock).toHaveBeenCalledWith(
      "game-store-auth-cookie",
      expect.any(Function),
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
  });

  it("does not restore a session when logout wins a refresh race", async () => {
    const pending = deferred<typeof session>();
    mocks.post.mockImplementation((path: string) =>
      path === "/auth/refresh"
        ? pending.promise
        : Promise.resolve({ detail: "Signed out" }),
    );
    const store = await import("@/features/auth/session-store");
    const refresh = store.refreshSession();
    const logout = store.logoutSession();
    pending.resolve(session);
    await Promise.all([refresh, logout]);
    expect(store.getSession()).toBeNull();
  });

  it("clears locally even if server logout fails", async () => {
    mocks.post
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new TypeError("offline"));
    const store = await import("@/features/auth/session-store");
    await store.refreshSession();
    await expect(store.logoutSession()).rejects.toThrow("offline");
    expect(store.getSession()).toBeNull();
  });

  it("invalidates in-flight account requests and notifies cache subscribers", async () => {
    mocks.post.mockResolvedValue(session);
    const store = await import("@/features/auth/session-store");
    await store.refreshSession();
    const signal = store.getRequestSignal();
    const listener = vi.fn();
    const unsubscribe = store.subscribeSession(listener);
    store.clearSession();
    expect(signal.aborted).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("clears an expired refresh but preserves a network failure", async () => {
    const { ApiError } = await import("@/lib/api/transport");
    const store = await import("@/features/auth/session-store");
    mocks.post.mockResolvedValueOnce(session);
    await store.refreshSession();
    mocks.post.mockRejectedValueOnce(new TypeError("offline"));
    await expect(store.refreshSession()).rejects.toThrow("offline");
    expect(store.getSession()).toEqual(session);
    mocks.post.mockRejectedValueOnce(new ApiError("expired", 401, null));
    expect(await store.refreshSession()).toBeNull();
    expect(store.getSession()).toBeNull();
  });
});

describe("authenticated requests", () => {
  it("preserves the purchase key and payload when retrying after token refresh", async () => {
    const { ApiError } = await import("@/lib/api/transport");
    mocks.post.mockResolvedValue(session);
    mocks.request
      .mockRejectedValueOnce(new ApiError("expired", 401, null))
      .mockResolvedValueOnce({ id: 19 });
    const { purchaseProduct } = await import("@/lib/api/orders");
    const key = crypto.randomUUID();
    await purchaseProduct(7, "expired", key);
    expect(mocks.request).toHaveBeenCalledTimes(2);
    for (const [path, , init] of mocks.request.mock.calls) {
      expect(path).toBe("/orders");
      expect(init.headers.get("Idempotency-Key")).toBe(key);
      expect(init.body).toBe(JSON.stringify({ product_id: 7 }));
    }
    expect(mocks.request.mock.calls[1][2].headers.get("Authorization")).toBe("Bearer access-one");
  });
  it("refreshes once after a 401 and retries with the new access token", async () => {
    const { ApiError } = await import("@/lib/api/transport");
    mocks.post.mockResolvedValue(session);
    mocks.request
      .mockRejectedValueOnce(new ApiError("expired", 401, null))
      .mockResolvedValueOnce({ ok: true });
    const { apiRequest } = await import("@/lib/api/client");
    const response = await apiRequest("/products", {
      accessToken: "expired",
      schema: z.object({ ok: z.boolean() }),
    });
    expect(response.ok).toBe(true);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const headers = mocks.request.mock.calls[1][2].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-one");
  });

  it("does not retry a purchase on a network failure", async () => {
    mocks.request.mockRejectedValueOnce(new TypeError("network lost"));
    const { apiRequest } = await import("@/lib/api/client");
    await expect(
      apiRequest("/orders", {
        accessToken: "current",
        schema: z.object({}),
        init: { method: "POST" },
      }),
    ).rejects.toThrow("network lost");
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("rejects a response from a previous identity", async () => {
    const response = deferred<{ id: number }>();
    mocks.request.mockReturnValue(response.promise);
    const { apiRequest } = await import("@/lib/api/client");
    const store = await import("@/features/auth/session-store");
    const pending = apiRequest("/orders/1", {
      accessToken: "old",
      schema: z.object({ id: z.number() }),
    });
    store.clearSession();
    response.resolve({ id: 1 });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("updates the displayed role after an admin permission rejection", async () => {
    const { ApiError } = await import("@/lib/api/transport");
    const store = await import("@/features/auth/session-store");
    mocks.post.mockResolvedValue({
      ...session,
      user: { ...user, role: "admin" },
    });
    await store.refreshSession();
    mocks.request
      .mockRejectedValueOnce(new ApiError("forbidden", 403, null))
      .mockResolvedValueOnce(user);
    const { apiRequest } = await import("@/lib/api/client");
    await expect(
      apiRequest("/admin/users", {
        accessToken: "access",
        schema: z.object({}),
      }),
    ).rejects.toThrow("forbidden");
    expect(store.getSession()?.user.role).toBe("user");
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api/transport", async (original) => ({
  ...(await original<typeof import("@/lib/api/transport")>()),
  authPost: mocks.post,
}));

const user = {
  id: 1,
  username: "customer",
  email: "customer@example.com",
  role: "user" as const,
  is_active: true,
  is_superuser: false,
  email_verified: true,
  verification_required: false,
  email_verification_enabled: false,
  date_joined: "2026-09-05",
};

beforeEach(() => {
  vi.resetModules();
  mocks.post.mockReset();
});

describe("session-expiry notice", () => {
  it("distinguishes an expired active session from an anonymous startup", async () => {
    const { ApiError } = await import("@/lib/api/transport");
    const store = await import("@/features/auth/session-store");

    mocks.post.mockRejectedValueOnce(new ApiError("missing", 401, null));
    expect(await store.refreshSession()).toBeNull();
    expect(store.getSessionNotice()).toBeNull();

    mocks.post.mockResolvedValueOnce({ access: "access-one", user });
    await store.refreshSession();

    mocks.post.mockRejectedValueOnce(new ApiError("expired", 401, null));
    expect(await store.refreshSession(true)).toBeNull();
    expect(store.getSessionNotice()).toBe(store.SESSION_EXPIRED_NOTICE);
  });
});

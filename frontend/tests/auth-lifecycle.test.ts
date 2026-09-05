import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { loginUrl, safeReturnTo } from "@/features/auth/auth-navigation";
import { rawRequest } from "@/lib/api/transport";

describe("auth navigation", () => {
  it("preserves internal return destinations", () => {
    expect(safeReturnTo("/orders/42?from=cart")).toBe(
      "/orders/42?from=cart",
    );
    expect(loginUrl("/orders/42", "session-expired")).toBe(
      "/login?returnTo=%2Forders%2F42&reason=session-expired",
    );
  });

  it("rejects external, encoded external, and login-loop destinations", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/products");
    expect(safeReturnTo("//evil.example")).toBe("/products");
    expect(safeReturnTo("/%2Fevil.example")).toBe("/products");
    expect(safeReturnTo("/\\evil.example")).toBe("/products");
    expect(safeReturnTo("/login?returnTo=/admin")).toBe("/products");
  });
});

describe("auth throttling metadata", () => {
  it("exposes Retry-After seconds to the UI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Request was throttled." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "7",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      rawRequest("/auth/login", z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 7,
    });

    vi.unstubAllGlobals();
  });
});

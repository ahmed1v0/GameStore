import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { logoutSession } from "@/features/auth/session-store";
import { getMe } from "@/lib/api/auth";

vi.mock("@/lib/api/auth", () => ({ getMe: vi.fn() }));

vi.mock("@/lib/api/transport", async (original) => ({
  ...(await original<typeof import("@/lib/api/transport")>()),
  authPost: vi.fn(async (path: string) =>
    path === "/auth/refresh"
      ? {
          access: "access",
          user: { id: 1, username: "first-user", role: "user" },
        }
      : { detail: "Signed out" },
  ),
}));

function Identity() {
  return <p>{useAuth().session?.user.username ?? "Signed out"}</p>;
}

it("shares overlapping focus checks and cancels them when the provider unmounts", async () => {
  vi.mocked(getMe).mockImplementation(
    (_access, signal) =>
      new Promise((_resolve, reject) => {
        signal!.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Identity />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("first-user");
  fireEvent.focus(window);
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  expect(getMe).toHaveBeenCalledTimes(1);
  const signal = vi.mocked(getMe).mock.calls[0][1]!;
  view.unmount();
  expect(signal.aborted).toBe(true);
  client.clear();
});

it("clears cached receipts and legacy storage when signing out", async () => {
  sessionStorage.setItem("game-store-auth", "legacy-token");
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Identity />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("first-user");
  expect(sessionStorage.getItem("game-store-auth")).toBeNull();
  client.setQueryData(["order", 1, 123], { owner: 1 });
  await act(async () => {
    await logoutSession();
  });
  await waitFor(() =>
    expect(client.getQueryData(["order", 1, 123])).toBeUndefined(),
  );
  expect(screen.getByText("Signed out")).toBeInTheDocument();
});

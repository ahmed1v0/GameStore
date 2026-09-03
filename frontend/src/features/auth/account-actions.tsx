"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "./auth-provider";

export function AccountActions() {
  const { isReady, logout, session } = useAuth();
  const router = useRouter();

  if (!isReady || !session) {
    return null;
  }

  return (
    <button
      type="button"
      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[#46556e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      onClick={() => {
        logout();
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}

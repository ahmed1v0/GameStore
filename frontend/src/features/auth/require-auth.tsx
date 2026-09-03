"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-provider";

export function RequireAuth({ children }: Readonly<{ children: ReactNode }>) {
  const { isReady, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !session) {
      router.replace("/login");
    }
  }, [isReady, router, session]);

  if (!isReady || !session) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-[var(--muted)]" aria-live="polite">
        Checking your session…
      </main>
    );
  }

  return children;
}

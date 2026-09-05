"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-provider";

export function RequireAuth({
  children,
  admin = false,
}: Readonly<{ children: ReactNode; admin?: boolean }>) {
  const { isReady, session, startupError, retrySession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !session && !startupError) {
      router.replace("/login");
    }
  }, [isReady, router, session, startupError]);

  if (startupError && !session) {
    return (
      <main className="grid min-h-screen place-content-center gap-5 px-6">
        <p role="alert">{startupError}</p>
        <button onClick={retrySession} className="text-[var(--accent)]">
          Retry session check
        </button>
      </main>
    );
  }

  if (!isReady || !session) {
    return (
      <main
        className="grid min-h-screen place-items-center px-6 text-[var(--muted)]"
        aria-live="polite"
      >
        Checking your session…
      </main>
    );
  }

  if (admin && session.user.role !== "admin") {
    return (
      <main className="grid min-h-screen place-content-center gap-5 px-6">
        <h1 className="text-3xl font-bold">Access denied</h1>
        <p>Your account does not have administrator access.</p>
        <Link href="/products" className="text-[var(--accent)]">
          Back to catalog
        </Link>
      </main>
    );
  }
  return children;
}

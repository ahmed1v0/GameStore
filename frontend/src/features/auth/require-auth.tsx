"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { loginUrl } from "./auth-navigation";
import { useAuth } from "./auth-provider";
import {
  PASSWORD_CHANGED_NOTICE,
  SESSION_EXPIRED_NOTICE,
} from "./session-store";

export function RequireAuth({
  children,
  admin = false,
}: Readonly<{ children: ReactNode; admin?: boolean }>) {
  const { status, session, notice, startupError, retrySession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "anonymous" || session) return;
    const currentLocation = `${window.location.pathname}${window.location.search}`;
    const returnTo = notice === PASSWORD_CHANGED_NOTICE ? "/account" : currentLocation;
    router.replace(
      loginUrl(
        returnTo,
        notice === SESSION_EXPIRED_NOTICE ? "session-expired" : undefined,
      ),
    );
  }, [notice, router, session, status]);

  if (status === "unavailable" && !session) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-lg place-content-center gap-5 px-6 text-center">
        <h1 className="text-2xl font-bold">Unable to restore your session</h1>
        <p role="alert" className="text-[var(--muted)]">
          {startupError}
        </p>
        <button
          onClick={retrySession}
          className="font-semibold text-[var(--accent)]"
        >
          Retry session check
        </button>
      </main>
    );
  }

  if (status === "initializing" || !session) {
    return (
      <main
        className="mx-auto grid min-h-[50vh] max-w-lg place-content-center gap-3 px-6 text-center"
        aria-live="polite"
      >
        <div
          aria-hidden="true"
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
        />
        <p className="font-semibold">Restoring your session…</p>
        <p className="text-sm text-[var(--muted)]">
          This should only take a moment.
        </p>
      </main>
    );
  }

  if (admin && session.user.role !== "admin") {
    return (
      <main className="grid min-h-[60vh] place-content-center gap-5 px-6 text-center">
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

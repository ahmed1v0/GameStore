"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { StoreMark } from "@/components/store-mark";
import { ApiError } from "@/lib/api/client";
import { safeReturnTo } from "./auth-navigation";
import { useAuth } from "./auth-provider";
import { buttonClass, inputClass } from "./auth-styles";
import { PasswordField } from "./password-field";
import { useAuthCooldown } from "./use-auth-cooldown";

export function LoginForm() {
  const { status, login, session, notice } = useAuth();
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/products");
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { cooldownSeconds, captureCooldown } = useAuthCooldown();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = safeReturnTo(params.get("returnTo"));
    setReturnTo(destination);
    setRouteNotice(
      params.get("reason") === "session-expired"
        ? "Your session expired. Sign in again to continue."
        : null,
    );
    if (status === "authenticated" && session) {
      router.replace(destination);
    }
  }, [router, session, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace(returnTo);
    } catch (reason) {
      captureCooldown(reason);
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to reach the service. Please try again.",
      );
      setNeedsVerification(
        reason instanceof ApiError &&
          reason.details !== null &&
          typeof reason.details === "object" &&
          "code" in reason.details &&
          reason.details.code === "email_unverified",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitDisabled =
    isSubmitting || status === "initializing" || cooldownSeconds > 0;
  const submitLabel = isSubmitting
    ? "Signing in…"
    : cooldownSeconds > 0
      ? `Try again in ${cooldownSeconds}s`
      : status === "initializing"
        ? "Checking session…"
        : "Sign in";

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/25 sm:p-9">
        <StoreMark />
        <h1 className="mt-10 text-3xl font-bold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-base leading-7 text-[var(--muted)]">
          Sign in to browse items available in Jordan and Saudi Arabia.
        </p>

        {routeNotice && !notice && (
          <div
            role="status"
            className="mt-6 rounded-xl bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]"
          >
            {routeNotice}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Username</span>
            <input
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
            />
          </label>

          <PasswordField
            name="password"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? (
            <div
              role="alert"
              className="rounded-xl bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
            >
              <p>{error}</p>
              {needsVerification && (
                <Link
                  href="/resend-verification"
                  className="mt-3 inline-block font-semibold text-[var(--accent)]"
                >
                  Resend verification email
                </Link>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitDisabled}
            className={`${buttonClass} w-full`}
          >
            {submitLabel}
          </button>
        </form>
        <nav
          aria-label="Account links"
          className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--accent)]"
        >
          <Link href="/signup">Create account</Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </nav>
      </section>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { StoreMark } from "@/components/store-mark";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

export function LoginForm() {
  const { isReady, login, session } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && session) {
      router.replace("/products");
    }
  }, [isReady, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace("/products");
    } catch (reason) {
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

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Username</span>
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Password</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </label>

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
            disabled={isSubmitting || !isReady}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[#08120e] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
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

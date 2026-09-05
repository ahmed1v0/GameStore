"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { StoreMark } from "@/components/store-mark";
import {
  getAuthConfiguration,
  requestEmail,
  signup,
  verifyEmail,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { buttonClass, inputClass } from "./auth-styles";
import { PasswordField } from "./password-field";
import { changeSessionPassword, resetSessionPassword } from "./session-store";
import { useAuthCooldown } from "./use-auth-cooldown";

export { buttonClass, inputClass } from "./auth-styles";

export type AuthFormMode =
  | "signup"
  | "forgot"
  | "resend"
  | "verify"
  | "reset"
  | "change";

const content = {
  signup: [
    "Create your account",
    "Sign up to browse and purchase digital game items.",
    "Create account",
  ],
  forgot: [
    "Forgot your password?",
    "Enter your account email and we’ll send a reset link.",
    "Send reset link",
  ],
  resend: [
    "Verify your email",
    "Request a fresh verification link for your account.",
    "Send verification link",
  ],
  verify: [
    "Confirm your email",
    "Confirm that this email belongs to you to finish signing up.",
    "Verify email",
  ],
  reset: [
    "Choose a new password",
    "Use a strong password you haven’t used elsewhere.",
    "Reset password",
  ],
  change: [
    "Change password",
    "Changing your password signs you out on all devices.",
    "Change password",
  ],
} as const;

const invitationContent = [
  "Set your password",
  "Finish setting up your invited account with a password only you know.",
  "Finish account setup",
] as const;

export function AuthForm({
  mode,
  token = "",
  invitation = false,
}: Readonly<{
  mode: AuthFormMode;
  token?: string;
  invitation?: boolean;
}>) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupNeedsVerification, setSignupNeedsVerification] = useState(false);
  const [verificationEnabled, setVerificationEnabled] = useState<
    boolean | null
  >(null);
  const [configurationError, setConfigurationError] = useState(false);
  const { cooldownSeconds, captureCooldown } = useAuthCooldown();

  const verificationMode = mode === "verify" || mode === "resend";
  useEffect(() => {
    if (!verificationMode) return;
    let cancelled = false;
    getAuthConfiguration().then(
      (config) => {
        if (!cancelled)
          setVerificationEnabled(config.email_verification_enabled);
      },
      () => {
        if (!cancelled) setConfigurationError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [verificationMode]);

  const passwordMode =
    mode === "signup" || mode === "reset" || mode === "change";
  const needsToken = mode === "verify" || mode === "reset";
  const [title, description, action] =
    invitation && mode === "reset" ? invitationContent : content[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    setError(null);
    setFieldErrors({});

    if (passwordMode) {
      const parsed = z
        .object({
          password: z.string().min(8, "Use at least 8 characters."),
          password_confirm: z.string(),
        })
        .refine((value) => value.password === value.password_confirm, {
          path: ["password_confirm"],
          message: "Passwords do not match.",
        })
        .safeParse(values);
      if (!parsed.success) {
        setFieldErrors(
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              String(issue.path[0]),
              issue.message,
            ]),
          ),
        );
        return;
      }
    }

    setBusy(true);
    try {
      let detail: string;
      if (mode === "signup") {
        const result = await signup(values);
        detail = result.detail;
        setSignupNeedsVerification(result.verification_required);
      } else if (mode === "verify") {
        detail = (await verifyEmail(token)).detail;
      } else if (mode === "reset") {
        const result = await resetSessionPassword({ ...values, token });
        detail = invitation
          ? "Account setup complete. Sign in with your new password."
          : result.detail;
      } else if (mode === "change") {
        await changeSessionPassword(values);
        detail = "Password changed. Sign in again.";
      } else {
        detail = (await requestEmail(values.email, mode === "resend")).detail;
      }
      setMessage(detail);
    } catch (reason) {
      captureCooldown(reason);
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to reach the service. Please try again.",
      );
      if (
        reason instanceof ApiError &&
        reason.details &&
        typeof reason.details === "object"
      ) {
        const fields = Object.entries(reason.details).filter(
          ([key]) => key !== "detail",
        );
        setFieldErrors(
          Object.fromEntries(
            fields.map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(" ") : String(value),
            ]),
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function textField(
    name: string,
    label: string,
    type: "text" | "email",
    autoComplete: string,
  ) {
    return (
      <div className="block" key={name}>
        <label htmlFor={name} className="mb-2 block text-sm font-semibold">
          {label}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required
          maxLength={name === "username" ? 150 : 254}
          aria-invalid={Boolean(fieldErrors[name])}
          aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
          className={inputClass}
        />
        {fieldErrors[name] && (
          <span
            id={`${name}-error`}
            className="mt-2 block text-sm text-[var(--danger)]"
          >
            {fieldErrors[name]}
          </span>
        )}
      </div>
    );
  }

  const submitLabel = busy
    ? "Please wait…"
    : cooldownSeconds > 0
      ? `Try again in ${cooldownSeconds}s`
      : action;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/25 sm:p-9">
        <StoreMark />
        <h1 className="mt-10 text-3xl font-bold tracking-tight">{title}</h1>
        {(!verificationMode || verificationEnabled === true) && (
          <p className="mt-2 leading-7 text-[var(--muted)]">{description}</p>
        )}

        {verificationMode && verificationEnabled !== true ? (
          <p
            role={configurationError ? "alert" : "status"}
            className="mt-6 text-[var(--muted)]"
          >
            {configurationError
              ? "Unable to reach the service. Reload this page to try again."
              : verificationEnabled === false
                ? "Email verification is turned off. You can sign in to your account."
                : "Loading account settings…"}
          </p>
        ) : message ? (
          <div
            role="status"
            className="mt-6 rounded-xl bg-[var(--accent)]/10 p-4 text-[var(--accent)]"
          >
            {message}
          </div>
        ) : needsToken && !token ? (
          <p role="alert" className="mt-6 text-[var(--danger)]">
            This link is missing its token. Request a new link below.
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={submit}>
            {mode === "signup" &&
              textField("username", "Username", "text", "username")}
            {["signup", "forgot", "resend"].includes(mode) &&
              textField("email", "Email", "email", "email")}

            {mode === "change" && (
              <PasswordField
                name="current_password"
                label="Current password"
                autoComplete="current-password"
                error={fieldErrors.current_password}
              />
            )}

            {passwordMode && (
              <>
                <PasswordField
                  name="password"
                  label={invitation && mode === "reset" ? "Password" : "New password"}
                  autoComplete="new-password"
                  error={fieldErrors.password}
                />
                <p className="text-sm text-[var(--muted)]">
                  At least 8 characters. Avoid common passwords and personal
                  details.
                </p>
                <PasswordField
                  name="password_confirm"
                  label="Confirm password"
                  autoComplete="new-password"
                  error={fieldErrors.password_confirm}
                />
              </>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}

            <button
              className={`${buttonClass} w-full`}
              disabled={busy || cooldownSeconds > 0}
            >
              {submitLabel}
            </button>
          </form>
        )}

        {((mode === "signup" && message && signupNeedsVerification) ||
          (mode === "verify" &&
            verificationEnabled === true &&
            !message &&
            (!token || fieldErrors.token))) && (
          <p className="mt-5 text-sm text-[var(--muted)]">
            {mode === "signup"
              ? "Didn’t receive an email? "
              : "Need a fresh link? "}
            <Link
              href="/resend-verification"
              className="font-semibold text-[var(--accent)]"
            >
              Resend verification email
            </Link>
          </p>
        )}

        <nav
          aria-label="Account links"
          className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--accent)]"
        >
          <Link href="/login">Back to sign in</Link>
          {mode === "reset" && !message && (!token || error) && (
            <Link href="/forgot-password">Request a new reset link</Link>
          )}
          {mode === "change" && <Link href="/account">Back to account</Link>}
        </nav>
      </section>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { buttonClass } from "./auth-form";

export function AccountPage() {
  const { session } = useAuth();
  if (!session) return null;
  const { user } = session;
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <h1 className="text-3xl font-bold">Your account</h1>
      <dl className="my-8 space-y-5">
        <div>
          <dt className="text-sm text-[var(--muted)]">Username</dt>
          <dd className="mt-1 font-semibold">{user.username}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Email</dt>
          <dd className="mt-1 break-all font-semibold">
            {user.email || "No email set"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Role</dt>
          <dd className="mt-1 capitalize">{user.role}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Email status</dt>
          <dd className="mt-1">
            {user.email_verified
              ? "Verified"
              : user.verification_required
                ? "Verification required"
                : "Not verified — verification not required"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-5">
        <Link href="/account/change-password" className={buttonClass}>
          Change password
        </Link>
        {user.email_verification_enabled &&
          !user.email_verified &&
          user.email && (
            <Link href="/resend-verification" className="text-[var(--accent)]">
              Verify email
            </Link>
          )}
      </div>
    </section>
  );
}

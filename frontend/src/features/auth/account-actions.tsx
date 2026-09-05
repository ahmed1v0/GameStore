"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/features/cart/cart-provider";
import { useAuth } from "./auth-provider";

export function AccountActions() {
  const { status, logout, session } = useAuth();
  const router = useRouter();
  const { itemCount } = useCart();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isSigningOut) {
    return (
      <div role="status" className="text-sm text-[var(--muted)]">
        Signing out…
      </div>
    );
  }

  if (status === "initializing") {
    return (
      <div
        aria-label="Loading account"
        className="flex items-center gap-3"
        role="status"
      >
        <span className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
        <span className="h-8 w-20 animate-pulse rounded-lg bg-[var(--border)]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <nav
      aria-label="Your account"
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
    >
      <Link href="/cart" className="text-[var(--muted)] hover:text-white">
        Cart{itemCount > 0 ? ` (${itemCount})` : ""}
      </Link>
      <Link href="/account" className="font-semibold text-[var(--accent)]">
        {session.user.username} · {session.user.role}
      </Link>
      {session.user.role === "admin" && (
        <>
          <Link
            href="/admin/products"
            className="text-[var(--muted)] hover:text-white"
          >
            Manage products
          </Link>
          <Link
            href="/admin/users"
            className="text-[var(--muted)] hover:text-white"
          >
            Manage users
          </Link>
        </>
      )}
      <button
        type="button"
        disabled={isSigningOut}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[#46556e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={async () => {
          setIsSigningOut(true);
          await logout();
          router.replace("/login");
        }}
      >
        Sign out
      </button>
    </nav>
  );
}

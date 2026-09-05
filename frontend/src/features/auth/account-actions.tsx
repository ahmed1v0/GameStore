"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCart } from "@/features/cart/cart-provider";
import { useAuth } from "./auth-provider";

const navLinkClass =
  "rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

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
      <div aria-label="Loading account" className="flex items-center gap-3" role="status">
        <span className="h-4 w-16 animate-pulse rounded bg-[var(--border)]" />
        <span className="h-8 w-20 animate-pulse rounded-lg bg-[var(--border)]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap items-center justify-end gap-1.5">
      <Link href="/products" className={navLinkClass}>
        Catalog
      </Link>
      <Link href="/cart" className={navLinkClass}>
        Cart{itemCount > 0 ? ` (${itemCount})` : ""}
      </Link>
      {session.user.role === "admin" && (
        <>
          <Link href="/admin/products" className={navLinkClass}>
            Products
          </Link>
          <Link href="/admin/users" className={navLinkClass}>
            Users
          </Link>
        </>
      )}
      <Link
        href="/account"
        className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {session.user.username}
      </Link>
      <button
        type="button"
        disabled={isSigningOut}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
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

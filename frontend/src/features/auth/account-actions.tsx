"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "./auth-provider";
import { useCart } from "@/features/cart/cart-provider";

export function AccountActions() {
  const { isReady, logout, session } = useAuth();
  const router = useRouter();
  const { itemCount } = useCart();

  if (!isReady || !session) {
    return null;
  }

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
          <Link href="/admin/products" className="text-[var(--muted)] hover:text-white">
            Manage products
          </Link>
          <Link href="/admin/users" className="text-[var(--muted)] hover:text-white">
            Manage users
          </Link>
        </>
      )}
      <button
        type="button"
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[#46556e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={() => {
          void logout();
          router.replace("/login");
        }}
      >
        Sign out
      </button>
    </nav>
  );
}

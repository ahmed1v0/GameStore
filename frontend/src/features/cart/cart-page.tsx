"use client";

import Link from "next/link";

import { buttonClass } from "@/features/auth/auth-form";
import { useCart } from "./cart-provider";

const locationNames = { JO: "Jordan", SA: "Saudi Arabia" } as const;

export function CartPage() {
  const { items, removeItem, clear } = useCart();
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">Your selection</p>
      <h1 className="mt-3 text-4xl font-bold">Cart</h1>
      <p className="mt-3 text-[var(--muted)]">Review the digital items you have saved.</p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <h2 className="text-2xl font-bold">Your cart is empty</h2>
          <p className="mt-3 text-[var(--muted)]">Browse the catalog and add an item to get started.</p>
          <Link href="/products" className={`${buttonClass} mt-6 inline-block`}>Browse catalog</Link>
        </div>
      ) : (
        <>
          <div className="mt-10 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {items.map((item) => (
              <article key={item.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/products/${item.id}`} className="text-xl font-bold hover:text-[var(--accent)]">{item.title}</Link>
                  <p className="mt-1 text-sm text-[var(--muted)]">{locationNames[item.location]} · Item #{item.id}</p>
                </div>
                <div className="flex items-center justify-between gap-6 sm:justify-end">
                  <span className="font-bold">{item.price}</span>
                  <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="text-left text-sm font-semibold text-[var(--muted)] hover:text-white" onClick={clear}>Clear cart</button>
            <p className="text-xl font-bold">Total: {total.toFixed(2)}</p>
          </div>
        </>
      )}
    </section>
  );
}
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useAuth } from "@/features/auth/auth-provider";
import { AddToCartButton } from "@/features/cart/add-to-cart-button";
import { PurchaseButton } from "@/features/orders/purchase-button";
import { ApiError } from "@/lib/api/client";
import { getProduct } from "@/lib/api/products";
import { formatMoney } from "@/lib/money";

import { AdminProductEditor } from "./admin-product-editor";

export function ProductDetail({ productId }: Readonly<{ productId: number }>) {
  const { session } = useAuth();
  const product = useQuery({
    queryKey: ["product", session?.user.id, productId],
    queryFn: ({ signal }) => getProduct(productId, session!.access, signal),
    enabled: Boolean(session),
  });

  if (product.isPending) {
    return (
      <div aria-label="Loading product" className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 animate-pulse rounded-3xl bg-[var(--surface)]" />
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--surface)]" />
      </div>
    );
  }

  if (product.error instanceof ApiError && product.error.status === 404) {
    return <DetailMessage title="Item not found" message="This product may have been removed." />;
  }

  if (product.isError || !product.data) {
    return (
      <DetailMessage title="Could not load item" message="Check the API connection and try again." />
    );
  }

  return (
    <>
      <Link href="/products" className="text-sm font-semibold text-[var(--muted)] hover:text-white">
        ← Back to catalog
      </Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10">
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <span className="rounded-full border border-[var(--border)] bg-white/[0.025] px-3 py-1 font-medium">
              {product.data.location_name}
            </span>
            <span className="font-mono text-xs">Item #{product.data.id}</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {product.data.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            {product.data.description}
          </p>
        </article>

        <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            One-time price
          </p>
          <p className="mt-3 text-4xl font-bold tracking-tight">
            {formatMoney(product.data.price, product.data.currency, product.data.minor_unit)}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            Purchase creates a permanent receipt for this item, market, currency and price.
          </p>
          <PurchaseButton productId={product.data.id} />
          <AddToCartButton product={product.data} />
        </aside>
      </div>
      {session?.user.role === "admin" && <AdminProductEditor product={product.data} />}
    </>
  );
}

function DetailMessage({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-[var(--muted)]">{message}</p>
      <Link href="/products" className="mt-7 inline-block font-semibold text-[var(--accent)]">
        Return to catalog
      </Link>
    </div>
  );
}

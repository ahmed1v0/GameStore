import Link from "next/link";

import type { Product } from "@/lib/api/products";

export function ProductCard({ product }: Readonly<{ product: Product }>) {
  return (
    <article className="group flex min-h-64 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="rounded-full border border-[var(--border)] bg-white/[0.025] px-3 py-1 font-medium text-[var(--muted)]">
          {product.location_name}
        </span>
        <span className="font-mono text-xs text-[var(--muted)]">#{product.id}</span>
      </div>
      <h2 className="mt-7 text-2xl font-bold leading-tight tracking-tight">{product.title}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
        {product.description}
      </p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
        <p>
          <span className="block text-xs uppercase tracking-wider text-[var(--muted)]">Price</span>
          <span className="mt-1 block text-xl font-bold">
            {product.price} <span className="text-sm text-[var(--muted)]">{product.currency}</span>
          </span>
        </p>
        <Link
          href={`/products/${product.id}`}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0b0f18] transition group-hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          View item
        </Link>
      </div>
    </article>
  );
}

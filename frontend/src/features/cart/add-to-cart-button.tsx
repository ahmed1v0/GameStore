"use client";

import type { Product } from "@/lib/api/products";
import { useCart } from "./cart-provider";

export function AddToCartButton({ product }: Readonly<{ product: Product }>) {
  const { addItem, hasItem } = useCart();
  const added = hasItem(product.id);

  return (
    <button
      type="button"
      disabled={added}
      onClick={() => addItem(product)}
      className="mt-3 w-full rounded-xl border border-[var(--border)] px-4 py-3.5 font-bold text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-default disabled:border-[var(--accent)] disabled:text-[var(--accent)]"
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
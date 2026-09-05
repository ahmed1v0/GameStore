"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { getProducts, getRegions, type ProductLocation } from "@/lib/api/products";

import { ProductCard } from "./product-card";

const PAGE_SIZE = 12;

export function ProductCatalog() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState<ProductLocation | "">("");

  const regions = useQuery({
    queryKey: ["regions", session?.user.id],
    queryFn: ({ signal }) => getRegions(session!.access, signal),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  const products = useQuery({
    queryKey: ["products", session?.user.id, page, PAGE_SIZE, location],
    queryFn: ({ signal }) =>
      getProducts({
        accessToken: session!.access,
        page,
        pageSize: PAGE_SIZE,
        location,
        signal,
      }),
    enabled: Boolean(session),
    placeholderData: (previous, query) =>
      query?.queryKey[1] === session?.user.id && query?.queryKey[4] === location
        ? keepPreviousData(previous)
        : undefined,
  });

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Catalog
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Digital game items
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
            Browse region-specific cosmetics, map packs, and profile collectibles with prices in
            each market&apos;s settlement currency.
          </p>
        </div>

        <label className="w-full sm:w-56">
          <span className="mb-2 block text-sm font-semibold">Available in</span>
          <select
            value={location}
            disabled={regions.isPending || regions.isError}
            onChange={(event) => {
              setLocation(event.target.value as ProductLocation | "");
              setPage(1);
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60"
          >
            <option value="">All locations</option>
            {regions.data?.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {products.isFetching && !products.isPending && (
        <p role="status" className="mt-6 text-sm text-[var(--muted)]">
          Loading requested page…
        </p>
      )}
      <CatalogResults
        isLoading={products.isPending}
        isError={products.isError}
        products={products.data?.results ?? []}
      />

      {products.data && products.data.count > 0 ? (
        <nav
          className="mt-10 flex items-center justify-between border-t border-[var(--border)] pt-6"
          aria-label="Product pagination"
        >
          <button
            type="button"
            disabled={!products.data.previous || products.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-[var(--muted)]">
            {products.isPlaceholderData ? "Loading page" : "Page"}{" "}
            <span className="font-semibold text-white">{page}</span> · {products.data.count} items
          </p>
          <button
            type="button"
            disabled={!products.data.next || products.isFetching}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </>
  );
}

type CatalogResultsProps = {
  isLoading: boolean;
  isError: boolean;
  products: Awaited<ReturnType<typeof getProducts>>["results"];
};

function CatalogResults({ isError, isLoading, products }: CatalogResultsProps) {
  if (isLoading) {
    return (
      <div
        className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading products"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="mt-10 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-6 text-[var(--danger)]"
      >
        Products could not be loaded. Check the API connection and try again.
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
        No products are available for this location.
      </div>
    );
  }

  return (
    <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

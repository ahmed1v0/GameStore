"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass, inputClass } from "@/features/auth/auth-form";
import { createProduct, getProducts, getRegions, type ProductInput } from "@/lib/api/products";

const PAGE_SIZE = 10;

const emptyProduct: ProductInput = {
  title: "",
  description: "",
  price: "0.00",
  location: "JO",
};

export function AdminProducts() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const regions = useQuery({
    queryKey: ["regions", session?.user.id],
    queryFn: ({ signal }) => getRegions(session!.access, signal),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  const products = useQuery({
    queryKey: ["admin-products", session?.user.id, page, PAGE_SIZE],
    queryFn: ({ signal }) =>
      getProducts({
        accessToken: session!.access,
        page,
        pageSize: PAGE_SIZE,
        location: "",
        signal,
      }),
    enabled: Boolean(session),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: () => createProduct(session!.access, form),
    onSuccess: () => {
      setMessage("Product added.");
      setForm(emptyProduct);
      setPage(1);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    mutation.mutate();
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Products</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Add catalog items and review the current inventory from one screen.
          </p>
        </div>
        {products.data && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-right">
            <span className="block text-xs uppercase tracking-wider text-[var(--muted)]">
              Catalog size
            </span>
            <span className="mt-1 block text-xl font-bold">{products.data.count}</span>
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl shadow-black/10 sm:grid-cols-2 sm:p-6"
      >
        <div className="sm:col-span-2">
          <h2 className="text-lg font-bold">Add new item</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            New items appear in the list below after they are saved.
          </p>
        </div>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Title</span>
          <input
            className={inputClass}
            value={form.title}
            maxLength={255}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-semibold">Price</span>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
            required
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-semibold">Location</span>
          <select
            className={inputClass}
            value={form.location}
            disabled={regions.isPending || regions.isError}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value as ProductInput["location"] })
            }
          >
            {regions.data?.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name} · {region.currency_code}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Description</span>
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className={buttonClass} disabled={mutation.isPending || regions.isError}>
            {mutation.isPending ? "Adding…" : "Add product"}
          </button>
          {message && (
            <p role="status" className="text-sm font-semibold text-[var(--accent)]">
              {message}
            </p>
          )}
          {regions.isError && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              Region reference data could not be loaded.
            </p>
          )}
          {mutation.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {mutation.error.message}
            </p>
          )}
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Product list</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Select an item to review or edit its details.
            </p>
          </div>
          {products.isFetching && !products.isPending && (
            <span role="status" className="text-sm text-[var(--muted)]">
              Refreshing…
            </span>
          )}
        </div>

        {products.isPending ? (
          <div className="mt-5 space-y-3" aria-label="Loading products">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        ) : products.isError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-5 text-sm text-[var(--danger)]"
          >
            Products could not be loaded. Refresh the page and try again.
          </div>
        ) : products.data.results.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No products have been added yet.
          </div>
        ) : (
          <>
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_6rem] gap-4 border-b border-[var(--border)] bg-white/[0.025] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] md:grid">
                <span>Item</span>
                <span>Location</span>
                <span>Price</span>
                <span className="text-right">Action</span>
              </div>
              {products.data.results.map((product) => (
                <div
                  key={product.id}
                  className="grid gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_10rem_10rem_6rem] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Item #{product.id}</p>
                  </div>
                  <span className="text-sm text-[var(--muted)]">{product.location_name}</span>
                  <span className="font-mono text-sm font-semibold">
                    {product.price} {product.currency}
                  </span>
                  <Link
                    href={`/products/${product.id}`}
                    className="justify-self-start rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--border-strong)] hover:text-white md:justify-self-end"
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>

            <nav
              aria-label="Admin product pagination"
              className="mt-5 flex items-center justify-between gap-4"
            >
              <button
                type="button"
                disabled={!products.data.previous || products.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-semibold transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--muted)]">Page {page}</span>
              <button
                type="button"
                disabled={!products.data.next || products.isFetching}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-semibold transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}

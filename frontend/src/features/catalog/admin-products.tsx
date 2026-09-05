"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass, inputClass } from "@/features/auth/auth-form";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getRegions,
  type ProductInput,
} from "@/lib/api/products";
import { formatMoney, moneyInputStep } from "@/lib/money";

const PAGE_SIZE = 10;

const emptyProduct: ProductInput = {
  title: "",
  description: "",
  price: "0.000",
  location: "JO",
};

export function AdminProducts() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [page, setPage] = useState(1);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: () => createProduct(session!.access, form),
    onSuccess: () => {
      setCreateMessage("Product added.");
      setForm(emptyProduct);
      setPage(1);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(productId, session!.access),
    onSuccess: (_result, productId) => {
      setCatalogMessage("Product deleted.");
      void queryClient.removeQueries({ queryKey: ["product"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });

      if (products.data?.results.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }

      queryClient.setQueryData(["deleted-product", productId], true);
    },
  });

  const selectedRegion = regions.data?.find((region) => region.code === form.location);
  const priceStep = moneyInputStep(selectedRegion?.minor_unit ?? 3);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);
    createMutation.mutate();
  }

  function confirmDelete(productId: number, title: string) {
    const confirmed = window.confirm(
      `Delete “${title}”? This action cannot be undone. Products with purchase history are protected.`,
    );
    if (!confirmed) return;

    setCatalogMessage(null);
    deleteMutation.mutate(productId);
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
          <span className="mb-2 block text-sm font-semibold">
            Price{selectedRegion ? ` (${selectedRegion.currency_code})` : ""}
          </span>
          <input
            className={inputClass}
            type="number"
            min="0"
            step={priceStep}
            inputMode="decimal"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
            required
          />
          {selectedRegion && (
            <span className="mt-1.5 block text-xs text-[var(--muted)]">
              Up to {selectedRegion.minor_unit} decimal places.
            </span>
          )}
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
          <button className={buttonClass} disabled={createMutation.isPending || regions.isError}>
            {createMutation.isPending ? "Adding…" : "Add product"}
          </button>
          {createMessage && (
            <p role="status" className="text-sm font-semibold text-[var(--accent)]">
              {createMessage}
            </p>
          )}
          {regions.isError && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              Region reference data could not be loaded.
            </p>
          )}
          {createMutation.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {createMutation.error.message}
            </p>
          )}
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Product list</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Edit items or remove products that have no purchase history.
            </p>
          </div>
          {products.isFetching && !products.isPending && (
            <span role="status" className="text-sm text-[var(--muted)]">
              Refreshing…
            </span>
          )}
        </div>

        {catalogMessage && (
          <p role="status" className="mt-4 text-sm font-semibold text-[var(--accent)]">
            {catalogMessage}
          </p>
        )}
        {deleteMutation.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
          >
            {deleteMutation.error.message}
          </p>
        )}

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
              <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_12rem] gap-4 border-b border-[var(--border)] bg-white/[0.025] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] md:grid">
                <span>Item</span>
                <span>Location</span>
                <span>Price</span>
                <span className="text-right">Actions</span>
              </div>
              {products.data.results.map((product) => {
                const isDeleting =
                  deleteMutation.isPending && deleteMutation.variables === product.id;

                return (
                  <div
                    key={product.id}
                    className="grid gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_10rem_10rem_12rem] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Item #{product.id}</p>
                    </div>
                    <span className="text-sm text-[var(--muted)]">{product.location_name}</span>
                    <span className="font-mono text-sm font-semibold">
                      {formatMoney(product.price, product.currency, product.minor_unit)}
                    </span>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Link
                        href={`/products/${product.id}`}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--border-strong)] hover:text-white"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => confirmDelete(product.id, product.title)}
                        className="rounded-lg border border-[var(--danger)]/40 px-3 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
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

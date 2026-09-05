"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass } from "@/features/auth/auth-form";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getRegions,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/api/products";
import { formatMoney } from "@/lib/money";

import { DeleteProductModal, ProductMutationModal } from "./product-modals";

const PAGE_SIZE = 10;

type ActiveModal =
  | { mode: "create" }
  | { mode: "edit"; product: Product }
  | { mode: "delete"; product: Product }
  | null;

export function AdminProducts() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
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
    mutationFn: (input: ProductInput) => createProduct(session!.access, input),
    onSuccess: () => {
      setActiveModal(null);
      setCatalogMessage("Product added successfully.");
      setPage(1);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, input }: { productId: number; input: ProductInput }) =>
      updateProduct(productId, session!.access, input),
    onSuccess: (updated) => {
      setActiveModal(null);
      setCatalogMessage("Product updated successfully.");
      queryClient.setQueryData(["product", session?.user.id, updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(productId, session!.access),
    onSuccess: (_result, productId) => {
      setActiveModal(null);
      setCatalogMessage("Product deleted successfully.");
      queryClient.removeQueries({ queryKey: ["product", session?.user.id, productId] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });

      if (products.data?.results.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
    },
  });

  const mutationBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const editProduct = activeModal?.mode === "edit" ? activeModal.product : null;
  const deleteTarget = activeModal?.mode === "delete" ? activeModal.product : null;

  function openCreate() {
    createMutation.reset();
    setCatalogMessage(null);
    setActiveModal({ mode: "create" });
  }

  function openEdit(product: Product) {
    updateMutation.reset();
    setCatalogMessage(null);
    setActiveModal({ mode: "edit", product });
  }

  function openDelete(product: Product) {
    deleteMutation.reset();
    setCatalogMessage(null);
    setActiveModal({ mode: "delete", product });
  }

  function closeModal() {
    if (!mutationBusy) setActiveModal(null);
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Products</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Manage catalog items from one workspace. Add, edit, and delete actions open in focused dialogs.
          </p>
        </div>
        {products.data && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-right">
            <span className="block text-xs uppercase tracking-wider text-[var(--muted)]">Catalog size</span>
            <span className="mt-1 block text-xl font-bold">{products.data.count}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">Catalog controls</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create a new item without leaving the product list.
          </p>
        </div>
        <button type="button" className={`${buttonClass} shrink-0`} onClick={openCreate}>
          + Add product
        </button>
      </div>

      {catalogMessage && (
        <div
          role="status"
          className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent)]"
        >
          {catalogMessage}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Product list</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Edit details inline through a modal, or safely remove unpurchased items.
            </p>
          </div>
          {products.isFetching && !products.isPending && (
            <span role="status" className="text-sm text-[var(--muted)]">Refreshing…</span>
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
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <p className="font-semibold">No products yet</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Create the first catalog item to get started.</p>
            <button type="button" className={`${buttonClass} mt-5`} onClick={openCreate}>
              Add product
            </button>
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
              {products.data.results.map((product) => (
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
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--border-strong)] hover:bg-white/[0.025]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(product)}
                      className="rounded-lg border border-[var(--danger)]/40 px-3 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <nav aria-label="Admin product pagination" className="mt-5 flex items-center justify-between gap-4">
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

      <ProductMutationModal
        open={activeModal?.mode === "create" || activeModal?.mode === "edit"}
        mode={activeModal?.mode === "edit" ? "edit" : "create"}
        product={editProduct}
        regions={regions.data}
        regionsPending={regions.isPending}
        regionsError={regions.isError}
        pending={activeModal?.mode === "edit" ? updateMutation.isPending : createMutation.isPending}
        error={
          activeModal?.mode === "edit"
            ? updateMutation.error?.message
            : createMutation.error?.message
        }
        onClose={closeModal}
        onSubmit={(input) => {
          if (activeModal?.mode === "edit") {
            updateMutation.mutate({ productId: activeModal.product.id, input });
          } else if (activeModal?.mode === "create") {
            createMutation.mutate(input);
          }
        }}
      />

      <DeleteProductModal
        open={activeModal?.mode === "delete"}
        product={deleteTarget}
        pending={deleteMutation.isPending}
        error={deleteMutation.error?.message}
        onClose={closeModal}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </section>
  );
}

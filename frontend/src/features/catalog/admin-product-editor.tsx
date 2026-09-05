"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import {
  deleteProduct,
  getRegions,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/api/products";

import { DeleteProductModal, ProductMutationModal } from "./product-modals";

export function AdminProductEditor({ product }: Readonly<{ product: Product }>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<"edit" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const regions = useQuery({
    queryKey: ["regions", session?.user.id],
    queryFn: ({ signal }) => getRegions(session!.access, signal),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (input: ProductInput) => updateProduct(product.id, session!.access, input),
    onSuccess: (updated) => {
      setActiveModal(null);
      setMessage("Product updated successfully.");
      queryClient.setQueryData(["product", session?.user.id, updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(product.id, session!.access),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["product", session?.user.id, product.id] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      router.push("/admin/products");
    },
  });

  const busy = updateMutation.isPending || deleteMutation.isPending;

  function closeModal() {
    if (!busy) setActiveModal(null);
  }

  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            Admin controls
          </p>
          <h2 className="mt-2 text-xl font-bold">Manage this product</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Editing affects future purchases only. Deletion is blocked when purchase history exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              updateMutation.reset();
              setMessage(null);
              setActiveModal("edit");
            }}
            className="rounded-xl border border-[var(--border)] px-4 py-3 font-semibold transition hover:border-[var(--border-strong)] hover:bg-white/[0.025]"
          >
            Edit product
          </button>
          <button
            type="button"
            onClick={() => {
              deleteMutation.reset();
              setMessage(null);
              setActiveModal("delete");
            }}
            className="rounded-xl border border-[var(--danger)]/40 px-4 py-3 font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
          >
            Delete product
          </button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent)]"
        >
          {message}
        </p>
      )}

      <ProductMutationModal
        open={activeModal === "edit"}
        mode="edit"
        product={product}
        regions={regions.data}
        regionsPending={regions.isPending}
        regionsError={regions.isError}
        pending={updateMutation.isPending}
        error={updateMutation.error?.message}
        onClose={closeModal}
        onSubmit={(input) => updateMutation.mutate(input)}
      />

      <DeleteProductModal
        open={activeModal === "delete"}
        product={product}
        pending={deleteMutation.isPending}
        error={deleteMutation.error?.message}
        onClose={closeModal}
        onConfirm={() => deleteMutation.mutate()}
      />
    </section>
  );
}

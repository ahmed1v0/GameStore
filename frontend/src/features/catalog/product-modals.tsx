"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "@/components/modal";
import { buttonClass, inputClass } from "@/features/auth/auth-form";
import type { Product, ProductInput, Region } from "@/lib/api/products";
import { formatMoney, moneyInputStep } from "@/lib/money";

const emptyProduct: ProductInput = {
  title: "",
  description: "",
  price: "0.000",
  location: "JO",
};

type ProductMutationModalProps = Readonly<{
  open: boolean;
  mode: "create" | "edit";
  product?: Product | null;
  regions: Region[] | undefined;
  regionsPending: boolean;
  regionsError: boolean;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: ProductInput) => void;
}>;

export function ProductMutationModal({
  open,
  mode,
  product,
  regions,
  regionsPending,
  regionsError,
  pending,
  error,
  onClose,
  onSubmit,
}: ProductMutationModalProps) {
  const [form, setForm] = useState<ProductInput>(emptyProduct);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && product) {
      setForm({
        title: product.title,
        description: product.description,
        price: product.price,
        location: product.location,
      });
    } else {
      setForm(emptyProduct);
    }
  }, [open, mode, product]);

  const selectedRegion = regions?.find((region) => region.code === form.location);
  const fallbackMinorUnit = product?.minor_unit ?? 3;
  const priceStep = moneyInputStep(selectedRegion?.minor_unit ?? fallbackMinorUnit);
  const isEdit = mode === "edit";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={pending}
      title={isEdit ? "Edit product" : "Add product"}
      description={
        isEdit
          ? "Update catalog data for future purchases. Existing receipts keep their original commercial snapshot."
          : "Create a new region-aware catalog item with currency-specific price precision."
      }
    >
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Title</span>
          <input
            data-autofocus
            className={inputClass}
            value={form.title}
            maxLength={255}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
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

        <label>
          <span className="mb-2 block text-sm font-semibold">
            Price
            {selectedRegion
              ? ` (${selectedRegion.currency_code})`
              : product
                ? ` (${product.currency})`
                : ""}
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
          <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
            Up to {selectedRegion?.minor_unit ?? fallbackMinorUnit} decimal places.
          </span>
        </label>

        <label>
          <span className="mb-2 block text-sm font-semibold">Location</span>
          <select
            className={inputClass}
            value={form.location}
            disabled={regionsPending || regionsError}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value as ProductInput["location"] })
            }
          >
            {regions?.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name} · {region.currency_code}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
            Currency and supported precision are derived from the selected region.
          </span>
        </label>

        {regionsError && (
          <p
            role="alert"
            className="sm:col-span-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
          >
            Region reference data could not be loaded. Close this dialog and try again.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="sm:col-span-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-[var(--border)] px-4 py-3 font-semibold transition hover:border-[var(--border-strong)] hover:bg-white/[0.025] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            className={`${buttonClass} sm:min-w-36`}
            disabled={pending || regionsError || regionsPending}
          >
            {pending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type DeleteProductModalProps = Readonly<{
  open: boolean;
  product: Product | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}>;

export function DeleteProductModal({
  open,
  product,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteProductModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={pending}
      tone="danger"
      title="Delete product"
      description="Delete is permanent for unpurchased catalog items. Purchase history is protected and cannot be removed."
    >
      {product && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{product.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Item #{product.id} · {product.location_name}
                </p>
              </div>
              <p className="font-mono text-sm font-bold">
                {formatMoney(product.price, product.currency, product.minor_unit)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm leading-6 text-[var(--danger)]">
            This action cannot be undone. If this product has an existing purchase receipt, the API will reject deletion with a conflict instead of damaging historical records.
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl border border-[var(--border)] px-4 py-3 font-semibold transition hover:border-[var(--border-strong)] hover:bg-white/[0.025] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep product
            </button>
            <button
              data-autofocus
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-xl bg-[var(--danger)] px-4 py-3 font-bold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36"
            >
              {pending ? "Deleting…" : "Delete product"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

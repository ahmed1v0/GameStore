"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass, inputClass } from "@/features/auth/auth-form";
import {
  getRegions,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/api/products";
import { moneyInputStep } from "@/lib/money";

export function AdminProductEditor({ product }: Readonly<{ product: Product }>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductInput>({
    title: product.title,
    description: product.description,
    price: product.price,
    location: product.location,
  });

  const regions = useQuery({
    queryKey: ["regions", session?.user.id],
    queryFn: ({ signal }) => getRegions(session!.access, signal),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: () => updateProduct(product.id, session!.access, form),
    onSuccess: (updated) => {
      setForm({
        title: updated.title,
        description: updated.description,
        price: updated.price,
        location: updated.location,
      });
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const selectedRegion = regions.data?.find((region) => region.code === form.location);
  const priceStep = moneyInputStep(selectedRegion?.minor_unit ?? product.minor_unit);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="text-xl font-bold">Edit item</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Changes affect future purchases. Existing receipts retain their original snapshot.
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
          Price{selectedRegion ? ` (${selectedRegion.currency_code})` : ` (${product.currency})`}
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
        <span className="mt-1.5 block text-xs text-[var(--muted)]">
          Up to {selectedRegion?.minor_unit ?? product.minor_unit} decimal places.
        </span>
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
      <div className="sm:col-span-2">
        <button className={buttonClass} disabled={mutation.isPending || regions.isError}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
        {mutation.isSuccess && (
          <p role="status" className="mt-3 text-[var(--accent)]">
            Product updated.
          </p>
        )}
        {regions.isError && (
          <p role="alert" className="mt-3 text-[var(--danger)]">
            Region reference data could not be loaded.
          </p>
        )}
        {mutation.error && (
          <p role="alert" className="mt-3 text-[var(--danger)]">
            {mutation.error.message}
          </p>
        )}
      </div>
    </form>
  );
}

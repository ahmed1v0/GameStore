"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass, inputClass } from "@/features/auth/auth-form";
import { updateProduct, type Product, type ProductInput } from "@/lib/api/products";

export function AdminProductEditor({ product }: Readonly<{ product: Product }>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductInput>({
    title: product.title,
    description: product.description,
    price: product.price,
    location: product.location,
  });
  const mutation = useMutation({
    mutationFn: () =>
      updateProduct(product.id, session!.access, {
        title: form.title,
        description: form.description,
        price: form.price,
        location: form.location,
      }),
    onSuccess: (updated) => {
      setForm({ ...updated });
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
      <h2 className="text-xl font-bold sm:col-span-2">Edit item</h2>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Title</span>
        <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Description</span>
        <textarea className={`${inputClass} min-h-28`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Price</span>
        <input className={inputClass} type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Location</span>
        <select className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value as ProductInput["location"] })}>
          <option value="JO">Jordan</option>
          <option value="SA">Saudi Arabia</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <button className={buttonClass} disabled={mutation.isPending}>Save changes</button>
        {mutation.isSuccess && <p role="status" className="mt-3 text-[var(--accent)]">Product updated.</p>}
        {mutation.error && <p role="alert" className="mt-3 text-[var(--danger)]">{mutation.error.message}</p>}
      </div>
    </form>
  );
}
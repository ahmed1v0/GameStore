"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { createProduct, type ProductInput } from "@/lib/api/products";
import { useAuth } from "@/features/auth/auth-provider";
import { buttonClass, inputClass } from "@/features/auth/auth-form";

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
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => createProduct(session!.access, form),
    onSuccess: () => {
      setMessage("Product added.");
      setForm(emptyProduct);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    mutation.mutate();
  }

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
        Administration
      </p>
      <h1 className="mt-3 text-4xl font-bold">Game store items</h1>
      <p className="mt-3 text-[var(--muted)]">Add a new product to the catalog.</p>

      <form onSubmit={submit} className="mt-8 grid max-w-3xl gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
        <h2 className="text-xl font-bold sm:col-span-2">Add item</h2>
        <label>
          <span className="mb-2 block text-sm font-semibold">Price</span>
          <input className={inputClass} type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Title</span>
          <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Description</span>
          <textarea className={`${inputClass} min-h-28`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        </label>
        <label>
          <span className="mb-2 block text-sm font-semibold">Location</span>
          <select className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value as ProductInput["location"] })}>
            <option value="JO">Jordan</option>
            <option value="SA">Saudi Arabia</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button className={buttonClass} disabled={mutation.isPending}>Add product</button>
        </div>
        {message && <p role="status" className="sm:col-span-2 text-[var(--accent)]">{message}</p>}
        {mutation.error && <p role="alert" className="sm:col-span-2 text-[var(--danger)]">{mutation.error.message}</p>}
      </form>
    </section>
  );
}
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { getOrder } from "@/lib/api/orders";

const locationNames = { JO: "Jordan", SA: "Saudi Arabia" } as const;

export function OrderReceipt({ orderId }: Readonly<{ orderId: number }>) {
  const { logout, session } = useAuth();
  const router = useRouter();
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId, session!.access),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (order.error instanceof ApiError && order.error.status === 401) {
      logout();
      router.replace("/login");
    }
  }, [logout, order.error, router]);

  if (order.isPending) {
    return <div aria-label="Loading receipt" className="h-96 animate-pulse rounded-3xl bg-[var(--surface)]" />;
  }

  if (order.error instanceof ApiError && order.error.status === 404) {
    return <ReceiptMessage title="Receipt not found" message="This order does not exist in your account." />;
  }

  if (order.isError || !order.data) {
    return <ReceiptMessage title="Could not load receipt" message="Check the API connection and try again." />;
  }

  const purchasedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(order.data.created_at));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/20 sm:p-10">
        <div className="flex items-start justify-between gap-6 border-b border-[var(--border)] pb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Purchase complete
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Your receipt</h1>
          </div>
          <span className="rounded-full bg-white/6 px-3 py-1.5 font-mono text-xs text-[var(--muted)]">
            #{order.data.id}
          </span>
        </div>

        <dl className="divide-y divide-[var(--border)]">
          <ReceiptRow label="Order ID" value={String(order.data.id)} />
          <ReceiptRow label="Product" value={order.data.product_title} />
          <ReceiptRow label="Price paid" value={order.data.unit_price} emphasized />
          <ReceiptRow label="Location" value={locationNames[order.data.product_location]} />
          <ReceiptRow label="Purchased" value={purchasedAt} />
        </dl>

        <Link
          href="/products"
          className="mt-8 inline-flex rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold transition hover:border-[#46556e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}

function ReceiptRow({
  emphasized = false,
  label,
  value,
}: Readonly<{ emphasized?: boolean; label: string; value: string }>) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline">
      <dt className="text-sm font-medium text-[var(--muted)]">{label}</dt>
      <dd className={emphasized ? "text-2xl font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}

function ReceiptMessage({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-[var(--muted)]">{message}</p>
      <Link href="/products" className="mt-7 inline-block font-semibold text-[var(--accent)]">
        Return to catalog
      </Link>
    </div>
  );
}

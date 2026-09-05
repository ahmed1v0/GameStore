"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { getOrder } from "@/lib/api/orders";
import { formatMoney } from "@/lib/money";

export function OrderReceipt({ orderId }: Readonly<{ orderId: number }>) {
  const { session } = useAuth();
  const order = useQuery({
    queryKey: ["order", session?.user.id, orderId],
    queryFn: ({ signal }) => getOrder(orderId, session!.access, signal),
    enabled: Boolean(session),
  });

  if (order.isPending) {
    return (
      <div
        aria-label="Loading receipt"
        className="h-96 animate-pulse rounded-3xl bg-[var(--surface)]"
      />
    );
  }

  if (order.error instanceof ApiError && order.error.status === 404) {
    return (
      <ReceiptMessage
        title="Receipt not found"
        message="This order does not exist in your account."
      />
    );
  }

  if (order.isError || !order.data) {
    return (
      <ReceiptMessage
        title="Could not load receipt"
        message="Check the API connection and try again."
      />
    );
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
          <span className="rounded-full border border-[var(--border)] bg-white/[0.025] px-3 py-1.5 font-mono text-xs text-[var(--muted)]">
            #{order.data.id}
          </span>
        </div>

        <dl className="divide-y divide-[var(--border)]">
          <ReceiptRow label="Transaction reference" value={order.data.reference} mono />
          <ReceiptRow label="Product" value={order.data.product_title} />
          <ReceiptRow
            label="Amount paid"
            value={formatMoney(
              order.data.unit_price,
              order.data.currency_code,
              order.data.currency_minor_unit,
            )}
            emphasized
          />
          <ReceiptRow label="Market" value={order.data.product_location_name} />
          <ReceiptRow label="Purchased" value={purchasedAt} />
        </dl>

        <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-xs leading-5 text-[var(--muted)]">
          This receipt is a snapshot of the product, market, currency and amount at the time of
          purchase. Later catalog changes do not rewrite it.
        </p>

        <Link
          href="/products"
          className="mt-8 inline-flex rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold transition hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
  mono = false,
  value,
}: Readonly<{ emphasized?: boolean; label: string; mono?: boolean; value: string }>) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline">
      <dt className="text-sm font-medium text-[var(--muted)]">{label}</dt>
      <dd
        className={`${emphasized ? "text-2xl font-bold" : "font-semibold"} ${mono ? "break-all font-mono text-sm" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ReceiptMessage({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
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

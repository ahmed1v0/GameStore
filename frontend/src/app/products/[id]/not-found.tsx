import Link from "next/link";

import { PageShell } from "@/components/page-shell";

export default function ProductNotFound() {
  return (
    <PageShell>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
        <h1 className="text-3xl font-bold tracking-tight">Item not found</h1>
        <p className="mt-3 text-[var(--muted)]">The product address is not valid.</p>
        <Link href="/products" className="mt-7 inline-block font-semibold text-[var(--accent)]">
          Return to catalog
        </Link>
      </div>
    </PageShell>
  );
}

import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";

export default function ProductsPage() {
  return (
    <RequireAuth>
      <PageShell>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Catalog
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Digital game items</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
          The authenticated product catalog will appear here.
        </p>
      </PageShell>
    </RequireAuth>
  );
}

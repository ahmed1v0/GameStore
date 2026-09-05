import { PageShell } from "@/components/page-shell";
import { AdminProducts } from "@/features/catalog/admin-products";
import { RequireAuth } from "@/features/auth/require-auth";

export default function Page() {
  return (
    <RequireAuth admin>
      <PageShell>
        <AdminProducts />
      </PageShell>
    </RequireAuth>
  );
}
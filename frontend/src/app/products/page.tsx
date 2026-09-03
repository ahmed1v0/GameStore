import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { ProductCatalog } from "@/features/catalog/product-catalog";

export default function ProductsPage() {
  return (
    <RequireAuth>
      <PageShell>
        <ProductCatalog />
      </PageShell>
    </RequireAuth>
  );
}

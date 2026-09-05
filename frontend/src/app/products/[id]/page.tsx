import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { ProductDetail } from "@/features/catalog/product-detail";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    notFound();
  }

  return (
    <RequireAuth>
      <PageShell>
        <ProductDetail productId={productId} />
      </PageShell>
    </RequireAuth>
  );
}

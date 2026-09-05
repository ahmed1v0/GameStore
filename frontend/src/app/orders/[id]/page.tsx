import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { OrderReceipt } from "@/features/orders/order-receipt";

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    notFound();
  }

  return (
    <RequireAuth>
      <PageShell>
        <OrderReceipt orderId={orderId} />
      </PageShell>
    </RequireAuth>
  );
}

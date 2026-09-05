import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { CartPage } from "@/features/cart/cart-page";

export default function Page() {
  return (
    <RequireAuth>
      <PageShell>
        <CartPage />
      </PageShell>
    </RequireAuth>
  );
}
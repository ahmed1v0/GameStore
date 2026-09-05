import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountPage } from "@/features/auth/account-page";
export default function Page() {
  return (
    <RequireAuth>
      <PageShell>
        <AccountPage />
      </PageShell>
    </RequireAuth>
  );
}

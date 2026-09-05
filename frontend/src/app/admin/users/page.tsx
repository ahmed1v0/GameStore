import { PageShell } from "@/components/page-shell";
import { RequireAuth } from "@/features/auth/require-auth";
import { AdminUsers } from "@/features/auth/admin-users";
export default function Page() {
  return (
    <RequireAuth admin>
      <PageShell>
        <AdminUsers />
      </PageShell>
    </RequireAuth>
  );
}

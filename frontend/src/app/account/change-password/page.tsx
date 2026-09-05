import { AuthForm } from "@/features/auth/auth-form";
import { RequireAuth } from "@/features/auth/require-auth";
export default function Page() {
  return (
    <RequireAuth>
      <AuthForm mode="change" />
    </RequireAuth>
  );
}

import { AuthForm } from "@/features/auth/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; invitation?: string }>;
}) {
  const { token, invitation } = await searchParams;
  return (
    <AuthForm
      mode="reset"
      token={typeof token === "string" ? token : ""}
      invitation={invitation === "1"}
    />
  );
}

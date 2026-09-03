"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { purchaseProduct } from "@/lib/api/orders";

export function PurchaseButton({ productId }: Readonly<{ productId: number }>) {
  const { logout, session } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const purchase = useMutation({
    mutationFn: () => purchaseProduct(productId, session!.access),
    onSuccess(receipt) {
      queryClient.setQueryData(["order", receipt.id], receipt);
      router.push(`/orders/${receipt.id}`);
    },
    onError(error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        router.replace("/login");
      }
    },
  });

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={purchase.isPending}
        onClick={() => purchase.mutate()}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 font-bold text-[#08120e] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {purchase.isPending ? "Creating receipt…" : "Buy item"}
      </button>
      {purchase.isError ? (
        <p role="alert" className="mt-3 text-sm leading-6 text-[var(--danger)]">
          The purchase could not be completed. Please try again.
        </p>
      ) : null}
    </div>
  );
}

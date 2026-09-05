"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { purchaseProduct } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/client";
import {
  completePurchaseIntent,
  getPurchaseIntent,
  PurchaseStorageError,
} from "./purchase-intent";

export function PurchaseButton({ productId }: Readonly<{ productId: number }>) {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <PurchaseAction
      key={`${session.user.id}:${productId}`}
      productId={productId}
      userId={session.user.id}
      accessToken={session.access}
    />
  );
}

function PurchaseAction({
  productId,
  userId,
  accessToken,
}: Readonly<{
  productId: number;
  userId: number;
  accessToken: string;
}>) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const submitting = useRef(false);
  const purchase = useMutation({
    retry: false,
    mutationFn: async () => {
      const key = getPurchaseIntent(userId, productId);
      const receipt = await purchaseProduct(productId, accessToken, key);
      completePurchaseIntent(userId, productId, key);
      return receipt;
    },
    onSuccess(receipt) {
      queryClient.setQueryData(["order", userId, receipt.id], receipt);
      router.push(`/orders/${receipt.id}`);
    },
    onError() {
      submitting.current = false;
    },
  });

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={purchase.isPending || purchase.isSuccess}
        onClick={() => {
          // React may not have rendered isPending before a second click arrives.
          if (submitting.current) return;
          submitting.current = true;
          purchase.mutate();
        }}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 font-bold text-[#08120e] transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {purchase.isPending
          ? "Creating receipt…"
          : purchase.isSuccess
            ? "Opening receipt…"
            : purchase.isError
              ? "Retry purchase"
              : "Buy item"}
      </button>
      {purchase.isError ? (
        <p role="alert" className="mt-3 text-sm leading-6 text-[var(--danger)]">
          {purchase.error instanceof ApiError ||
          purchase.error instanceof PurchaseStorageError
            ? purchase.error.message
            : "We couldn’t confirm your purchase. Retry to check the same purchase safely."}
        </p>
      ) : null}
    </div>
  );
}

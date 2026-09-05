import { z } from "zod";

import { apiRequest } from "./client";

export const orderReceiptSchema = z.object({
  id: z.number().int().positive(),
  reference: z.string().uuid(),
  product_id: z.number().int().positive(),
  product_title: z.string(),
  unit_price: z.string(),
  currency_code: z.enum(["JOD", "SAR"]),
  currency_minor_unit: z.number().int().min(0).max(3),
  product_location: z.enum(["JO", "SA"]),
  product_location_name: z.string(),
  created_at: z.string(),
});

export type OrderReceipt = z.infer<typeof orderReceiptSchema>;

export function purchaseProduct(
  productId: number,
  accessToken: string,
  idempotencyKey: string,
): Promise<OrderReceipt> {
  return apiRequest("/orders", {
    schema: orderReceiptSchema,
    accessToken,
    init: {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ product_id: productId }),
    },
  });
}

export function getOrder(
  orderId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<OrderReceipt> {
  return apiRequest(`/orders/${orderId}`, {
    schema: orderReceiptSchema,
    accessToken,
    init: { signal },
  });
}

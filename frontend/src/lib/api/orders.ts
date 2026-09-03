import { z } from "zod";

import { apiRequest } from "./client";

export const orderReceiptSchema = z.object({
  id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  product_title: z.string(),
  unit_price: z.string(),
  product_location: z.enum(["JO", "SA"]),
  created_at: z.string(),
});

export type OrderReceipt = z.infer<typeof orderReceiptSchema>;

export function purchaseProduct(productId: number, accessToken: string): Promise<OrderReceipt> {
  return apiRequest("/orders", {
    schema: orderReceiptSchema,
    accessToken,
    init: {
      method: "POST",
      body: JSON.stringify({ product_id: productId }),
    },
  });
}

export function getOrder(orderId: number, accessToken: string): Promise<OrderReceipt> {
  return apiRequest(`/orders/${orderId}`, {
    schema: orderReceiptSchema,
    accessToken,
  });
}

import { z } from "zod";

import { apiRequest } from "./client";

export const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  price: z.string(),
  location: z.enum(["JO", "SA"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const productPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(productSchema),
});

export type Product = z.infer<typeof productSchema>;
export type ProductLocation = Product["location"];
export type ProductPage = z.infer<typeof productPageSchema>;

type ProductListParameters = {
  accessToken: string;
  page: number;
  pageSize: number;
  location: ProductLocation | "";
};

export function getProducts({
  accessToken,
  page,
  pageSize,
  location,
}: ProductListParameters): Promise<ProductPage> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (location) {
    query.set("location", location);
  }

  return apiRequest(`/products?${query}`, {
    schema: productPageSchema,
    accessToken,
  });
}

export function getProduct(productId: number, accessToken: string): Promise<Product> {
  return apiRequest(`/products/${productId}`, {
    schema: productSchema,
    accessToken,
  });
}

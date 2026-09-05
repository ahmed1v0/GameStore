import { z } from "zod";

import { apiRequest } from "./client";

export const regionSchema = z.object({
  code: z.enum(["JO", "SA"]),
  name: z.string(),
  currency_code: z.string().length(3),
  minor_unit: z.number().int().min(0).max(3),
});

export const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  price: z.string(),
  location: z.enum(["JO", "SA"]),
  location_name: z.string(),
  currency: z.string().length(3),
  minor_unit: z.number().int().min(0).max(3),
  created_at: z.string(),
  updated_at: z.string(),
});

export const productPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(productSchema),
});

export type Region = z.infer<typeof regionSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductLocation = Product["location"];
export type ProductPage = z.infer<typeof productPageSchema>;
export type ProductInput = Pick<Product, "title" | "description" | "price" | "location">;

type ProductListParameters = {
  accessToken: string;
  page: number;
  pageSize: number;
  location: ProductLocation | "";
  signal?: AbortSignal;
};

export function getRegions(accessToken: string, signal?: AbortSignal): Promise<Region[]> {
  return apiRequest("/regions", {
    schema: z.array(regionSchema),
    accessToken,
    init: { signal },
  });
}

export function getProducts({
  accessToken,
  page,
  pageSize,
  location,
  signal,
}: ProductListParameters): Promise<ProductPage> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (location) {
    query.set("location", location);
  }

  return apiRequest(`/products?${query}`, {
    schema: productPageSchema,
    accessToken,
    init: { signal },
  });
}

export function getProduct(
  productId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<Product> {
  return apiRequest(`/products/${productId}`, {
    schema: productSchema,
    accessToken,
    init: { signal },
  });
}

export function createProduct(accessToken: string, product: ProductInput): Promise<Product> {
  return apiRequest("/products", {
    schema: productSchema,
    accessToken,
    init: { method: "POST", body: JSON.stringify(product) },
  });
}

export function updateProduct(
  productId: number,
  accessToken: string,
  changes: Partial<ProductInput>,
): Promise<Product> {
  return apiRequest(`/products/${productId}`, {
    schema: productSchema,
    accessToken,
    init: { method: "PATCH", body: JSON.stringify(changes) },
  });
}

export function deleteProduct(productId: number, accessToken: string): Promise<null> {
  return apiRequest(`/products/${productId}`, {
    schema: z.null(),
    accessToken,
    init: { method: "DELETE" },
  });
}

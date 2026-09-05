"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";

import type { Product } from "@/lib/api/products";
import { useAuth } from "@/features/auth/auth-provider";

type CartContextValue = {
  items: Product[];
  itemCount: number;
  addItem(product: Product): void;
  removeItem(productId: number): void;
  clear(): void;
  hasItem(productId: number): boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<Product[]>([]);
  const [hydratedUser, setHydratedUser] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      startTransition(() => {
        setItems([]);
        setHydratedUser(null);
      });
      return;
    }
    try {
      const stored = window.localStorage.getItem(`game-store-cart-${userId}`);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      startTransition(() => {
        setItems(Array.isArray(parsed) ? (parsed as Product[]) : []);
        setHydratedUser(userId);
      });
    } catch {
      startTransition(() => {
        setItems([]);
        setHydratedUser(userId);
      });
    }
  }, [userId]);

  useEffect(() => {
    if (hydratedUser !== userId || !userId) return;
    window.localStorage.setItem(`game-store-cart-${userId}`, JSON.stringify(items));
  }, [hydratedUser, items, userId]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.length,
      addItem(product) {
        setItems((current) =>
          current.some((item) => item.id === product.id) ? current : [...current, product],
        );
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.id !== productId));
      },
      clear() {
        setItems([]);
      },
      hasItem(productId) {
        return items.some((item) => item.id === productId);
      },
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
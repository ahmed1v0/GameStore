// Only random operation IDs are stored here, never access tokens or receipt data.
const storageKey = (userId: number, productId: number) =>
  `game-store:purchase:${userId}:${productId}`;

export class PurchaseStorageError extends Error {
  constructor() {
    super("Enable browser session storage to purchase safely, then try again.");
  }
}

export function getPurchaseIntent(userId: number, productId: number): string {
  try {
    const name = storageKey(userId, productId);
    const existing = sessionStorage.getItem(name);
    if (existing) return existing;
    const key = crypto.randomUUID();
    // Persist before sending: a reload after a lost response must reuse the same key.
    sessionStorage.setItem(name, key);
    return key;
  } catch {
    // Sending without a durable key could duplicate an order after a reload.
    throw new PurchaseStorageError();
  }
}

export function completePurchaseIntent(userId: number, productId: number, key: string) {
  try {
    const name = storageKey(userId, productId);
    if (sessionStorage.getItem(name) === key) sessionStorage.removeItem(name);
  } catch {
    // Retaining a completed key is safe: a later retry retrieves the same receipt.
  }
}

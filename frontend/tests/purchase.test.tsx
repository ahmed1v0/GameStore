import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { PurchaseButton } from "@/features/orders/purchase-button";
import { getPurchaseIntent } from "@/features/orders/purchase-intent";

const mocks = vi.hoisted(() => ({ buy: vi.fn(), push: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/api/orders", () => ({ purchaseProduct: mocks.buy }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: mocks.auth }));

const receipt = { id: 19, product_id: 7, product_title: "Item", unit_price: "10.00" };

function mount(productId = 7) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3 } } });
  return {
    client,
    ...render(<QueryClientProvider client={client}><PurchaseButton productId={productId} /></QueryClientProvider>),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.auth.mockReturnValue({ session: { access: "access", user: { id: 1 } } });
});

it("blocks two synchronous clicks and remains disabled while navigating", async () => {
  let resolve!: (value: typeof receipt) => void;
  mocks.buy.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { client } = mount();
  const button = screen.getByRole("button", { name: "Buy item" });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  await waitFor(() => expect(mocks.buy).toHaveBeenCalledTimes(1));
  expect(button).toBeDisabled();
  await act(async () => { resolve(receipt); });
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/orders/19"));
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(mocks.buy).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(["order", 1, 19])).toEqual(receipt);
});

it("reuses the persisted key after a lost response and remount without automatic retries", async () => {
  mocks.buy.mockRejectedValueOnce(new TypeError("network lost"));
  const first = mount();
  fireEvent.click(screen.getByRole("button", { name: "Buy item" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Retry to check the same purchase");
  expect(mocks.buy).toHaveBeenCalledTimes(1);
  const key = mocks.buy.mock.calls[0][2];
  expect(getPurchaseIntent(1, 7)).toBe(key);
  first.unmount();
  mocks.buy.mockResolvedValueOnce(receipt);
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Buy item" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  expect(mocks.buy.mock.calls[1][2]).toBe(key);
});

it("creates a fresh intent for an intentional purchase after the original completed", async () => {
  mocks.buy.mockResolvedValue(receipt);
  const first = mount();
  fireEvent.click(screen.getByRole("button", { name: "Buy item" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  const key = mocks.buy.mock.calls[0][2];
  first.unmount();
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Buy item" }));
  await waitFor(() => expect(mocks.buy).toHaveBeenCalledTimes(2));
  expect(mocks.buy.mock.calls[1][2]).not.toBe(key);
});

it("isolates unresolved purchase intents by customer and product", () => {
  const key = getPurchaseIntent(1, 7);
  expect(getPurchaseIntent(1, 7)).toBe(key);
  expect(getPurchaseIntent(2, 7)).not.toBe(key);
  expect(getPurchaseIntent(1, 8)).not.toBe(key);
});

it("does not submit without being able to persist the key", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Buy item" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enable browser session storage");
  expect(mocks.buy).not.toHaveBeenCalled();
});

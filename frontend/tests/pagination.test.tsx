import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductCatalog } from "@/features/catalog/product-catalog";
import { ProductDetail } from "@/features/catalog/product-detail";
import { OrderReceipt } from "@/features/orders/order-receipt";
import { AdminUsers } from "@/features/auth/admin-users";

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    session: { access: "access", user: { id: 1, role: "admin" } },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const fetcher = vi.fn();
const clients: QueryClient[] = [];
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function mount(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
}
function product(id: number, location = "JO") {
  return {
    id,
    title: `Item ${id}`,
    description: "Digital item",
    price: "10.00",
    location,
    created_at: "2026-09-05",
    updated_at: "2026-09-05",
  };
}
function account(id: number) {
  return {
    id,
    username: `customer-${id}`,
    email: `customer-${id}@example.com`,
    role: "user",
    is_active: true,
    is_superuser: false,
    email_verified: false,
    verification_required: false,
    email_verification_enabled: false,
    date_joined: "2026-09-05",
  };
}
function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}

it("requests only the selected catalog page and reuses fresh cached pages", async () => {
  fetcher.mockImplementation(async (url: string) => {
    const query = new URL(url).searchParams;
    expect(query.get("page_size")).toBe("12");
    return json(
      query.get("page") === "1"
        ? {
            count: 13,
            next: "?page=2",
            previous: null,
            results: Array.from({ length: 12 }, (_, i) => product(i + 1)),
          }
        : {
            count: 13,
            next: null,
            previous: "?page=1",
            results: [product(13)],
          },
    );
  });
  mount(<ProductCatalog />);
  await screen.findByText("Item 1");
  expect(screen.queryByText("Item 13")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Item 13");
  expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("page")).toBe("2");
  await userEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByText("Item 1");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("cancels superseded filters and never displays a late response for another region", async () => {
  let finishOld!: (response: Response) => void;
  let oldSignal!: AbortSignal;
  fetcher.mockImplementation((url: string, init: RequestInit) => {
    const query = new URL(url).searchParams;
    if (query.get("location") === "JO") {
      oldSignal = init.signal!;
      return new Promise<Response>((resolve) => {
        finishOld = resolve;
      });
    }
    expect(query.get("page")).toBe("1");
    return Promise.resolve(
      json({
        count: 1,
        next: null,
        previous: null,
        results: [product(query.get("location") === "SA" ? 200 : 1, "SA")],
      }),
    );
  });
  mount(<ProductCatalog />);
  await screen.findByText("Item 1");
  await userEvent.selectOptions(screen.getByRole("combobox"), "JO");
  await waitFor(() => expect(oldSignal).toBeDefined());
  expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox"), "SA");
  await screen.findByText("Item 200");
  expect(oldSignal.aborted).toBe(true);
  await act(async () => {
    finishOld(
      json({ count: 1, next: null, previous: null, results: [product(100)] }),
    );
  });
  expect(screen.queryByText("Item 100")).not.toBeInTheDocument();
});

it("sends admin pagination and search to the server and resets search to page one", async () => {
  fetcher.mockImplementation(async (url: string) => {
    const query = new URL(url).searchParams;
    if (query.get("search"))
      return json({
        count: 1,
        next: null,
        previous: null,
        results: [account(99)],
      });
    return json(
      query.get("page") === "1"
        ? { count: 21, next: "?page=2", previous: null, results: [account(2)] }
        : {
            count: 21,
            next: null,
            previous: "?page=1",
            results: [account(21)],
          },
    );
  });
  mount(<AdminUsers />);
  await screen.findByText("customer-2");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("customer-21");
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("page")).toBe("2");
  await userEvent.type(screen.getByRole("searchbox"), "customer-99");
  expect(fetcher).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("customer-99");
  const query = new URL(fetcher.mock.calls[2][0]).searchParams;
  expect(query.get("page")).toBe("1");
  expect(query.get("search")).toBe("customer-99");
  expect(screen.queryByText("customer-21")).not.toBeInTheDocument();
});

it.each(["product", "receipt", "users"])(
  "aborts the pending %s request when leaving its page",
  async (page) => {
    let signal!: AbortSignal;
    fetcher.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal!;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });
    const view = mount(
      page === "product" ? (
        <ProductDetail productId={1} />
      ) : page === "receipt" ? (
        <OrderReceipt orderId={1} />
      ) : (
        <AdminUsers />
      ),
    );
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal.aborted).toBe(true);
  },
);

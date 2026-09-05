import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { DeleteProductModal, ProductMutationModal } from "@/features/catalog/product-modals";
import type { Product, Region } from "@/lib/api/products";

const regions: Region[] = [
  { code: "JO", name: "Jordan", currency_code: "JOD", minor_unit: 3 },
  { code: "SA", name: "Saudi Arabia", currency_code: "SAR", minor_unit: 2 },
];

const product: Product = {
  id: 17,
  title: "Arcade Pack",
  description: "Digital game bundle",
  price: "12.500",
  location: "JO",
  location_name: "Jordan",
  currency: "JOD",
  minor_unit: 3,
  created_at: "2026-09-05T10:00:00Z",
  updated_at: "2026-09-05T10:00:00Z",
};

it("submits a new product from the add modal", async () => {
  const submit = vi.fn();
  render(
    <ProductMutationModal
      open
      mode="create"
      regions={regions}
      regionsPending={false}
      regionsError={false}
      pending={false}
      onClose={vi.fn()}
      onSubmit={submit}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Add product" })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Title"), "Starter Pack");
  await userEvent.type(screen.getByLabelText("Description"), "Starter digital bundle");
  await userEvent.selectOptions(screen.getByLabelText("Location"), "SA");
  await userEvent.clear(screen.getByLabelText(/Price/));
  await userEvent.type(screen.getByLabelText(/Price/), "5.25");
  await userEvent.click(screen.getByRole("button", { name: "Add product" }));

  expect(submit).toHaveBeenCalledWith({
    title: "Starter Pack",
    description: "Starter digital bundle",
    price: "5.25",
    location: "SA",
  });
});

it("prefills and submits edits from the edit modal", async () => {
  const submit = vi.fn();
  render(
    <ProductMutationModal
      open
      mode="edit"
      product={product}
      regions={regions}
      regionsPending={false}
      regionsError={false}
      pending={false}
      onClose={vi.fn()}
      onSubmit={submit}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Edit product" })).toBeInTheDocument();
  expect(screen.getByLabelText("Title")).toHaveValue("Arcade Pack");
  await userEvent.clear(screen.getByLabelText("Title"));
  await userEvent.type(screen.getByLabelText("Title"), "Updated Arcade Pack");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Updated Arcade Pack",
      location: "JO",
      price: "12.500",
    }),
  );
});

it("uses an explicit destructive confirmation modal", async () => {
  const confirm = vi.fn();
  render(
    <DeleteProductModal
      open
      product={product}
      pending={false}
      onClose={vi.fn()}
      onConfirm={confirm}
    />,
  );

  expect(screen.getByRole("dialog", { name: "Delete product" })).toBeInTheDocument();
  expect(screen.getByText("Arcade Pack")).toBeInTheDocument();
  expect(screen.getByText(/purchase history is protected/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Delete product" }));
  expect(confirm).toHaveBeenCalledOnce();
});

it("closes an idle modal with Escape", async () => {
  const close = vi.fn();
  render(
    <DeleteProductModal
      open
      product={product}
      pending={false}
      onClose={close}
      onConfirm={vi.fn()}
    />,
  );

  await userEvent.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
});

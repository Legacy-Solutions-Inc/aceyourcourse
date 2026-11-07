import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminProduct } from "@/services/admin.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { ProductPanel } from "./product-panel";

// The panel beside the Products list. A Product added from "+ Add product"
// opens at its own address, ?product=<id>, in its editor, still saying it saved.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const notebook = CATALOGUE_SEED.products.find((p) => p.id === "prd-009");
if (!notebook) throw new Error("The seed has prd-009");
const ADDED: AdminProduct = {
  product: { ...structuredClone(notebook), id: "prd-new1", slug: "mt-notebook" },
  stamp: { savedAt: "2026-10-22T04:00:00.000Z", savedBy: "AYC Content Team" },
  reviewCount: 0,
};

const unused = async (): Promise<AdminActionState<never>> => {
  throw new Error("not called");
};

describe("ProductPanel", () => {
  it("opens a Product just added in its editor, at its address, still saying it saved", async () => {
    const add = vi.fn(async () => ({ status: "saved", value: ADDED }) as const);
    const props = {
      deletePreview: null,
      exams: CATALOGUE_SEED.exams,
      listQuery: { q: null, exam: null, missing: false },
      actions: {
        save: unused,
        add,
        remove: unused,
        countDelete: unused,
        setFlag: unused,
        createUpload: unused,
      },
    };
    const user = userEvent.setup();
    const { rerender } = render(<ProductPanel selected="new" opened={null} {...props} />);

    await user.type(screen.getByRole("textbox", { name: "FULL NAME" }), "MT Notebook");
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(router.replace).toHaveBeenCalledWith("/admin/products?product=prd-new1", {
      scroll: false,
    });
    // The page answers ?product=prd-new1 with the new Product.
    rerender(<ProductPanel selected="prd-new1" opened={ADDED} {...props} />);

    expect(
      screen.getByRole("form", { name: `Edit ${ADDED.product.shortName}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("✓ SAVED · LIVE ON THE SITE");
    expect(
      screen.getByText("PAGE ADDRESS · aceyourcourse.ph/products/mt-notebook"),
    ).toBeInTheDocument();

    // Once another Product is picked, coming back to it opens it as usual.
    rerender(<ProductPanel selected="prd-999" opened={null} {...props} />);
    rerender(<ProductPanel selected="prd-new1" opened={ADDED} {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("UP TO DATE");
  });

  it("asks for a Product when none is selected", () => {
    render(
      <ProductPanel
        selected={null}
        opened={null}
        deletePreview={null}
        exams={CATALOGUE_SEED.exams}
        listQuery={{ q: null, exam: null, missing: false }}
        actions={{
          save: unused,
          add: unused,
          remove: unused,
          countDelete: unused,
          setFlag: unused,
          createUpload: unused,
        }}
      />,
    );
    expect(screen.getByText("Select a product")).toBeInTheDocument();
  });
});

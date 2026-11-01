import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminProductList, AdminProductRow } from "@/services/admin.types";

import { ProductList } from "./product-list";

// The Products list (mockup 149–175; BUILD-MAP §3.3, List), from rows the seam
// has already filtered and sorted. Its filters are links and a search box that
// write the URL.
const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  unstable_rethrow: () => {},
}));

const row = (overrides: Partial<AdminProductRow>): AdminProductRow => ({
  id: "prd-001",
  slug: "ce-formula-flash-cards",
  title: "Civil Engineering Formula Flash Cards",
  shortName: "CE Formula Flash Cards",
  examCode: "CE",
  format: "flash-cards",
  state: "live",
  priceFrom: 120000,
  priceTo: null,
  unitsSold: 764,
  cover: { src: "/products/ce-formula-flash-cards/1.webp", alt: "CE Formula Flash Cards" },
  storeLinks: { shopee: "product", lazada: "shop", tiktok: "shop" },
  showOnWebsite: true,
  availableInApp: true,
  stamp: { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null },
  ...overrides,
});

const CARDS = row({});
const POSTERS = row({
  id: "prd-005",
  slug: "ultimate-ce-posters-2-0",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
  priceFrom: 40000,
  priceTo: 125000,
  unitsSold: 172,
  storeLinks: { shopee: "product", lazada: "none", tiktok: "shop" },
  showOnWebsite: false,
  availableInApp: false,
});
const NOTEBOOK = row({
  id: "prd-009",
  slug: "ce-solving-notebook",
  shortName: "CE Solving Notebook",
  format: "notebook",
  state: "coming-soon",
  priceFrom: null,
  unitsSold: null,
  cover: null,
  storeLinks: { shopee: "none", lazada: "none", tiktok: "none" },
  availableInApp: false,
});

const NO_FILTERS = { q: null, exam: null, missing: false };
const listOf = (
  rows: AdminProductRow[],
  query: AdminProductList["query"] = NO_FILTERS,
  total = 15,
): AdminProductList => ({ rows, query, examCodes: ["CE", "ME", "EE", "MT", "CPA"], total });

const setFlag = vi.fn(async (): Promise<AdminActionState<AdminProductRow>> => ({
  status: "saved",
  value: CARDS,
}));

function renderList(list: AdminProductList, selected: string | null = null) {
  const user = userEvent.setup();
  render(<ProductList list={list} selected={selected} setFlag={setFlag} />);
  return { user };
}

const rowFor = (name: string) => {
  const link = screen.getByRole("link", { name: new RegExp(name) });
  const tableRow = link.closest("tr");
  if (!tableRow) throw new Error(`no row for ${name}`);
  return within(tableRow);
};

beforeEach(() => {
  replace.mockClear();
});

describe("ProductList: the rows", () => {
  it("counts the rows in the PRODUCT column's header", () => {
    renderList(listOf([CARDS, POSTERS, NOTEBOOK]));
    expect(screen.getByRole("columnheader", { name: "PRODUCT · 3" })).toBeInTheDocument();
    for (const name of ["EXAM", "PRICE", "STORE LINKS", "APP · SITE"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
  });

  it("shows a row's short name, format and units sold, Exam and price", () => {
    renderList(listOf([CARDS, POSTERS, NOTEBOOK]));

    const cards = rowFor("CE Formula Flash Cards");
    expect(cards.getByText("FLASH CARDS · 764 SOLD")).toBeInTheDocument();
    expect(cards.getByRole("cell", { name: "CE" })).toBeInTheDocument();
    expect(cards.getByRole("cell", { name: "₱1,200" })).toBeInTheDocument();
    // On a phone, the EXAM and PRICE columns fold in under the name.
    expect(cards.getByText("· ₱1,200", { exact: false })).toHaveTextContent("CE · ₱1,200");
    expect(rowFor("Ultimate CE Posters").getByText("₱400+")).toBeInTheDocument();
    expect(rowFor("CE Solving Notebook").getByText("COMING SOON")).toBeInTheDocument();
    expect(rowFor("CE Solving Notebook").getByText("NOTEBOOK")).toBeInTheDocument();
  });

  it("names each S/L/T badge's Marketplace and link, and counts the product links of 3", () => {
    renderList(listOf([POSTERS]));
    const posters = rowFor("Ultimate CE Posters");

    expect(posters.getByText("Shopee: product link")).toBeInTheDocument();
    expect(posters.getByText("Lazada: no button")).toBeInTheDocument();
    expect(posters.getByText("TikTok Shop: opens the shop page")).toBeInTheDocument();
    expect(posters.getByText("1/3")).toBeInTheDocument();
  });

  it("colours n/3 green when complete, amber with a shop page, and muted with no buttons", () => {
    const complete = row({
      id: "prd-002",
      shortName: "ME Formula Flash Cards",
      storeLinks: { shopee: "product", lazada: "product", tiktok: "product" },
    });
    renderList(listOf([CARDS, complete, NOTEBOOK]));

    expect(rowFor("ME Formula Flash Cards").getByText("3/3")).toHaveClass("text-ayc-success");
    expect(rowFor("CE Formula Flash Cards").getByText("1/3")).toHaveClass("text-ayc-warning");
    expect(rowFor("CE Solving Notebook").getByText("0/3")).toHaveClass("text-ayc-slate");
  });

  it("dims a row hidden from the Website, and says so to a screen reader", () => {
    renderList(listOf([CARDS, POSTERS]));
    expect(rowFor("Ultimate CE Posters").getByText("Hidden from the website")).toBeInTheDocument();
    expect(rowFor("CE Formula Flash Cards").queryByText("Hidden from the website")).toBeNull();
  });

  it("gives each row an App and a Site switch, set as the Product is", () => {
    renderList(listOf([CARDS, POSTERS]));

    expect(
      screen.getByRole("switch", { name: "CE Formula Flash Cards available in app" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Show Ultimate CE Posters 2.0 on the website" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("opens a Product by linking its row to ?product=<id>, keeping the filters", () => {
    renderList(listOf([CARDS], { q: "cards", exam: "CE", missing: false }), "prd-001");

    const link = screen.getByRole("link", { name: /CE Formula Flash Cards/ });
    expect(link).toHaveAttribute("href", "/admin/products?q=cards&exam=ce&product=prd-001");
    expect(link).toHaveAttribute("aria-current", "true");
  });

  it("shows the legend", () => {
    renderList(listOf([CARDS]));
    expect(
      screen.getByText(
        "S · L · T = SHOPEE · LAZADA · TIKTOK SHOP · GREEN = PRODUCT LINK · AMBER = OPENS THE SHOP PAGE",
      ),
    ).toBeInTheDocument();
  });
});

describe("ProductList: the filters", () => {
  it("links each Exam chip, marking the one in use, and keeps the other filters", () => {
    renderList(listOf([CARDS], { q: null, exam: "CE", missing: true }));
    const chips = within(screen.getByRole("group", { name: "Exam" }));

    expect(chips.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "ALL",
      "CE",
      "ME",
      "EE",
      "MT",
      "CPA",
    ]);
    expect(chips.getByRole("link", { name: "CE" })).toHaveAttribute("aria-current", "true");
    expect(chips.getByRole("link", { name: "ALL" })).toHaveAttribute(
      "href",
      "/admin/products?missing=1",
    );
    expect(chips.getByRole("link", { name: "ME" })).toHaveAttribute(
      "href",
      "/admin/products?exam=me&missing=1",
    );
  });

  it("marks ALL in use when no Exam is", () => {
    renderList(listOf([CARDS]));
    expect(
      within(screen.getByRole("group", { name: "Exam" })).getByRole("link", { name: "ALL" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("turns Missing product links on, and off again", () => {
    const { unmount } = render(
      <ProductList list={listOf([CARDS])} selected={null} setFlag={setFlag} />,
    );
    expect(screen.getByRole("link", { name: "Missing product links" })).toHaveAttribute(
      "href",
      "/admin/products?missing=1",
    );
    unmount();

    renderList(listOf([CARDS], { ...NO_FILTERS, missing: true }));
    const missing = screen.getByRole("link", { name: "Missing product links" });
    expect(missing).toHaveAttribute("href", "/admin/products");
    expect(missing).toHaveAttribute("aria-current", "true");
  });

  it("writes the search into the URL as it's typed, keeping the other filters", async () => {
    const { user } = renderList(listOf([CARDS], { ...NO_FILTERS, exam: "CE" }), "prd-001");

    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "pos");

    expect(replace).toHaveBeenLastCalledWith("/admin/products?q=pos&exam=ce&product=prd-001", {
      scroll: false,
    });
  });

  it("drops the search from the URL when it's cleared", async () => {
    const { user } = renderList(listOf([CARDS], { ...NO_FILTERS, q: "p" }));

    await user.clear(screen.getByRole("searchbox", { name: "Search products" }));

    expect(replace).toHaveBeenLastCalledWith("/admin/products", { scroll: false });
  });
});

describe("ProductList: the search box", () => {
  it("follows a search changed elsewhere, such as by Clear filters", () => {
    const { rerender } = render(
      <ProductList
        list={listOf([], { ...NO_FILTERS, q: "poster" })}
        selected={null}
        setFlag={setFlag}
      />,
    );
    expect(screen.getByRole("searchbox", { name: "Search products" })).toHaveValue("poster");

    rerender(<ProductList list={listOf([CARDS])} selected={null} setFlag={setFlag} />);

    expect(screen.getByRole("searchbox", { name: "Search products" })).toHaveValue("");
  });

  it("keeps what's typed when its own search comes back trimmed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProductList list={listOf([CARDS])} selected={null} setFlag={setFlag} />,
    );
    const box = screen.getByRole("searchbox", { name: "Search products" });
    await user.type(box, "post ");

    rerender(
      <ProductList
        list={listOf([CARDS], { ...NO_FILTERS, q: "post" })}
        selected={null}
        setFlag={setFlag}
      />,
    );

    expect(box).toHaveValue("post ");
  });
});

describe("ProductList: empty states", () => {
  it("says no products match, with Clear filters back to the whole list", () => {
    renderList(listOf([], { q: "poster", exam: "CPA", missing: true }), "prd-001");

    expect(screen.getByText("No products match.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/admin/products?product=prd-001",
    );
    expect(screen.getByRole("columnheader", { name: "PRODUCT · 0" })).toBeInTheDocument();
  });

  it("says when the catalogue has no Products at all", () => {
    renderList(listOf([], NO_FILTERS, 0));

    expect(
      screen.getByText("No products yet. Add the first one with + Add product."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });
});

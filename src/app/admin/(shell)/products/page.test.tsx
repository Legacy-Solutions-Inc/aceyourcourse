import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";

import ProductsPage from "./page";

// Products & store links, rendered from the sample data with its filters and
// selection read from the URL. The cookie jar and the router are the framework
// boundary, so they are replaced.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/products",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

type Params = Record<string, string | string[] | undefined>;

async function renderPage(params: Params = {}) {
  render(await ProductsPage({ searchParams: Promise.resolve(params) }));
}

const productNames = () =>
  within(screen.getByRole("region", { name: "Products" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0]?.textContent);

describe("Products page", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
  });

  it("lists every Product for an Editor, best sellers first and Coming Soon last", async () => {
    await renderPage();

    expect(screen.getByRole("columnheader", { name: "PRODUCT · 15" })).toBeInTheDocument();
    const names = productNames();
    expect(names[0]).toMatch(/^CE Formula Flash CardsFLASH CARDS · 764 SOLD/);
    expect(names.at(-1)).toMatch(/^MedTech Essentials Posters/);
  });

  it("filters by the URL's search, Exam and Missing product links", async () => {
    await renderPage({ q: "poster", exam: "ce", missing: "1" });

    expect(productNames()).toEqual([expect.stringMatching(/^Ultimate CE Posters 2\.0/)]);
    expect(screen.getByRole("searchbox", { name: "Search products" })).toHaveValue("poster");
    expect(
      within(screen.getByRole("group", { name: "Exam" })).getByRole("link", { name: "CE" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("ignores an unknown Exam, showing ALL", async () => {
    await renderPage({ exam: "xx" });

    expect(screen.getByRole("columnheader", { name: "PRODUCT · 15" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Exam" })).getByRole("link", { name: "ALL" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("asks for a Product until one is selected, then names it", async () => {
    await renderPage();
    const panel = () => screen.getByRole("complementary", { name: "Product editor" });
    expect(within(panel()).getByText("Select a product")).toBeInTheDocument();
  });

  it("names the selected Product in the panel", async () => {
    await renderPage({ product: "prd-005" });
    expect(screen.getByText("EDIT · ULTIMATE CE POSTERS 2.0")).toBeInTheDocument();
  });

  it("names the selected Product even when the filters leave it out of the list", async () => {
    await renderPage({ exam: "me", product: "prd-005" });

    expect(screen.getByRole("columnheader", { name: "PRODUCT · 3" })).toBeInTheDocument();
    expect(screen.getByText("EDIT · ULTIMATE CE POSTERS 2.0")).toBeInTheDocument();
  });

  it("asks for a Product when the selected one isn't in the catalogue", async () => {
    await renderPage({ product: "prd-999" });
    expect(screen.getByText("Select a product")).toBeInTheDocument();
  });

  it("links + Add product to ?product=new, keeping the filters", async () => {
    await renderPage({ exam: "me" });

    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "+ Add product" }),
    ).toHaveAttribute("href", "/admin/products?exam=me&product=new");
  });

  it("shows NEW PRODUCT in the panel for ?product=new", async () => {
    await renderPage({ product: "new" });
    expect(screen.getByText("NEW PRODUCT")).toBeInTheDocument();
  });
});

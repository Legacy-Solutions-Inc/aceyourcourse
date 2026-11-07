import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "@/lib/analytics/events";
import type { WebsiteSettings } from "@/services/catalogue.types";

import { testLiveProduct } from "../../../../test/fixtures/catalogue";
import { ProductsGrid } from "./products-grid";

vi.mock("next/navigation", () => ({ usePathname: () => "/products" }));
vi.mock("@/lib/analytics/events", () => ({ trackMarketplaceClick: vi.fn() }));

const SHOP_LINKS: WebsiteSettings["shopLinks"] = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
};
const CE_CARDS = testLiveProduct();
const CE_POSTERS = testLiveProduct({
  id: "prd-posters",
  slug: "ultimate-ce-posters-2-0",
  shortName: "Ultimate CE Posters 2.0",
  listings: {},
});

function renderGrid(products = [CE_CARDS, CE_POSTERS], shopLinks = SHOP_LINKS) {
  render(
    <ProductsGrid
      products={products}
      total={8}
      memberAppLive={false}
      shopLinks={shopLinks}
      filterBar={<div>Filters</div>}
    />,
  );
}

const grid = () => within(screen.getByRole("list", { name: "All reviewers" }));

/** A card in the grid, by its Product's name. */
function card(name: string) {
  const article = grid()
    .getAllByRole("article")
    .find((element) => within(element).queryByRole("heading", { name }));
  if (!article) throw new Error(`No card for ${name}`);
  return within(article);
}

describe("ProductsGrid", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("counts the shown Products against every Live Product, under the filters", () => {
    renderGrid();

    expect(screen.getByRole("heading", { level: 2, name: "All reviewers" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 of 8 reviewers");
    expect(screen.getByText("Filters")).toBeVisible();
  });

  it("shows a card per Product in the given order, with the three store buttons", () => {
    renderGrid();

    expect(
      grid()
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["CE Formula Flash Cards", "Ultimate CE Posters 2.0"]);
    expect(
      card("CE Formula Flash Cards").getByRole("link", { name: /^Buy on Shopee/ }),
    ).toHaveAttribute("href", CE_CARDS.listings.shopee);
    // No Listing of its own: the button opens the shop page.
    const posters = card("Ultimate CE Posters 2.0");
    expect(posters.getByRole("link", { name: /^Buy on Shopee/ })).toHaveAttribute(
      "href",
      SHOP_LINKS.shopee,
    );
    expect(posters.getByRole("link", { name: /^Buy on Lazada/ })).toHaveAttribute(
      "href",
      SHOP_LINKS.lazada,
    );
    expect(posters.getByRole("link", { name: /^Buy on TikTok Shop/ })).toBeVisible();
  });

  it("records a marketplace_click from /products", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(card("CE Formula Flash Cards").getByRole("link", { name: /^Buy on Shopee/ }));

    expect(trackMarketplaceClick).toHaveBeenCalledWith({
      product: "ce-formula-flash-cards",
      marketplace: "shopee",
      page: "/products",
      link: "listing",
    });
  });

  it("shows the empty state, with Clear filters and Browse Shopee, when nothing matches", () => {
    renderGrid([]);

    expect(screen.queryByRole("list", { name: "All reviewers" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 8 reviewers");
    expect(screen.getByText("No reviewers match those filters.")).toBeVisible();
    expect(
      screen.getByText(/Reviewers for PhLE, LET and other boards are on Shopee already/),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: /^Browse Shopee/ })).toHaveAttribute(
      "href",
      SHOP_LINKS.shopee,
    );
  });

  it("leaves out Browse Shopee and its hint when there's no Shopee shop link", () => {
    renderGrid([], { ...SHOP_LINKS, shopee: null });

    expect(screen.getByText("No reviewers match those filters.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Browse Shopee/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/on Shopee already/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toBeVisible();
  });
});

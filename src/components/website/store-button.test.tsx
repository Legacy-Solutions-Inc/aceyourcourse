import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "@/lib/analytics/events";

import { StoreButton } from "./store-button";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/ce-formula-flash-cards" }));
vi.mock("@/lib/analytics/events", () => ({ trackMarketplaceClick: vi.fn() }));

const LISTING = "https://shopee.ph/CE-Formula-Flash-Cards-i.1276620555.24292303887";

// Stop jsdom trying to navigate when a test clicks a link.
function preventNavigation() {
  document.addEventListener("click", (event) => event.preventDefault(), { once: true });
}

describe("StoreButton", () => {
  afterEach(() => {
    vi.mocked(trackMarketplaceClick).mockClear();
  });

  it("opens the Listing in a new tab, named for screen readers", () => {
    render(
      <StoreButton
        marketplace="shopee"
        storeLink={{ href: LISTING, link: "listing" }}
        productSlug="ce-formula-flash-cards"
      />,
    );
    const button = screen.getByRole("link", { name: "Buy on Shopee (opens in a new tab)" });
    expect(button).toHaveAttribute("href", LISTING);
    expect(button).toHaveAttribute("target", "_blank");
    expect(button).toHaveAttribute("rel", "noopener noreferrer");
    expect(button).toHaveTextContent(/^Shopee/);
  });

  it("records the click with the Product, Marketplace, page and link type", async () => {
    const user = userEvent.setup();
    render(
      <StoreButton
        marketplace="lazada"
        storeLink={{ href: "https://www.lazada.com.ph/shop/aceyourcourse", link: "shop" }}
        productSlug="ce-formula-flash-cards"
      />,
    );
    preventNavigation();
    await user.click(screen.getByRole("link", { name: /buy on lazada/i }));
    expect(trackMarketplaceClick).toHaveBeenCalledWith({
      product: "ce-formula-flash-cards",
      marketplace: "lazada",
      page: "/products/ce-formula-flash-cards",
      link: "shop",
    });
  });

  it("records no Product for a shop-wide button", async () => {
    const user = userEvent.setup();
    render(
      <StoreButton
        marketplace="tiktok"
        storeLink={{ href: "https://vt.tiktok.com/ZS49ve6cu/", link: "shop" }}
      />,
    );
    preventNavigation();
    await user.click(screen.getByRole("link", { name: "Buy on TikTok Shop (opens in a new tab)" }));
    expect(trackMarketplaceClick).toHaveBeenCalledWith(
      expect.objectContaining({ product: undefined, marketplace: "tiktok", link: "shop" }),
    );
  });

  it("reads Follow on Shopee for a Coming Soon Product's shop link", () => {
    render(
      <StoreButton
        marketplace="shopee"
        action="follow"
        storeLink={{ href: "https://shopee.ph/aceyourcourse", link: "shop" }}
        productSlug="ce-solving-notebook"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Follow on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://shopee.ph/aceyourcourse");
  });
});

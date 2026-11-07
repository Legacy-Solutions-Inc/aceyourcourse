import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComingSoonNote } from "./coming-soon-note";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/ce-solving-notebook" }));

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: null,
};

describe("ComingSoonNote", () => {
  it("offers Follow on Shopee, to the shop page, and no buy buttons", () => {
    render(<ComingSoonNote productSlug="ce-solving-notebook" shopLinks={SHOP_LINKS} />);
    expect(
      screen.getByRole("link", { name: "Follow on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", SHOP_LINKS.shopee);
    expect(screen.queryByRole("link", { name: /^buy on/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/₱/)).not.toBeInTheDocument();
  });

  it("drops Follow on Shopee when there is no Shopee shop page", () => {
    render(
      <ComingSoonNote
        productSlug="ce-solving-notebook"
        shopLinks={{ ...SHOP_LINKS, shopee: null }}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/not out yet/i)).toBeInTheDocument();
  });
});

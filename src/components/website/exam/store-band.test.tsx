import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "@/lib/analytics/events";

import { StoreBand } from "./store-band";

vi.mock("next/navigation", () => ({ usePathname: () => "/exams/ce" }));
vi.mock("@/lib/analytics/events", () => ({ trackMarketplaceClick: vi.fn() }));

// The Exam page's store band: a button to each Marketplace's shop page, not a
// Product's Listing (docs/mockup/website/Exam_v2.dc.html L197–206).

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
};

describe("StoreBand", () => {
  it("links to each Marketplace's shop page in a new tab", () => {
    render(<StoreBand examCode="CE" shopLinks={SHOP_LINKS} />);
    expect(screen.getByText("Get your CE reviewer from our official stores.")).toBeInTheDocument();
    for (const [name, href] of [
      ["Shopee", SHOP_LINKS.shopee],
      ["Lazada", SHOP_LINKS.lazada],
      ["TikTok Shop", SHOP_LINKS.tiktok],
    ] as const) {
      const link = screen.getByRole("link", { name: `Buy on ${name} (opens in a new tab)` });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("hides a Marketplace with no shop link", () => {
    render(<StoreBand examCode="CE" shopLinks={{ ...SHOP_LINKS, lazada: null }} />);
    expect(screen.queryByRole("link", { name: /lazada/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("records a marketplace_click for the shop page, with no Product", async () => {
    const user = userEvent.setup();
    render(<StoreBand examCode="CE" shopLinks={SHOP_LINKS} />);
    await user.click(screen.getByRole("link", { name: /tiktok shop/i }));
    expect(trackMarketplaceClick).toHaveBeenCalledWith({
      marketplace: "tiktok",
      link: "shop",
      page: "/exams/ce",
      product: undefined,
    });
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "@/lib/analytics/events";
import { ABOUT_DEFAULTS } from "@/lib/catalogue/about-content";
import type { WebsiteSettings } from "@/services/catalogue.types";

import { IloiloRoots } from "./iloilo-roots";

// "Iloilo City roots" (docs/mockup/website/About_v2.dc.html L114–130): the copy,
// a button to each Marketplace's shop page, and the mock shipping label.

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));
vi.mock("@/lib/analytics/events", () => ({ trackMarketplaceClick: vi.fn() }));

const SHOP_LINKS: WebsiteSettings["shopLinks"] = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
};

const section = () =>
  within(
    screen.getByRole("region", {
      name: "Packed in Iloilo. Shipped to wherever you’re reviewing.",
    }),
  );
const stores = () => section().queryByRole("list", { name: "Our official stores" });
const shopButtons = () =>
  section()
    .queryAllByRole("link")
    .map((link) => [link.getAttribute("aria-label"), link.getAttribute("href")]);

describe("IloiloRoots", () => {
  afterEach(() => {
    vi.mocked(trackMarketplaceClick).mockClear();
  });

  it("tells where orders ship from", () => {
    render(<IloiloRoots copy={ABOUT_DEFAULTS.roots} shopLinks={SHOP_LINKS} />);
    expect(section().getByText("Iloilo City roots")).toBeInTheDocument();
    expect(section().getByText(/^We’re a small Visayas shop/)).toBeVisible();
  });

  it("has a button to each Marketplace's shop page, in a new tab", () => {
    render(<IloiloRoots copy={ABOUT_DEFAULTS.roots} shopLinks={SHOP_LINKS} />);
    expect(shopButtons()).toEqual([
      ["Buy on Shopee (opens in a new tab)", SHOP_LINKS.shopee],
      ["Buy on Lazada (opens in a new tab)", SHOP_LINKS.lazada],
      ["Buy on TikTok Shop (opens in a new tab)", SHOP_LINKS.tiktok],
    ]);
    for (const link of section().getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
    }
    expect(stores()).toBeInTheDocument();
  });

  it("records a marketplace_click for the shop page, about no Product", async () => {
    const user = userEvent.setup();
    render(<IloiloRoots copy={ABOUT_DEFAULTS.roots} shopLinks={SHOP_LINKS} />);
    document.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(section().getByRole("link", { name: /Lazada/ }));
    expect(trackMarketplaceClick).toHaveBeenCalledWith({
      product: undefined,
      marketplace: "lazada",
      page: "/about",
      link: "shop",
    });
  });

  it("hides the button of a Marketplace with no shop link", () => {
    render(<IloiloRoots copy={ABOUT_DEFAULTS.roots} shopLinks={{ ...SHOP_LINKS, lazada: null }} />);
    expect(shopButtons()).toEqual([
      ["Buy on Shopee (opens in a new tab)", SHOP_LINKS.shopee],
      ["Buy on TikTok Shop (opens in a new tab)", SHOP_LINKS.tiktok],
    ]);
  });

  it("renders no empty list of stores with no shop links", () => {
    render(
      <IloiloRoots
        copy={ABOUT_DEFAULTS.roots}
        shopLinks={{ shopee: null, lazada: null, tiktok: null }}
      />,
    );
    expect(shopButtons()).toEqual([]);
    expect(stores()).toBeNull();
  });

  it("shows the mock shipping label from Iloilo City", () => {
    render(<IloiloRoots copy={ABOUT_DEFAULTS.roots} shopLinks={SHOP_LINKS} />);
    const label = within(section().getByRole("figure", { name: "Shipping label" }));
    expect(label.getByText("AceYourCourse")).toBeInTheDocument();
    expect(label.getByText("Iloilo City, Iloilo")).toBeInTheDocument();
    expect(label.getByText("Future RCE, RME, REE, RMT, CPA")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "@/lib/analytics/events";
import type { PromoBanner } from "@/services/catalogue.types";

import { PromoStrip } from "./promo-strip";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/analytics/events", () => ({ trackMarketplaceClick: vi.fn() }));

// The dated promo strip at the top of Home, set in the Admin's "Home promo
// banner" (docs/mockup/admin/BUILD-MAP.md §3.2). It shows from 00:00 Manila on
// its start date until 23:59:59 Manila on its end date.

const elevenEleven: PromoBanner = {
  visible: true,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-09",
  endDate: "2026-11-11",
};
/** 00:00 Manila on 9 Nov, the first second of the sale. */
const START = new Date("2026-11-08T16:00:00Z");
/** 23:59:59 Manila on 11 Nov, its last second. */
const LAST_SECOND = new Date("2026-11-11T15:59:59Z");

const strip = () => screen.queryByRole("complementary", { name: "Sale" });
const button = () => screen.getByRole("link", { name: /^Shop the sale/ });

describe("PromoStrip", () => {
  afterEach(() => {
    vi.mocked(trackMarketplaceClick).mockClear();
  });

  it.each([
    ["from its first second", START],
    ["until its last second", LAST_SECOND],
  ])("shows its text and button %s", (_when, now) => {
    render(<PromoStrip banner={elevenEleven} now={now} memberAppLive={false} />);
    expect(strip()).toHaveTextContent("11.11 · Any 2 reviewers, 4% off on Shopee");
    expect(button()).toHaveAttribute("href", "https://shopee.ph/aceyourcourse");
  });

  it.each([
    [
      "one second before it starts",
      { banner: elevenEleven, now: new Date("2026-11-08T15:59:59Z") },
    ],
    ["one second after it ends", { banner: elevenEleven, now: new Date("2026-11-11T16:00:00Z") }],
    ["while it is turned off", { banner: { ...elevenEleven, visible: false }, now: START }],
    ["with no banner", { banner: null, now: START }],
  ])("renders nothing %s", (_when, { banner, now }) => {
    const { container } = render(<PromoStrip banner={banner} now={now} memberAppLive={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a Marketplace link in a new tab and records a shop marketplace_click", async () => {
    const user = userEvent.setup();
    render(<PromoStrip banner={elevenEleven} now={START} memberAppLive={false} />);
    expect(button()).toHaveAttribute("target", "_blank");
    expect(button()).toHaveAttribute("rel", "noopener noreferrer");
    expect(button()).toHaveAccessibleName(/opens in a new tab/);
    await user.click(button());
    expect(trackMarketplaceClick).toHaveBeenCalledWith({
      marketplace: "shopee",
      link: "shop",
      page: "/",
      product: undefined,
    });
  });

  it("opens any other site in a new tab without recording a marketplace_click", async () => {
    const user = userEvent.setup();
    render(
      <PromoStrip
        banner={{ ...elevenEleven, href: "https://www.facebook.com/aceyourcourse" }}
        now={START}
        memberAppLive={false}
      />,
    );
    expect(button()).toHaveAttribute("href", "https://www.facebook.com/aceyourcourse");
    expect(button()).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(button());
    expect(trackMarketplaceClick).not.toHaveBeenCalled();
  });

  it("keeps a Website path in the same tab", () => {
    render(
      <PromoStrip
        banner={{ ...elevenEleven, href: "/products?format=posters" }}
        now={START}
        memberAppLive={false}
      />,
    );
    expect(button()).toHaveAttribute("href", "/products?format=posters");
    expect(button()).not.toHaveAttribute("target");
  });

  it("hides a sale that links into the Member App while the switch is off", () => {
    const appSale = { ...elevenEleven, href: "/app/plans" };
    const { container, rerender } = render(
      <PromoStrip banner={appSale} now={START} memberAppLive={false} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<PromoStrip banner={appSale} now={START} memberAppLive />);
    expect(button()).toHaveAttribute("href", "/app/plans");
    expect(button()).not.toHaveAttribute("target");
  });
});

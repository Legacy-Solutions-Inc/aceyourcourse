import posthog from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackMarketplaceClick } from "./events";

// posthog-js is the external SDK boundary: replace it so no network is touched,
// and flip `__loaded` the way a real init (or no key) would.
vi.mock("posthog-js", () => ({
  default: { __loaded: false, capture: vi.fn() },
}));

const capture = vi.mocked(posthog.capture);

describe("trackMarketplaceClick", () => {
  beforeEach(() => {
    capture.mockReset();
  });

  afterEach(() => {
    posthog.__loaded = false;
  });

  it("captures marketplace_click with the Product, Marketplace, page and link", () => {
    posthog.__loaded = true;

    trackMarketplaceClick({
      product: "ce-formula-flash-cards",
      marketplace: "shopee",
      page: "/products/ce-formula-flash-cards",
      link: "listing",
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith("marketplace_click", {
      product: "ce-formula-flash-cards",
      marketplace: "shopee",
      page: "/products/ce-formula-flash-cards",
      link: "listing",
    });
  });

  it("sends no product property for a shop link", () => {
    posthog.__loaded = true;

    trackMarketplaceClick({ marketplace: "lazada", page: "/", link: "shop" });

    expect(capture).toHaveBeenCalledWith("marketplace_click", {
      marketplace: "lazada",
      page: "/",
      link: "shop",
    });
  });

  it("neither throws nor captures when PostHog isn't loaded", () => {
    posthog.__loaded = false;

    expect(() =>
      trackMarketplaceClick({ marketplace: "tiktok", page: "/", link: "shop" }),
    ).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });
});

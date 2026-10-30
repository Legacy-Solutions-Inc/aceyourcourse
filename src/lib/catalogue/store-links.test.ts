import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { followLink, resolveStoreLink, storeLinksFor } from "./store-links";

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: null,
};

const LISTING = "https://shopee.ph/CE-Formula-Flash-Cards-i.1276620555.24292303887";

describe("resolveStoreLink", () => {
  it("uses the Product's own Listing first", () => {
    const product = testLiveProduct({ listings: { shopee: LISTING } });
    expect(resolveStoreLink(product, "shopee", SHOP_LINKS)).toEqual({
      href: LISTING,
      link: "listing",
    });
  });

  it("falls back to the Marketplace's shop page when the Product has no Listing there", () => {
    const product = testLiveProduct({ listings: { shopee: LISTING } });
    expect(resolveStoreLink(product, "lazada", SHOP_LINKS)).toEqual({
      href: "https://www.lazada.com.ph/shop/aceyourcourse",
      link: "shop",
    });
  });

  it("is null, hiding the button, with neither a Listing nor a shop page", () => {
    const product = testLiveProduct({ listings: {} });
    expect(resolveStoreLink(product, "tiktok", SHOP_LINKS)).toBeNull();
  });

  it("links to the shop page when there is no Product", () => {
    expect(resolveStoreLink(null, "shopee", SHOP_LINKS)).toEqual({
      href: "https://shopee.ph/aceyourcourse",
      link: "shop",
    });
    expect(resolveStoreLink(null, "tiktok", SHOP_LINKS)).toBeNull();
  });

  it.each(["shopee", "lazada", "tiktok"] as const)(
    "never gives a Coming Soon Product a %s buy link, even with a shop page",
    (marketplace) => {
      expect(resolveStoreLink(testComingSoonProduct(), marketplace, SHOP_LINKS)).toBeNull();
    },
  );
});

describe("storeLinksFor", () => {
  it("lists a store link per Marketplace that has somewhere to go, in display order", () => {
    expect(storeLinksFor(testLiveProduct({ listings: { shopee: LISTING } }), SHOP_LINKS)).toEqual([
      { marketplace: "shopee", storeLink: { href: LISTING, link: "listing" } },
      {
        marketplace: "lazada",
        storeLink: { href: "https://www.lazada.com.ph/shop/aceyourcourse", link: "shop" },
      },
    ]);
  });

  it("is empty for a Coming Soon Product, or with nowhere to go", () => {
    expect(storeLinksFor(testComingSoonProduct(), SHOP_LINKS)).toEqual([]);
    expect(
      storeLinksFor(testLiveProduct({ listings: {} }), {
        shopee: null,
        lazada: null,
        tiktok: null,
      }),
    ).toEqual([]);
  });
});

describe("followLink", () => {
  it("is the Shopee shop page", () => {
    expect(followLink(SHOP_LINKS)).toEqual({
      href: "https://shopee.ph/aceyourcourse",
      link: "shop",
    });
  });

  it("is null when there is no Shopee shop page", () => {
    expect(followLink({ ...SHOP_LINKS, shopee: null })).toBeNull();
  });
});

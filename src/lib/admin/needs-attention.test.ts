import { describe, expect, it } from "vitest";

import type { OverviewSettings } from "@/services/admin.types";
import type { ExamPage, Product, PromoBanner, WebsiteSettings } from "@/services/catalogue.types";

import { testComingSoonProduct, testExam, testLiveProduct } from "../../../test/fixtures/catalogue";
import { type NeedsAttentionInput, needsAttention, needsYouToday } from "./needs-attention";

// The Overview's Needs attention list (spec, Phase 2 story 61; BUILD-MAP
// §3.1): what needs Staff today, each item linking to the screen that fixes
// it, worked out from the catalogue and today's date in Manila.

// 10:00 Manila on Tuesday 3 Nov 2026.
const NOW = new Date("2026-11-03T02:00:00Z");

const SHOP_LINKS: WebsiteSettings["shopLinks"] = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/",
};

/** Every Marketplace with the Product's own Listing, so nothing uses a shop page. */
const ALL_LISTINGS: Product["listings"] = {
  shopee: "https://shopee.ph/product-i.1.2",
  lazada: "https://www.lazada.com.ph/products/product-i1.html",
  tiktok: "https://www.tiktok.com/view/product/1",
};

const BANNER: PromoBanner = {
  visible: true,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
};

/** A page whose search title and description both fit a search result. */
const goodPage = (examCode: string): ExamPage => ({
  examCode,
  sections: { subjects: true, bundleOffer: true, reviews: true },
  bundleOffer: null,
  seoTitle: `${examCode} Board Exam Formula Reviewers`,
  seoDescription:
    "Formula flash cards, notebooks and posters for the board exam, made by topnotchers and sold on Shopee.",
  shareImage: null,
  officialExamDate: null,
});

/** Nothing needs attention: every item's opposite. Each test changes one thing. */
function input(overrides: Partial<NeedsAttentionInput> = {}): NeedsAttentionInput {
  return {
    products: [testLiveProduct({ listings: ALL_LISTINGS })],
    settings: {
      shopLinks: SHOP_LINKS,
      shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
      promoBanner: BANNER,
    },
    exams: [testExam()],
    examPages: [goodPage("CE")],
    now: NOW,
    role: "owner",
    ...overrides,
  };
}

const withSettings = (settings: Partial<OverviewSettings>) =>
  input({ settings: { ...input().settings, ...settings } });

const kinds = (given: NeedsAttentionInput) => needsAttention(given).map((item) => item.kind);

describe("needsAttention", () => {
  it("lists nothing when nothing needs Staff", () => {
    expect(needsAttention(input())).toEqual([]);
  });

  describe("product links that use the shop page", () => {
    it("counts each Live Product's store button that opens a Marketplace's shop page", () => {
      const items = needsAttention(
        input({
          products: [
            testLiveProduct({ id: "a", listings: { shopee: ALL_LISTINGS.shopee } }),
            testLiveProduct({ id: "b", listings: { ...ALL_LISTINGS, tiktok: undefined } }),
            testLiveProduct({ id: "c", listings: ALL_LISTINGS }),
          ],
        }),
      );
      expect(items).toEqual([
        {
          kind: "missing-links",
          title: "3 product links use the shop page",
          detail:
            "Lazada and TikTok Shop buttons open the shop. Add product links to go straight to each item.",
          action: "Add links",
          href: "/admin/products?missing=1",
          tone: "warning",
        },
      ]);
    });

    it("says “1 product link uses” for one, naming its one Marketplace", () => {
      const [item] = needsAttention(
        input({
          products: [testLiveProduct({ listings: { ...ALL_LISTINGS, lazada: undefined } })],
        }),
      );
      expect(item?.title).toBe("1 product link uses the shop page");
      expect(item?.detail).toBe(
        "Lazada buttons open the shop. Add product links to go straight to each item.",
      );
    });

    it("never counts a Coming Soon Product, which has no store buttons", () => {
      expect(kinds(input({ products: [testComingSoonProduct({ listings: {} })] }))).toEqual([]);
    });

    it("doesn't count a Marketplace with no shop page, whose button the Website hides", () => {
      expect(
        kinds(withSettings({ shopLinks: { ...SHOP_LINKS, lazada: null, tiktok: null } })).includes(
          "missing-links",
        ),
      ).toBe(false);
      // The default Product has every Listing; this one has none, and only Shopee has a shop page.
      const [item] = needsAttention({
        ...withSettings({ shopLinks: { ...SHOP_LINKS, lazada: null, tiktok: null } }),
        products: [testLiveProduct({ listings: {} })],
      });
      expect(item?.title).toBe("1 product link uses the shop page");
    });
  });

  describe("the promo banner", () => {
    it.each([
      ["turned off", { ...BANNER, visible: false }],
      ["missing", null],
      ["past its end date", { ...BANNER, startDate: "2026-10-01", endDate: "2026-11-02" }],
    ])("is off when it's %s", (_, promoBanner) => {
      expect(needsAttention(withSettings({ promoBanner }))).toEqual([
        {
          kind: "promo",
          title: "Promo banner is off",
          detail: "Turn it on in Exam pages & promo when the next sale starts.",
          action: "Open",
          href: "/admin/exam-pages?page=promo",
          tone: "quiet",
        },
      ]);
    });

    it("is listed when it's on and ends in exactly 3 days in Manila", () => {
      expect(
        needsAttention(withSettings({ promoBanner: { ...BANNER, endDate: "2026-11-06" } })),
      ).toEqual([
        {
          kind: "promo",
          title: "Promo banner ends 6 Nov",
          detail: "It turns itself off after that day. Set the next sale in Exam pages & promo.",
          action: "Open",
          href: "/admin/exam-pages?page=promo",
          tone: "warning",
        },
      ]);
    });

    it.each([
      ["today", "2026-11-03"],
      ["tomorrow", "2026-11-04"],
    ])("is listed when it's on and ends %s", (_, endDate) => {
      expect(kinds(withSettings({ promoBanner: { ...BANNER, endDate } }))).toEqual(["promo"]);
    });

    it("isn't listed when it's on and ends in 4 days", () => {
      expect(kinds(withSettings({ promoBanner: { ...BANNER, endDate: "2026-11-07" } }))).toEqual(
        [],
      );
    });

    it("counts the days in Manila: at 23:30 Manila on 3 Nov, a 7 Nov end is 4 days away", () => {
      const late = new Date("2026-11-03T15:30:00Z");
      const banner = withSettings({ promoBanner: { ...BANNER, endDate: "2026-11-07" } });
      expect(kinds({ ...banner, now: late })).toEqual([]);
      // 30 minutes later it's 4 Nov in Manila, 3 days before the end.
      expect(kinds({ ...banner, now: new Date("2026-11-03T16:00:00Z") })).toEqual(["promo"]);
    });

    it("isn't listed while it waits for its start, even with a near end", () => {
      expect(
        kinds(
          withSettings({
            promoBanner: { ...BANNER, startDate: "2026-11-05", endDate: "2026-11-05" },
          }),
        ),
      ).toEqual([]);
    });
  });

  describe("Exam pages that need search fixes", () => {
    it("counts each Exam page whose search check isn't GOOD, opening the first one's SEO", () => {
      const items = needsAttention(
        input({
          exams: [testExam(), testExam({ code: "ME" }), testExam({ code: "EE" })],
          examPages: [
            goodPage("CE"),
            { ...goodPage("ME"), seoTitle: "T".repeat(50) },
            { ...goodPage("EE"), seoDescription: "Too short." },
          ],
        }),
      );
      expect(items).toEqual([
        {
          kind: "search",
          title: "2 exam pages need search fixes",
          detail: "ME · EE: the title or description doesn't fit a search result.",
          action: "Fix",
          href: "/admin/exam-pages?exam=me&section=seo",
          tone: "warning",
        },
      ]);
    });

    it("checks the generated title and description of an Exam without a page record", () => {
      // testExam's generated description is shorter than 80 characters.
      const [item] = needsAttention(input({ examPages: [] }));
      expect(item).toMatchObject({
        title: "1 exam page needs search fixes",
        href: "/admin/exam-pages?exam=ce&section=seo",
      });
    });
  });

  describe("Products hidden from the Website", () => {
    it("counts every Product with Show on website off, Coming Soon ones too", () => {
      const items = needsAttention(
        input({
          products: [
            testLiveProduct({ id: "a", listings: ALL_LISTINGS, showOnWebsite: false }),
            testComingSoonProduct({ id: "b", showOnWebsite: false }),
            testLiveProduct({ id: "c", listings: ALL_LISTINGS }),
          ],
        }),
      );
      expect(items).toEqual([
        {
          kind: "hidden",
          title: "2 products are hidden from the website",
          detail: "Visitors can't see them. Turn on Show on website once they're ready.",
          action: "Review",
          href: "/admin/products",
          tone: "info",
        },
      ]);
    });

    it("says “1 product is hidden” for one", () => {
      const [item] = needsAttention(
        input({ products: [testLiveProduct({ listings: ALL_LISTINGS, showOnWebsite: false })] }),
      );
      expect(item?.title).toBe("1 product is hidden from the website");
      expect(item?.detail).toBe("Visitors can't see it. Turn on Show on website once it's ready.");
    });
  });

  describe("trust figures", () => {
    const asOf = (date: string) => ({ ...input().settings.shopStats, asOf: date });

    it("aren't listed exactly 30 days old", () => {
      expect(kinds(withSettings({ shopStats: asOf("2026-10-04") }))).toEqual([]);
    });

    it("are listed for an Owner 31 days old", () => {
      expect(needsAttention(withSettings({ shopStats: asOf("2026-10-03") }))).toEqual([
        {
          kind: "trust-figures",
          title: "Trust figures are 31 days old",
          detail: "The Shopee rating and followers are from 3 Oct 2026. Copy today's from Shopee.",
          action: "Update",
          href: "/admin/settings",
          tone: "warning",
        },
      ]);
    });

    it("are never listed for an Editor, even 90 days old", () => {
      expect(kinds({ ...withSettings({ shopStats: asOf("2026-08-05") }), role: "editor" })).toEqual(
        [],
      );
    });
  });

  it("lists every item in order: links, banner, search, hidden, trust figures", () => {
    const items = needsAttention({
      ...withSettings({
        promoBanner: null,
        shopStats: { ...input().settings.shopStats, asOf: "2026-01-01" },
      }),
      products: [testLiveProduct({ listings: {}, showOnWebsite: false })],
      examPages: [],
    });
    expect(items.map((item) => item.kind)).toEqual([
      "missing-links",
      "promo",
      "search",
      "hidden",
      "trust-figures",
    ]);
  });
});

describe("needsYouToday", () => {
  it.each([
    [0, "Nothing needs you today."],
    [1, "1 thing needs you today."],
    [5, "5 things need you today."],
  ])("says %i as “%s”", (count, line) => {
    expect(needsYouToday(count)).toBe(line);
  });
});

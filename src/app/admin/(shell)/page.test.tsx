import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CatalogueSeed, examPageDefaults } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../../test/catalogue-seed";
import OverviewPage from "./page";

// The Overview (spec, Phase 2 story 61; BUILD-MAP §3.1), rendered from the
// sample data: the greeting, the quick actions, and what needs Staff today;
// and for an Owner, the sales tiles, the paid-sales chart and the payment
// work (Phase 4, ticket 11; stories 151, 151w and 151x).
// The cookie jar and redirect() are the framework boundary, so they are
// replaced. The signed-out and not-Staff redirects are in pages.test.tsx.
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
  usePathname: () => "/admin",
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";

// 10:00 Manila on Tuesday 3 Nov 2026: the seed's trust figures are 5 days old.
const NOW = new Date("2026-11-03T02:00:00Z");

async function renderOverview(email: string) {
  jar.set("ayc_admin_sample", email);
  render(await OverviewPage());
}

/** Gives CPA's page a description that fits a search result: the seed's generated one is too short. */
function fixCpaSearch(seed: CatalogueSeed) {
  const page = seed.examPages.find((p) => p.examCode === "CPA") ?? examPageDefaults("CPA");
  page.seoDescription =
    "Accountancy flash cards and posters for the CPA board exam, made by topnotchers and sold on Shopee.";
  if (!seed.examPages.includes(page)) seed.examPages.push(page);
}

const needsAttention = () => screen.queryByRole("list", { name: "Needs attention" });
const rows = () =>
  within(screen.getByRole("list", { name: "Needs attention" })).getAllByRole("link");

describe("Overview page", () => {
  beforeEach(() => {
    jar.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetSampleStore();
    // An Owner's page has the chart, which jsdom can't lay out: it watches its
    // size with this, and warns that it has none.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetSampleStore();
  });

  it("greets the Owner with what needs them today on the sample data, each linking to its fix", async () => {
    await renderOverview(OWNER);

    expect(screen.getByText("TUESDAY · 3 NOV 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Good morning, Angel." })).toBeVisible();
    expect(screen.getByText("3 things need you today.")).toBeInTheDocument();

    const heading = screen.getByRole("heading", { name: "Needs attention" });
    expect(heading.parentElement).toHaveTextContent(/^Needs attention3$/);
    expect(rows().map((row) => [row.textContent, row.getAttribute("href")])).toEqual([
      [
        "16 product links use the shop pageLazada and TikTok Shop buttons open the shop. Add product links to go straight to each item.Add links →",
        "/admin/products?missing=1",
      ],
      [
        "Promo banner is offTurn it on in Pages & promo when the next sale starts.Open →",
        "/admin/exam-pages?page=promo",
      ],
      [
        "1 exam page needs search fixesCPA: the title or description doesn't fit a search result.Fix →",
        "/admin/exam-pages?exam=cpa&section=seo",
      ],
    ]);
  });

  it("offers + Add product, + Add Review and + Add FAQ, each opening its new form", async () => {
    await renderOverview(EDITOR);
    const actions = screen.getByRole("navigation", { name: "Quick actions" });
    expect(
      within(actions)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["+Add product", "/admin/products?product=new"],
      ["+Add Review", "/admin/reviews?review=new"],
      ["+Add FAQ", "/admin/reviews?tab=faqs&faq=new"],
    ]);
  });

  it("tells an Owner that trust figures 31 days old need updating, in Settings", async () => {
    editSampleCatalogue((seed) => {
      seed.settings.shopStats.asOf = "2026-10-03";
    });
    await renderOverview(OWNER);
    expect(screen.getByText("4 things need you today.")).toBeInTheDocument();
    const trust = rows().at(-1);
    expect(trust).toHaveTextContent(/^Trust figures are 31 days old/);
    expect(trust).toHaveAttribute("href", "/admin/settings");
  });

  it("never shows an Editor the trust figures, even 90 days old", async () => {
    editSampleCatalogue((seed) => {
      seed.settings.shopStats.asOf = "2026-08-05";
    });
    await renderOverview(EDITOR);
    expect(screen.getByText("Good morning, AYC.")).toBeInTheDocument();
    expect(screen.getByText("3 things need you today.")).toBeInTheDocument();
    expect(screen.queryByText(/Trust figures/)).not.toBeInTheDocument();
  });

  it("says “1 thing needs you today.” for one item", async () => {
    editSampleCatalogue((seed) => {
      seed.settings.shopLinks.lazada = null;
      seed.settings.shopLinks.tiktok = null;
      fixCpaSearch(seed);
    });
    await renderOverview(OWNER);
    expect(screen.getByText("1 thing needs you today.")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it("says “Nothing needs you today.”, with no list, once everything is fixed", async () => {
    editSampleCatalogue((seed) => {
      seed.settings.shopLinks.lazada = null;
      seed.settings.shopLinks.tiktok = null;
      if (seed.settings.promoBanner) {
        seed.settings.promoBanner = {
          ...seed.settings.promoBanner,
          visible: true,
          startDate: "2026-11-01",
          endDate: "2026-11-30",
        };
      }
      fixCpaSearch(seed);
    });
    await renderOverview(OWNER);
    expect(screen.getByText("Nothing needs you today.")).toBeInTheDocument();
    expect(needsAttention()).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
  });

  // The dev server's sample Orders, made relative to NOW (10:00 on 3 Nov in
  // Manila): today Bea's ₱1,299 and Lou's ₱499 were paid, and ₱300 and ₱499
  // refunded; Maria's ₱499, made 1 Nov, was paid yesterday at noon, after it
  // expired; Karen's ₱1,299 on 31 Oct, Paolo's ₱499 on 28 Oct, Jose's ₱449 on
  // 25 Oct; Paolo's ₱449 has been Pending an hour; Maria's 14 Oct Order has
  // an invoice to send; and a Test Order never counts.
  describe("an Owner's sales (ticket 11)", () => {
    const tiles = () =>
      within(screen.getByRole("list", { name: "Sales figures" }))
        .getAllByRole("link")
        .map((tile) => [tile.textContent, tile.getAttribute("href")]);

    beforeEach(() => {
      resetSampleStore(CATALOGUE_SEED, { sampleOrders: true });
    });

    it("shows today's and this month's money, a refund today taken off today, matching the Orders", async () => {
      await renderOverview(OWNER);

      expect(tiles()).toEqual([
        ["PAID TODAY₱999+₱500 vs yesterday₱799 refunded", "/admin/orders?status=paid&range=7d"],
        ["PAID · NOVEMBER₱1,498+₱1,498 vs 1–3 Oct₱799 refunded", "/admin/orders?status=paid"],
        ["ACTIVE MEMBERS0Paid or granted access", "/admin/users?filter=active"],
        ["ACCESS ENDING · 7 DAYS0Nothing renews automatically", "/admin/users?filter=active"],
      ]);
    });

    it("shows the paid-sales chart over the last 14 days, today's last", async () => {
      await renderOverview(OWNER);

      expect(screen.getByRole("heading", { name: "Paid sales" })).toBeInTheDocument();
      expect(screen.getByText("NET PAID · LAST 14 DAYS · ₱3,745")).toBeInTheDocument();
      const days = within(screen.getByRole("table", { name: "Net paid by day" }))
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent);
      expect(days).toHaveLength(14);
      expect(days.slice(-3)).toEqual(["1 Nov₱0", "2 Nov₱499", "3 Nov, today₱999"]);
    });

    it("lists the payment work first in Needs attention, each opening the filtered Orders", async () => {
      await renderOverview(OWNER);

      expect(screen.getByText("7 things need you today.")).toBeInTheDocument();
      expect(
        rows()
          .slice(0, 4)
          .map((row) => [row.textContent, row.getAttribute("href")]),
      ).toEqual([
        [
          "1 payment pendingOldest is 1 hour old. Pending payments expire after 24 hours.Review →",
          "/admin/orders?status=pending",
        ],
        [
          "1 invoice request to sendSend each official invoice from the support inbox, then mark it sent on its Order.Send →",
          "/admin/orders?range=all&invoice=requested",
        ],
        [
          "1 Order paid after expiryPayMongo confirmed it after the Order had expired, in the last 7 days, and its days were added. Check the Member didn’t pay twice.Review →",
          "/admin/orders?status=paid&range=7d&late=1",
        ],
        [
          "Paid, account deleted · refund in PayMongo1 payment landed after the Member’s account was deleted, so it gave no access. Refund it in the PayMongo dashboard.Review →",
          "/admin/orders?status=paid&range=all&noaccount=1",
        ],
      ]);
    });

    it("shows an Editor no sales tiles, chart or payment work", async () => {
      await renderOverview(EDITOR);

      expect(screen.queryByRole("list", { name: "Sales figures" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Paid sales" })).not.toBeInTheDocument();
      expect(screen.getByText("3 things need you today.")).toBeInTheDocument();
      expect(screen.queryByText(/payment|invoice|paid after expiry/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/₱/)).not.toBeInTheDocument();
    });
  });

  it("shows an Owner ₱0 tiles and no payment work with no Orders at all", async () => {
    await renderOverview(OWNER);

    expect(screen.getByRole("list", { name: "Sales figures" })).toHaveTextContent(
      /^PAID TODAY₱0Same as yesterday₱0 refundedPAID · NOVEMBER₱0Same as 1–3 Oct₱0 refunded/,
    );
    expect(screen.getByText("NET PAID · LAST 14 DAYS · ₱0")).toBeInTheDocument();
    expect(screen.getByText("3 things need you today.")).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).not.toContainEqual(
      expect.stringMatching(/payment|invoice|paid after expiry/i),
    );
  });

  it("has none of the recent orders, members or top-selling panels", async () => {
    await renderOverview(OWNER);
    for (const text of [/recent orders/i, /plans ending/i, /top-selling/i, /sales are up/i]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });
});

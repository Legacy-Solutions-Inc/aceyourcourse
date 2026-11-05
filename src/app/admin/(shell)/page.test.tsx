import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CatalogueSeed, examPageDefaults } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../../test/catalogue-seed";
import OverviewPage from "./page";

// The Overview (spec, Phase 2 story 61; BUILD-MAP §3.1), rendered from the
// sample data: the greeting, the quick actions, and what needs Staff today.
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
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("has none of Phase 4's sales, orders or member panels", async () => {
    await renderOverview(OWNER);
    for (const text of [
      /paid today/i,
      /paid sales/i,
      /recent orders/i,
      /active members/i,
      /plans ending/i,
      /top-selling/i,
      /sales are up/i,
      /₱/,
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });
});

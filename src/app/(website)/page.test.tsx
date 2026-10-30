import { render, screen, within } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";

// Home rendered from the real seed, with the Member App switch off and on
// (e2e/home.spec.ts runs with it off only). The seed has 8 Live Products
// across 5 Exams (CE cards 764 sold, ME cards 404, CPA cards 273, EE cards
// 240, CE posters 172, MT notebook 96, MT cards 18, CE bundle 16) and 7
// Coming Soon. The shop's figures are 4.8 from 874 ratings, as of 29 Oct 2026.

type PageModule = typeof import("./page");

// The switch is read once, when the seam loads, so the page is imported once
// per switch state.
const pages = new Map<boolean, Promise<PageModule>>();
function loadPage(memberAppLive: boolean): Promise<PageModule> {
  let page = pages.get(memberAppLive);
  if (!page) {
    vi.stubEnv("MEMBER_APP_LIVE", memberAppLive ? "true" : "false");
    vi.resetModules();
    page = import("./page");
    pages.set(memberAppLive, page);
  }
  return page;
}

async function renderHome({ memberAppLive = false } = {}) {
  const { default: HomePage } = await loadPage(memberAppLive);
  return render(await HomePage());
}

/** Home from an edited copy of the seed, with the switch off. */
async function renderHomeFromSeed(editSeed: (seed: CatalogueSeed) => void) {
  vi.stubEnv("MEMBER_APP_LIVE", "false");
  vi.resetModules();
  vi.doMock("@/services/mock/catalogue", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/services/mock/catalogue")>();
    const seed = structuredClone(real.CATALOGUE_SEED);
    editSeed(seed);
    return { CATALOGUE_SEED: seed };
  });
  const { default: HomePage } = await import("./page");
  vi.doUnmock("@/services/mock/catalogue");
  return render(await HomePage());
}

const hero = () => screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
const bestSellers = () => within(screen.getByRole("list", { name: "Best sellers" }));

describe("Home", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is titled and described, with / as the canonical URL", async () => {
    const { generateMetadata } = await loadPage(false);
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Board exam reviewers made by passers");
    expect(metadata.description).toMatch(/^Formula flash cards, notebooks and posters/);
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph).toMatchObject({
      url: "/",
      images: [{ url: "/opengraph-image" }],
    });
  });

  it("opens with the hero: the H1, the trust line with its date, and the CTAs", async () => {
    await renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Remember every formula on board day." }),
    ).toBeInTheDocument();
    const trust = within(hero());
    expect(trust.getByRole("img", { name: "5 stars" })).toHaveTextContent("★★★★★");
    expect(trust.getByText("4.8 from 874 ratings")).toBeInTheDocument();
    expect(trust.getByText("IPOPHIL registered")).toBeInTheDocument();
    expect(trust.getByText("as of Oct 2026")).toBeInTheDocument();
    expect(trust.getByRole("link", { name: "Find your exam" })).toHaveAttribute("href", "#exams");
    expect(trust.getByRole("link", { name: "Watch 1 min" })).toHaveAttribute("href", "#video");
    expect(trust.getByRole("button", { name: "Play video" })).toBeInTheDocument();
    expect(trust.getByRole("button", { name: "Flip card" })).toBeInTheDocument();
  });

  it("runs the ticker with the shop's figures and every Exam code", async () => {
    await renderHome();
    const ticker = screen.getByRole("region", { name: "Why reviewees choose us" });
    expect(ticker).toHaveTextContent("★ 4.8 shop rating");
    expect(ticker).toHaveTextContent("874 ratings");
    expect(ticker).toHaveTextContent("CE · ME · EE · MT · CPA");
  });

  it("offers every Exam in Find your exam, CE first, with its Live Products by units sold", async () => {
    await renderHome();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.firstElementChild?.textContent)).toEqual([
      "CE",
      "ME",
      "EE",
      "MT",
      "CPA",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const panel = within(screen.getByRole("tabpanel"));
    const rows = within(panel.getByRole("list", { name: /Choose a format/ }));
    expect(rows.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "CE Formula Flash Cards",
      "Ultimate CE Posters 2.0",
      "CE Review Bundle 3-in-1",
    ]);
  });

  it("ranks the top 6 best sellers by units sold", async () => {
    await renderHome();
    expect(
      bestSellers()
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "CE Formula Flash Cards",
      "ME Formula Flash Cards",
      "CPA Flash Cards",
      "EE Flash Cards",
      "Ultimate CE Posters 2.0",
      "MedTech Essential Notebook",
    ]);
  });

  it("leaves an Exam whose Products are all Coming Soon out of the tabs and the ticker", async () => {
    await renderHomeFromSeed((seed) => {
      const eeCards = seed.products.find((p) => p.slug === "ee-flash-cards");
      if (!eeCards) throw new Error("the seed has no EE Flash Cards");
      Object.assign(eeCards, {
        state: "coming-soon",
        priceFrom: null,
        priceTo: null,
        shopee: null,
      });
      Object.assign(eeCards, { variations: [], listings: {}, deal: false });
      // A Coming Soon Product has no Reviews, and the seed checks that.
      seed.reviews = seed.reviews.filter((r) => r.productId !== eeCards.id);
    });
    expect(screen.getAllByRole("tab").map((tab) => tab.firstElementChild?.textContent)).toEqual([
      "CE",
      "ME",
      "MT",
      "CPA",
    ]);
    expect(screen.getByRole("region", { name: "Why reviewees choose us" })).toHaveTextContent(
      "CE · ME · MT · CPA",
    );
    expect(screen.queryByText("EE Flash Cards")).toBeNull();
  });

  it("never shows a Coming Soon Product", async () => {
    await renderHome();
    for (const name of ["CE Solving Notebook", "ME Notebook", "MedTech Essentials Posters"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("never mentions or links to the app while the switch is off", async () => {
    const { container } = await renderHome();
    expect(container).not.toHaveTextContent(/\bapp\b/i);
    expect(container.querySelector('a[href^="/app"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Try the app free" })).toBeNull();
    expect(screen.getByText(/^Flash cards, notebooks, and posters/)).toHaveTextContent(
      /Shipped nationwide\.$/,
    );
  });

  it("offers the app in the hero, the steps and Find your exam while the switch is on", async () => {
    await renderHome({ memberAppLive: true });
    expect(screen.getByRole("link", { name: "Try the app free" })).toHaveAttribute("href", "/app");
    expect(screen.getByText(/^Flash cards, notebooks, and posters/)).toHaveTextContent(
      "Shipped nationwide, and also available in the app.",
    );
    expect(screen.getByRole("link", { name: "See app plans" })).toHaveAttribute(
      "href",
      "/app/plans",
    );
    expect(screen.getByRole("link", { name: "Review CE in the app" })).toHaveAttribute(
      "href",
      "/app",
    );
  });
});

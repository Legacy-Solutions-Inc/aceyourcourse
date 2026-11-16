import { render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../test/catalogue-seed";

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
  editSampleCatalogue(editSeed);
  const { default: HomePage } = await import("./page");
  return render(await HomePage());
}

const hero = () => screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
const bestSellers = () => within(screen.getByRole("list", { name: "Best sellers" }));
/** A Home section by its id, for queries inside it. */
function section(id: string) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Home has no #${id}`);
  return within(found);
}
/** The nearest element around `element` that matches `selector`, for queries inside it. */
function around(element: HTMLElement, selector: string) {
  const found = element.closest<HTMLElement>(selector);
  if (!found) throw new Error(`no ${selector} around "${element.textContent}"`);
  return within(found);
}
const formatCard = (title: string) =>
  around(section("formats").getByRole("heading", { level: 3, name: title }), "li");
const storeBand = () =>
  around(
    screen.getByRole("heading", { name: /^Physical copies from our official stores/ }),
    "section",
  );
const promoStrip = () => screen.queryByRole("complementary", { name: "Sale" });
const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

// Every test starts from the seed, whatever the one before it edited.
afterEach(() => {
  resetSampleStore();
});

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
      screen.getByRole("heading", { level: 1, name: "Remember every topic on board day." }),
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

  it("continues below Best sellers with formats, the video, Reviews, authenticity and the store band", async () => {
    await renderHome();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const bottomHalf = [
      "Best sellers",
      "Which format fits how you study?",
      "See what’s inside before you order.",
      "Pinned by reviewees",
      "Copies are going around. Make sure yours is the real one.",
      "Physical copies from our official stores.",
    ];
    expect(headings.slice(headings.indexOf("Best sellers"))).toEqual(bottomHalf);
    for (const id of ["exams", "formats", "video", "reviews", "authenticity"]) {
      expect(document.getElementById(id), `#${id}`).not.toBeNull();
    }
  });

  it("computes each format card's Exams and lowest Live price from the seed", async () => {
    await renderHome();
    const titles = section("formats")
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["Flash cards", "Notebook", "Posters", "Bundle"]);
    // The mockup hardcoded ₱550 for CE · ME · EE · MT · CPA, ₱699 for CE · ME
    // · EE · MT and ₱400 for CE · ME · EE · MT: only MT's notebook and CE's
    // posters are Live. The bundle shows its whole set, ₱3,499, not a part.
    for (const [title, exams, from] of [
      ["Flash cards", "For CE · ME · EE · MT · CPA", "₱550"],
      ["Notebook", "For MT", "₱699"],
      ["Posters", "For CE", "₱400"],
      ["Bundle", "For CE", "₱3,499"],
    ] as const) {
      expect(formatCard(title).getByText(exams), title).toBeInTheDocument();
      expect(formatCard(title).getByText(from), title).toBeInTheDocument();
    }
    expect(formatCard("Posters").getByRole("link", { name: "Posters" })).toHaveAttribute(
      "href",
      "/products?format=posters",
    );
  });

  it("works the bundle card's saving out from the bundle's options", async () => {
    await renderHome();
    // ₱1,200 + ₱1,249 + ₱1,250 for the parts, against ₱3,499 for the 3-in-1.
    expect(
      formatCard("Bundle").getByText(
        "All three CE formats in one order, ₱200 less than buying each separately.",
      ),
    ).toBeInTheDocument();
  });

  it("follows the catalogue when the 3-in-1's price changes", async () => {
    await renderHomeFromSeed((seed) => {
      for (const product of seed.products.filter((p) => p.format === "bundle")) {
        product.priceTo = 339900;
        for (const variation of product.variations) {
          if (variation.price === 349900) variation.price = 339900;
        }
      }
    });
    expect(
      formatCard("Bundle").getByText(/^All three CE formats in one order, ₱300 less/),
    ).toBeInTheDocument();
  });

  it("hides the card of a format with no Live Products on the Website", async () => {
    await renderHomeFromSeed((seed) => {
      for (const product of seed.products) {
        if (product.format === "bundle") product.showOnWebsite = false;
      }
    });
    expect(
      section("formats")
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Flash cards", "Notebook", "Posters"]);
  });

  it("plays the one-minute video with controls, downloading nothing before play", async () => {
    await renderHome();
    const video = section("video");
    expect(video.getByText("Watch · 1 min")).toBeInTheDocument();
    const player = video.getByLabelText("One-minute promo video");
    expect(player.tagName).toBe("VIDEO");
    expect(player).toHaveAttribute("src", "/media/ayc-promo-720p.mp4");
    expect(player).toHaveAttribute("poster", "/media/ayc-promo-poster.webp");
    expect(player).toHaveAttribute("preload", "none");
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("playsinline");
  });

  it("pins the 9 Home Reviews in two rows, the 3-star one included, with the shop's rating", async () => {
    await renderHome();
    const reviews = section("reviews");
    const row = (n: number) =>
      reviews.getByRole("region", { name: `Pinned reviews, row ${n} of 2` });
    expect(within(row(1)).getAllByRole("figure")).toHaveLength(5);
    expect(within(row(2)).getAllByRole("figure")).toHaveLength(4);
    const critical = reviews.getByRole("img", { name: "3 out of 5 stars" }).closest("figure");
    expect(critical).toHaveTextContent("MedTech Essential Notebook");
    expect(reviews.getByText("874 shop ratings")).toBeInTheDocument();
    expect(reviews.getByText("as of Oct 2026")).toBeInTheDocument();
    expect(reviews.getByRole("link", { name: /^Read every review on Shopee/ })).toHaveAttribute(
      "href",
      SHOPEE_SHOP,
    );
  });

  it("hides the Reviews wall when no Review is pinned", async () => {
    await renderHomeFromSeed((seed) => {
      for (const review of seed.reviews) review.homePin = null;
    });
    expect(document.getElementById("reviews")).toBeNull();
    expect(screen.queryByText("Pinned by reviewees")).toBeNull();
  });

  it("drops the Shopee links when the Shopee shop page is empty", async () => {
    await renderHomeFromSeed((seed) => {
      seed.settings.shopLinks.shopee = null;
    });
    expect(section("reviews").queryByRole("link", { name: /Read every review/ })).toBeNull();
    expect(storeBand().queryByRole("link", { name: /Shopee/ })).toBeNull();
    expect(storeBand().getAllByRole("link")).toHaveLength(2);
  });

  it("shows how to spot a fake copy, in three steps", async () => {
    await renderHome();
    const authenticity = section("authenticity");
    expect(authenticity.getByText("IPOPHIL")).toBeInTheDocument();
    expect(
      authenticity.getByText(/^Our reviewers are registered with IPOPHIL/),
    ).toBeInTheDocument();
    const steps = authenticity.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[1]).toHaveTextContent("Check the listing says Ships from Iloilo City.");
  });

  it("ends with the store band: a button to each shop page, and no app", async () => {
    await renderHome();
    const band = storeBand();
    expect(
      band.getByRole("heading", { name: "Physical copies from our official stores." }),
    ).toBeInTheDocument();
    for (const [name, href] of [
      ["Shopee", SHOPEE_SHOP],
      ["Lazada", "https://www.lazada.com.ph/shop/aceyourcourse"],
      ["TikTok Shop", "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop"],
    ] as const) {
      expect(
        band.getByRole("link", { name: `Buy on ${name} (opens in a new tab)` }),
      ).toHaveAttribute("href", href);
    }
    expect(band.queryByRole("link", { name: /Open the app/ })).toBeNull();
  });

  describe("the promo strip, set for 9–11 Nov 2026", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function renderHomeAt(now: string, { visible = true } = {}) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(now));
      await renderHomeFromSeed((seed) => {
        const banner = seed.settings.promoBanner;
        if (!banner) throw new Error("the seed has no promo banner");
        banner.visible = visible;
      });
    }

    it("stays hidden during the sale while turned off, as the seed has it", async () => {
      await renderHomeAt("2026-11-10T04:00:00Z", { visible: false });
      expect(promoStrip()).toBeNull();
    });

    it("tops Home, above the hero, from 00:00 Manila on 9 Nov", async () => {
      await renderHomeAt("2026-11-08T16:00:00Z");
      const strip = screen.getByRole("complementary", { name: "Sale" });
      expect(strip).toHaveTextContent("11.11 · Any 2 reviewers, 4% off on Shopee");
      expect(within(strip).getByRole("link", { name: /^Shop the sale/ })).toHaveAttribute(
        "href",
        SHOPEE_SHOP,
      );
      expect(strip.compareDocumentPosition(hero())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("is gone at 00:00 Manila on 12 Nov", async () => {
      await renderHomeAt("2026-11-11T16:00:00Z");
      expect(promoStrip()).toBeNull();
    });
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

  it("offers the app band in formats and the app in the store band while the switch is on", async () => {
    await renderHome({ memberAppLive: true });
    expect(section("formats").getByRole("link", { name: /^Prefer your phone\?/ })).toHaveAttribute(
      "href",
      "/app/plans",
    );
    const band = storeBand();
    expect(
      band.getByRole("heading", {
        name: "Physical copies from our official stores. Digital in the app.",
      }),
    ).toBeInTheDocument();
    expect(band.getByRole("link", { name: /^Open the app/ })).toHaveAttribute("href", "/app");
  });
});

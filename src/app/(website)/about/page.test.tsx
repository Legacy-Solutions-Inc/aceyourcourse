import { render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";

// About rendered from the real seed: 8 Live Products and 7 Coming Soon across
// 5 Exams (CE, ME, EE, MT, CPA; CPA has one Product, its flash cards). The
// shop's figures are 4.8 from 874 ratings and 3.7K followers, as of 29 Oct 2026.

vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));

type PageModule = typeof import("./page");

let page: Promise<PageModule> | undefined;
function loadPage(): Promise<PageModule> {
  if (!page) {
    vi.stubEnv("MEMBER_APP_LIVE", "false");
    vi.resetModules();
    page = import("./page");
  }
  return page;
}

async function renderAbout() {
  const { default: AboutPage } = await loadPage();
  return render(await AboutPage());
}

/** About from an edited copy of the seed. */
async function renderAboutFromSeed(editSeed: (seed: CatalogueSeed) => void) {
  vi.stubEnv("MEMBER_APP_LIVE", "false");
  vi.resetModules();
  vi.doMock("@/services/mock/catalogue", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/services/mock/catalogue")>();
    const seed = structuredClone(real.CATALOGUE_SEED);
    editSeed(seed);
    return { CATALOGUE_SEED: seed };
  });
  const { default: AboutPage } = await import("./page");
  vi.doUnmock("@/services/mock/catalogue");
  page = undefined;
  return render(await AboutPage());
}

/** An element's text as a screen reader reads it: without its aria-hidden parts. */
function spokenText(element: Element) {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent?.replace(/\s+/g, " ").trim();
}

const stats = () =>
  within(screen.getByRole("list", { name: "AceYourCourse in numbers" }))
    .getAllByRole("listitem")
    .map(spokenText);
const asOf = () => screen.queryByText(/^Shop figures from Shopee as of/);
const story = () =>
  within(screen.getByRole("region", { name: "We passed. Then we made what we wished we had." }));
const nowLine = () => story().getByText(/^Then came updated editions/).textContent;
const ctaTiles = () =>
  within(screen.getByRole("region", { name: "Your turn. Find the reviewer for your board." }))
    .getAllByRole("link")
    .map((link) => [spokenText(link), link.getAttribute("href")]);
const shopButtons = () =>
  within(screen.getByRole("list", { name: "Our official stores" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));

const hide = (seed: CatalogueSeed, keep: (examCode: string) => boolean) => {
  for (const product of seed.products) {
    if (!keep(product.examCode)) product.showOnWebsite = false;
  }
};

describe("About", () => {
  afterEach(() => {
    vi.doUnmock("@/services/mock/catalogue");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is titled and described, with /about as the canonical URL", async () => {
    const { generateMetadata } = await loadPage();
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("About · made by board passers in Iloilo");
    expect(metadata.description).toMatch(/board passers in Iloilo City/);
    expect(metadata.alternates?.canonical).toBe("/about");
    expect(metadata.openGraph).toMatchObject({ url: "/about" });
  });

  it("opens with the brand line, links to the story and the reviewers, and the team photo", async () => {
    await renderAbout();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Built by board passers. Designed for dreamers.",
    );
    expect(screen.getByRole("link", { name: "Read our story" })).toHaveAttribute("href", "#story");
    expect(screen.getByRole("link", { name: "See the reviewers" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(
      screen.getByRole("img", {
        name: "Two of the team going through flash cards and a notebook at a desk",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("IPOPHIL registered")).toBeInTheDocument();
  });

  it("computes its stats from the catalogue and the shop's figures, dated once", async () => {
    await renderAbout();
    // 8 reviewers: the 7 Coming Soon Products aren't counted.
    expect(stats()).toEqual([
      "8 reviewers",
      "5 board exams",
      "4.8 874 shop ratings",
      "3.7K Shopee followers",
    ]);
    expect(screen.getAllByText(/as of Oct 2026/)).toHaveLength(1);
    expect(asOf()).toHaveTextContent("Shop figures from Shopee as of Oct 2026");
    expect(document.body).not.toHaveTextContent(/29 reviewers|11 board exams/i);
  });

  it("tells the story, with the catalogue's Exams on the timeline's Now line", async () => {
    await renderAbout();
    expect(
      screen.getByRole("region", { name: "We passed. Then we made what we wished we had." }),
    ).toHaveAttribute("id", "story");
    expect(
      story().getByRole("heading", {
        level: 2,
        name: "We passed. Then we made what we wished we had.",
      }),
    ).toBeInTheDocument();
    expect(story().getByText("Civil Engineering flash cards")).toBeInTheDocument();
    expect(nowLine()).toBe(
      "Then came updated editions and reviewers for more courses. We now make reviewers for Civil Engineering, Mechanical Engineering, Electrical Engineering, Medical Technology, and Accountancy.",
    );
    expect(story().queryByText(/ChE|Nursing|Architecture/)).toBeNull();
    expect(story().getByText("And this is only the beginning.")).toBeInTheDocument();
    expect(
      story()
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt")),
    ).toEqual([
      "A team member handing a reviewee her package",
      "A reviewee opening her package while her mother looks on",
      "A reviewee hugging her mother, package in hand",
    ]);
  });

  it("has the mission tabs, the shop buttons and a CTA tile for every Exam", async () => {
    await renderAbout();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(shopButtons()).toEqual([
      "https://shopee.ph/aceyourcourse",
      "https://www.lazada.com.ph/shop/aceyourcourse",
      "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    ]);
    expect(ctaTiles()).toEqual([
      ["CE Civil Engineering Reviewers", "/exams/ce"],
      ["ME Mechanical Engineering Reviewers", "/exams/me"],
      ["EE Electrical Engineering Reviewers", "/exams/ee"],
      ["MT Medical Technology Reviewers", "/exams/mt"],
      ["CPA Accountancy Reviewers", "/exams/cpa"],
      ["All reviewers", "/products"],
    ]);
  });

  it("never links into the Member App", async () => {
    await renderAbout();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href"), spokenText(link)).not.toMatch(/^\/app/);
    }
  });

  it("doesn't count a Product that turns Coming Soon", async () => {
    await renderAboutFromSeed((seed) => {
      const product = seed.products.find((p) => p.slug === "medtech-comprehensive-flash-cards");
      if (!product) throw new Error("the seed has no MedTech flash cards");
      Object.assign(product, {
        state: "coming-soon",
        priceFrom: null,
        priceTo: null,
        variations: [],
        listings: {},
        shopee: null,
      });
    });
    expect(stats()).toEqual(expect.arrayContaining(["7 reviewers", "5 board exams"]));
  });

  it("leaves out an Exam with no Products on the Website: no count, no tile, not on the timeline", async () => {
    await renderAboutFromSeed((seed) => hide(seed, (examCode) => examCode !== "CPA"));
    expect(stats()).toEqual(expect.arrayContaining(["7 reviewers", "4 board exams"]));
    expect(ctaTiles().map(([, href]) => href)).toEqual([
      "/exams/ce",
      "/exams/me",
      "/exams/ee",
      "/exams/mt",
      "/products",
    ]);
    expect(nowLine()).not.toMatch(/Accountancy/);
  });

  it("shows no 0 tile with an empty catalogue", async () => {
    await renderAboutFromSeed((seed) => hide(seed, () => false));
    expect(stats()).toEqual(["4.8 874 shop ratings", "3.7K Shopee followers"]);
    expect(document.body).not.toHaveTextContent(/\b0 (reviewers|board exams)/);
    expect(ctaTiles()).toEqual([["All reviewers", "/products"]]);
    expect(nowLine()).toBe("Then came updated editions and reviewers for more courses.");
  });

  it("drops the shop's tiles and their date when the figures are 0", async () => {
    await renderAboutFromSeed((seed) => {
      seed.settings.shopStats = { ...seed.settings.shopStats, rating: 0, followers: "0" };
    });
    expect(stats()).toEqual(["8 reviewers", "5 board exams"]);
    expect(asOf()).toBeNull();
  });

  it("shows no stats at all when every figure is 0", async () => {
    await renderAboutFromSeed((seed) => {
      hide(seed, () => false);
      seed.settings.shopStats = { ...seed.settings.shopStats, rating: 0, followers: "0" };
    });
    expect(screen.queryByRole("list", { name: "AceYourCourse in numbers" })).toBeNull();
    expect(asOf()).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("hides the button of a Marketplace with no shop link", async () => {
    await renderAboutFromSeed((seed) => {
      seed.settings.shopLinks.lazada = null;
    });
    expect(shopButtons()).toEqual([
      "https://shopee.ph/aceyourcourse",
      "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    ]);
  });
});

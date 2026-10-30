import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";

// The Exam page rendered from the real seed, with the Member App switch off and
// on (e2e/exam.spec.ts runs with it off only), plus seed and content fixtures
// for the cases the seed doesn't have. CE has 3 Live Products (cards 764 sold
// at 4.8 from 197 ratings, posters 172 at 4.9 from 52, the bundle 16 at 4.5
// from 6) and 1 Coming Soon; ME has 1 Live and 2 Coming Soon.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT ${url}`);
  },
  usePathname: () => "/exams/ce",
}));
// JsonLd reads the request's CSP nonce, so it's a plain script tag here.
vi.mock("@/components/website/json-ld", () => ({
  JsonLd: ({ data }: { data: Record<string, unknown> }) => (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  ),
}));

type ContentModule = typeof import("@/content/exam-pages");

interface LoadOptions {
  memberAppLive?: boolean;
  editSeed?: (seed: CatalogueSeed) => void;
  editContent?: (content: ContentModule) => Partial<ContentModule>;
}

async function loadPage({ memberAppLive = false, editSeed, editContent }: LoadOptions = {}) {
  vi.stubEnv("MEMBER_APP_LIVE", memberAppLive ? "true" : "false");
  vi.resetModules();
  if (editSeed) {
    vi.doMock("@/services/mock/catalogue", async (importOriginal) => {
      const real = await importOriginal<typeof import("@/services/mock/catalogue")>();
      const seed = structuredClone(real.CATALOGUE_SEED);
      editSeed(seed);
      return { CATALOGUE_SEED: seed };
    });
  }
  if (editContent) {
    vi.doMock("@/content/exam-pages", async (importOriginal) => {
      const real = await importOriginal<ContentModule>();
      return { ...real, ...editContent(real) };
    });
  }
  const page = await import("./page");
  vi.doUnmock("@/services/mock/catalogue");
  vi.doUnmock("@/content/exam-pages");
  return page;
}

const props = (code: string) => ({ params: Promise.resolve({ code }) });

async function renderPage(code: string, options?: LoadOptions) {
  const { default: ExamPage } = await loadPage(options);
  return render(await ExamPage(props(code)));
}

function product(seed: CatalogueSeed, slug: string) {
  const found = seed.products.find((p) => p.slug === slug);
  if (!found) throw new Error(`the seed has no ${slug}`);
  return found;
}

/** A hero stat's value by its label, or null when the tile is hidden. */
function stat(term: string): string | null {
  const dt = screen.queryByText(term, { selector: "dt" });
  return dt?.nextElementSibling?.textContent ?? null;
}

const productList = (code: string) =>
  within(screen.getByRole("list", { name: `Every ${code} reviewer` }));
const productNames = (code: string) =>
  productList(code)
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
const compareTable = () => screen.queryByRole("table", { name: "Which one should I get?" });
const tryCard = (code: string) => screen.queryByText(`Try a ${code} card`);
const bundleBanner = () => screen.queryByRole("region", { name: /CE Review Bundle 3-in-1/ });

function breadcrumbJsonLd() {
  return [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => JSON.parse(script.textContent ?? "null") as Record<string, unknown>)
    .find((data) => data["@type"] === "BreadcrumbList");
}

describe("Exam page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("routing", () => {
    it("permanently redirects an uppercase code to the lowercase URL", async () => {
      const { default: ExamPage, generateMetadata } = await loadPage();
      await expect(ExamPage(props("CE"))).rejects.toThrow("NEXT_PERMANENT_REDIRECT /exams/ce");
      await expect(ExamPage(props("Me"))).rejects.toThrow("NEXT_PERMANENT_REDIRECT /exams/me");
      await expect(generateMetadata(props("CE"))).resolves.toEqual({});
    });

    it("is not found for an unknown code", async () => {
      const { default: ExamPage, generateMetadata } = await loadPage();
      await expect(ExamPage(props("zz"))).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(ExamPage(props(""))).rejects.toThrow("NEXT_NOT_FOUND");
      // Metadata stays empty; the page's notFound() renders the 404 in the shell.
      await expect(generateMetadata(props("zz"))).resolves.toEqual({});
    });

    it("is not found for an Exam with no Products shown on the Website", async () => {
      const { default: ExamPage, generateMetadata } = await loadPage({
        editSeed: (seed) => {
          for (const p of seed.products) if (p.examCode === "CPA") p.showOnWebsite = false;
        },
      });
      await expect(ExamPage(props("cpa"))).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(generateMetadata(props("cpa"))).resolves.toEqual({});
    });
  });

  describe("metadata", () => {
    it("titles the page by board for search, with a description from the blurb and its canonical URL", async () => {
      const { generateMetadata } = await loadPage();
      const metadata = await generateMetadata(props("ce"));
      expect(metadata.title).toBe("CELE Reviewer · Civil Engineering");
      expect(metadata.description).toBe(
        "Three subjects, four formats. Our CE line started it all and it’s still our best seller.",
      );
      expect(metadata.alternates?.canonical).toBe("/exams/ce");
      expect(metadata.openGraph).toMatchObject({
        url: "/exams/ce",
        title: "CELE Reviewer · Civil Engineering · Ace Your Course",
        images: [{ url: "/opengraph-image", alt: "Ace Your Course" }],
      });
    });

    it("keeps every Exam's whole title within 60 characters and its description within 160", async () => {
      const { generateMetadata } = await loadPage();
      for (const code of ["ce", "me", "ee", "mt", "cpa"]) {
        const metadata = await generateMetadata(props(code));
        expect(`${String(metadata.title)} · Ace Your Course`.length, code).toBeLessThanOrEqual(60);
        expect(String(metadata.description).length, code).toBeLessThanOrEqual(160);
      }
    });
  });

  describe("the CE page", () => {
    it("shows the breadcrumb, the switcher, the Exam and its stats computed from Live Products", async () => {
      await renderPage("ce");

      const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(within(breadcrumb).getByRole("link", { name: "Exams" })).toHaveAttribute(
        "href",
        "/#exams",
      );
      expect(within(breadcrumb).getByText("Civil Engineering")).toHaveAttribute(
        "aria-current",
        "page",
      );

      const switcher = within(screen.getByRole("navigation", { name: "Switch exam" }));
      expect(switcher.getAllByRole("link").map((link) => link.textContent)).toEqual([
        "CE",
        "ME",
        "EE",
        "MT",
        "CPA",
      ]);
      expect(switcher.getByRole("link", { name: "CE" })).toHaveAttribute("aria-current", "page");
      expect(switcher.getByRole("link", { name: "ME" })).toHaveAttribute("href", "/exams/me");
      expect(switcher.getByRole("link", { name: "ME" })).not.toHaveAttribute("aria-current");

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Civil Engineering");
      expect(screen.getByText("Civil Engineering Licensure Exam")).toBeInTheDocument();
      expect(screen.getByText(/^Three subjects, four formats\./)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "See 3 reviewers" })).toHaveAttribute(
        "href",
        "#reviewers",
      );

      // The Coming Soon CE Solving Notebook counts in none of them.
      expect(stat("Reviewers")).toBe("3");
      expect(stat("Units sold")).toBe("952");
      expect(stat("Avg rating")).toBe("4.8");
      expect(stat("From")).toBe("₱400");
      expect(screen.getByText("Units sold and ratings from Shopee, as of Oct 2026")).toBeVisible();
    });

    it("stacks the top 3 Live Products' photos, each linking to its page, and tickers the Subjects", async () => {
      await renderPage("ce");
      const stack = within(screen.getByRole("list", { name: "Top sellers" }));
      expect(stack.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
        "/products/ce-formula-flash-cards",
        "/products/ultimate-ce-posters-2-0",
        "/products/ce-review-bundle-3-in-1",
      ]);
      expect(stack.getByRole("link", { name: "CE Formula Flash Cards" })).toBeInTheDocument();

      const ticker = screen.getByRole("region", { name: "CE subjects" });
      expect(ticker).toHaveTextContent(
        "MSTC · Mathematics, Surveying & Transportation Engineering",
      );
      expect(ticker).toHaveTextContent("PSAD · Principles of Structural Analysis & Design");
    });

    it("lists the Subjects covered as numbered cards with full names", async () => {
      await renderPage("ce");
      const section = within(screen.getByRole("region", { name: "What’s covered" }));
      expect(section.getByText("3 subjects on the CELE")).toBeInTheDocument();
      expect(section.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "01MSTCMathematics, Surveying & Transportation Engineering",
        "02HPGEHydraulics & Geotechnical Engineering",
        "03PSADPrinciples of Structural Analysis & Design",
      ]);
    });

    it("lists the Live Products best selling first, #1 on the top seller, then Coming Soon without a price", async () => {
      await renderPage("ce");
      expect(productNames("CE")).toEqual([
        "CE Formula Flash Cards",
        "Ultimate CE Posters 2.0",
        "CE Review Bundle 3-in-1",
        "CE Solving Notebook",
      ]);
      const [top, second, , soon] = productList("CE").getAllByRole("listitem");
      expect(top).toHaveTextContent("#1 in CE");
      expect(second).not.toHaveTextContent("#1 in CE");
      expect(screen.getAllByText("#1 in CE")).toHaveLength(1);
      expect(soon).toHaveTextContent("Coming soon");
      expect(soon).not.toHaveTextContent("₱");

      // Cards link to the Product page, with no buy buttons.
      expect(
        within(top ?? document.body).getByRole("link", { name: "CE Formula Flash Cards" }),
      ).toHaveAttribute("href", "/products/ce-formula-flash-cards");
      expect(productList("CE").queryByRole("link", { name: /buy on/i })).not.toBeInTheDocument();

      const chips = within(screen.getByRole("group", { name: "Filter by format" }));
      expect(chips.getAllByRole("button")).toHaveLength(4);
      for (const name of [
        "All 3 reviewers",
        "Flash cards 1 reviewer",
        "Posters 1 reviewer",
        "Bundle 1 reviewer",
      ]) {
        expect(chips.getByRole("button", { name })).toBeInTheDocument();
      }
    });

    it("compares the 3 Live Products, leaving Coming Soon out", async () => {
      await renderPage("ce");
      const rows = within(compareTable() ?? document.body)
        .getAllByRole("row")
        .slice(1);
      expect(rows.map((row) => row.textContent)).toEqual([
        "CE Formula Flash CardsFlash cards · 4 × 6 in · 160 gsmQuick recall on the go₱1,200",
        expect.stringMatching(
          /^Ultimate CE Posters 2\.0Posters · .*Your study wall, active recallfrom ₱400$/,
        ),
        expect.stringMatching(
          /^CE Review Bundle 3-in-1Bundle · .*Everything in one orderfrom ₱1,200$/,
        ),
      ]);
    });

    it("offers the sample cards, with the printed set at the top seller", async () => {
      await renderPage("ce");
      expect(tryCard("CE")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Flip card" })).toHaveAccessibleDescription(
        "Tangent distance of a simple curve",
      );
      expect(screen.getByRole("link", { name: "Get the printed set" })).toHaveAttribute(
        "href",
        "/products/ce-formula-flash-cards",
      );
    });

    it("offers the CE bundle at its catalogue price, linking to it", async () => {
      await renderPage("ce");
      const banner = within(bundleBanner() ?? document.body);
      // The bundle's 3-in-1 variation is its top price, ₱3,499.
      expect(banner.getByRole("link")).toHaveAttribute("href", "/products/ce-review-bundle-3-in-1");
      expect(banner.getByRole("link")).toHaveTextContent(
        "CE Review Bundle 3-in-1 · save ₱200Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order.₱3,499See the bundle",
      );
    });

    it("scrolls the first 7 CE Reviews in a marquee, in best-seller order", async () => {
      await renderPage("ce");
      const marquee = within(screen.getByRole("region", { name: "Reviews from CE reviewees" }));
      const products = marquee
        .getAllByRole("figure")
        .filter((figure) => !figure.closest("[aria-hidden='true']"))
        .map((figure) =>
          within(figure).getByRole("link", { name: "View product" }).getAttribute("href"),
        );
      // CE cards (5 Reviews), then 2 of the posters' 3: 7 in all.
      expect(products).toEqual([
        ...Array(5).fill("/products/ce-formula-flash-cards"),
        ...Array(2).fill("/products/ultimate-ce-posters-2-0"),
      ]);
    });

    it("ends with the store band's shop buttons", async () => {
      await renderPage("ce");
      const band = within(
        screen.getByRole("region", { name: "Get your CE reviewer from our official stores." }),
      );
      expect(band.getByRole("link", { name: /^Buy on Shopee/ })).toHaveAttribute(
        "href",
        "https://shopee.ph/aceyourcourse",
      );
      expect(band.getAllByRole("link")).toHaveLength(3);
    });

    it("has BreadcrumbList structured data from Home to the Exam, and no rating markup", async () => {
      await renderPage("ce");
      expect(breadcrumbJsonLd()).toMatchObject({
        itemListElement: [
          { position: 1, name: "Home", item: expect.stringMatching(/\/$/) },
          { position: 2, name: "Civil Engineering", item: expect.stringMatching(/\/exams\/ce$/) },
        ],
      });
      const allJsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((script) => script.textContent)
        .join("");
      expect(allJsonLd).not.toMatch(/AggregateRating|"Review"/);
    });
  });

  describe("an Exam with one Live Product (ME)", () => {
    it("has no comparison table, no format chips and no bundle banner", async () => {
      await renderPage("me");
      expect(compareTable()).toBeNull();
      expect(screen.queryByRole("group", { name: "Filter by format" })).not.toBeInTheDocument();
      expect(bundleBanner()).toBeNull();
      expect(screen.getByRole("link", { name: "See 1 reviewer" })).toBeInTheDocument();
    });

    it("lists its Coming Soon Products after the Live one, badged and without a price", async () => {
      await renderPage("me");
      expect(productNames("ME")).toEqual(["ME Formula Flash Cards", "ME Notebook", "ME Posters"]);
      const [, ...soon] = productList("ME").getAllByRole("listitem");
      for (const card of soon) {
        expect(card).toHaveTextContent("Coming soon");
        expect(card).not.toHaveTextContent("₱");
      }
    });

    it("lays its 3 Reviews out in a grid", async () => {
      await renderPage("me");
      expect(screen.queryByRole("region", { name: "Reviews from ME reviewees" })).toBeNull();
      expect(
        within(screen.getByRole("list", { name: "From ME reviewees" })).getAllByRole("listitem"),
      ).toHaveLength(3);
    });
  });

  describe("an Exam with only Coming Soon Products", () => {
    const onlyComingSoon = (seed: CatalogueSeed) => {
      const live = product(seed, "me-formula-flash-cards");
      Object.assign(live, { state: "coming-soon", priceFrom: null, priceTo: null, shopee: null });
      Object.assign(live, { variations: [], listings: {}, deal: false });
      // A Coming Soon Product has no Reviews, and the seed checks that.
      seed.reviews = seed.reviews.filter((r) => r.productId !== live.id);
    };

    it("counts nothing, rates it New and hides the From tile", async () => {
      await renderPage("me", { editSeed: onlyComingSoon });
      expect(stat("Reviewers")).toBe("0");
      expect(stat("Units sold")).toBe("0");
      expect(stat("Avg rating")).toBe("New");
      expect(stat("From")).toBeNull();
      // No figures to date.
      expect(screen.queryByText(/from Shopee, as of/)).not.toBeInTheDocument();
    });

    it("has no top seller: no #1, photo stack, printed set or reviewers link", async () => {
      await renderPage("me", { editSeed: onlyComingSoon });
      expect(productNames("ME")).toEqual(["ME Formula Flash Cards", "ME Notebook", "ME Posters"]);
      expect(screen.queryByText("#1 in ME")).not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Top sellers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Get the printed set" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^See \d+ reviewer/ })).not.toBeInTheDocument();
      expect(screen.getByText(/^No written reviews yet\./)).toBeInTheDocument();
      expect(screen.queryByText("₱", { exact: false })).not.toBeInTheDocument();
    });
  });

  it("claims no #1 when no Live Product has Shopee figures to back it", async () => {
    await renderPage("ce", {
      editSeed: (seed) => {
        for (const p of seed.products) if (p.examCode === "CE") p.shopee = null;
      },
    });
    expect(screen.queryByText("#1 in CE")).not.toBeInTheDocument();
    expect(stat("Avg rating")).toBe("New");
  });

  describe("the CE bundle banner", () => {
    it("is hidden on every other Exam", async () => {
      for (const code of ["me", "ee", "mt", "cpa"]) {
        const { unmount } = await renderPage(code);
        expect(bundleBanner(), code).toBeNull();
        unmount();
      }
    });

    it("is hidden while the bundle is Coming Soon", async () => {
      await renderPage("ce", {
        editSeed: (seed) => {
          Object.assign(product(seed, "ce-review-bundle-3-in-1"), {
            state: "coming-soon",
            priceFrom: null,
            priceTo: null,
            shopee: null,
            variations: [],
            listings: {},
          });
          // A Coming Soon Product has no Reviews shown, and the seed checks that.
          seed.reviews = seed.reviews.filter((r) => r.productId !== "prd-008");
        },
      });
      expect(bundleBanner()).toBeNull();
    });

    it("is hidden when the bundle isn't on the Website", async () => {
      await renderPage("ce", {
        editSeed: (seed) => {
          product(seed, "ce-review-bundle-3-in-1").showOnWebsite = false;
        },
      });
      expect(bundleBanner()).toBeNull();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Civil Engineering");
    });
  });

  it("hides Try a card for an Exam with no sample cards", async () => {
    await renderPage("ce", { editContent: () => ({ sampleCards: {} }) });
    expect(tryCard("CE")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Flip card" })).not.toBeInTheDocument();
  });

  describe("the Member App switch", () => {
    it("while off, shows no app link, app plans or In-the-app column, and links nowhere in the app", async () => {
      const { container } = await renderPage("ce");
      expect(screen.queryByRole("link", { name: "Review CE in the app" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /app plans/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/The app works the same way/)).not.toBeInTheDocument();
      expect(
        within(compareTable() ?? document.body).queryByRole("columnheader", { name: "In the app" }),
      ).not.toBeInTheDocument();
      expect(container.querySelectorAll('a[href^="/app"]')).toHaveLength(0);
    });

    it("while on, links to the app and its plans, and compares what's in the app", async () => {
      await renderPage("ce", { memberAppLive: true });
      expect(screen.getByRole("link", { name: "Review CE in the app" })).toHaveAttribute(
        "href",
        "/app",
      );
      expect(screen.getByRole("link", { name: "See CE app plans" })).toHaveAttribute(
        "href",
        "/app/plans",
      );
      expect(screen.getByText(/The app works the same way/)).toBeInTheDocument();
      const table = within(compareTable() ?? document.body);
      expect(table.getByRole("columnheader", { name: "In the app" })).toBeInTheDocument();
      expect(table.getAllByRole("row")[1]).toHaveTextContent("Yes");
      expect(table.getAllByRole("row")[2]).toHaveTextContent("Physical only");
    });

    it("while on, still hides the app links for an Exam with nothing in the app", async () => {
      await renderPage("ce", {
        memberAppLive: true,
        editSeed: (seed) => {
          for (const p of seed.products) if (p.examCode === "CE") p.availableInApp = false;
        },
      });
      expect(screen.queryByRole("link", { name: "Review CE in the app" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /app plans/ })).not.toBeInTheDocument();
    });
  });

  it("hides a store band button whose shop link is empty", async () => {
    await renderPage("ce", {
      editSeed: (seed) => {
        seed.settings.shopLinks.lazada = null;
      },
    });
    const band = within(
      screen.getByRole("region", { name: "Get your CE reviewer from our official stores." }),
    );
    expect(band.queryByRole("link", { name: /lazada/i })).not.toBeInTheDocument();
    expect(band.getAllByRole("link")).toHaveLength(2);
  });
});

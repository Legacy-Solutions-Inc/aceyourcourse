import { render, screen, within } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";

// The Products page rendered from the real seed, with the Member App switch
// off and on (e2e/products.spec.ts runs with it off only). The seed has 8 Live
// and 7 Coming Soon Products across 5 Exams. The filter bar and the picker
// only replace the URL, so the router is a stub here.
vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ replace: vi.fn() }),
}));

type SearchParams = Record<string, string>;
type PageModule = typeof import("./page");

// The switch is read once, when the seam loads, so the page is imported once
// per switch state (re-importing it for every test is slow).
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

async function renderPage(searchParams: SearchParams = {}, { memberAppLive = false } = {}) {
  const { default: ProductsPage } = await loadPage(memberAppLive);
  return render(await ProductsPage({ searchParams: Promise.resolve(searchParams) }));
}

const count = () => screen.getByText(/^\d+ of \d+ reviewers$/);
const grid = () => within(screen.getByRole("list", { name: "All reviewers" }));
const gridNames = () =>
  grid()
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);
const comingSoon = () => screen.queryByRole("list", { name: "Coming soon" });
const hero = () => screen.getByRole("heading", { level: 1 }).closest("section");

describe("Products page", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is titled and described, with /products as the canonical URL", async () => {
    const { generateMetadata } = await loadPage(false);
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("All reviewers · flash cards, notebooks & posters");
    expect(metadata.description).toMatch(/^Every Ace Your Course board exam reviewer/);
    expect(metadata.alternates?.canonical).toBe("/products");
    expect(metadata.openGraph).toMatchObject({ url: "/products" });
  });

  it("computes the hero's pill and Exam list from the catalogue", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Find the reviewer that fits how you study.",
    );
    expect(screen.getByText("All reviewers · 5 board exams")).toBeVisible();
    expect(
      screen.getByText(
        "Flash cards, posters, notebooks, and bundles for CE, ME, EE, MT, and CPA. Shipped nationwide.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Help me choose" })).toHaveAttribute("href", "#picker");
    expect(screen.getByRole("link", { name: "Browse all" })).toHaveAttribute("href", "#all");
    expect(screen.getByRole("region", { name: "About our reviewers" })).toHaveTextContent(
      "CE · ME · EE · MT · CPA",
    );
  });

  it("lists every Live Product, best selling first", async () => {
    await renderPage();

    expect(count()).toHaveTextContent("8 of 8 reviewers");
    expect(gridNames()).toHaveLength(8);
    expect(gridNames()[0]).toBe("CE Formula Flash Cards");
  });

  it("puts the Coming Soon Products in their own row, with no prices", async () => {
    await renderPage();

    const row = comingSoon();
    expect(row).not.toBeNull();
    const cards = within(row ?? document.body).getAllByRole("article");
    expect(cards).toHaveLength(7);
    for (const card of cards) expect(card).toHaveTextContent("Coming soon");
    expect(row).not.toHaveTextContent("₱");
    // ...and never in the grid.
    expect(gridNames()).not.toContain("CE Solving Notebook");
  });

  it("shows the view in the URL", async () => {
    await renderPage({ exam: "ce", format: "posters" });

    expect(count()).toHaveTextContent("1 of 8 reviewers");
    expect(gridNames()).toEqual(["Ultimate CE Posters 2.0"]);
    expect(
      within(screen.getByRole("group", { name: "Exam" })).getByRole("button", { name: /^CE / }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sorts by price", async () => {
    await renderPage({ sort: "price-asc" });
    expect(gridNames()[0]).toBe("Ultimate CE Posters 2.0");
  });

  it("filters by max price, which never hides a Coming Soon Product", async () => {
    await renderPage({ max: "500" });
    expect(count()).toHaveTextContent("1 of 8 reviewers");
    expect(within(comingSoon() ?? document.body).getAllByRole("article")).toHaveLength(7);
  });

  it("shows the Coming Soon Products that match the search, and hides the row when none do", async () => {
    await renderPage({ q: "MSTC" });
    expect(count()).toHaveTextContent("3 of 8 reviewers");
    expect(within(comingSoon() ?? document.body).getAllByRole("article")).toHaveLength(1);
  });

  it("falls back to the defaults for invalid values, with no error", async () => {
    await renderPage({ exam: "zzz", format: "box", max: "abc", sort: "bogus", q: "" });

    expect(count()).toHaveTextContent("8 of 8 reviewers");
    expect(gridNames()[0]).toBe("CE Formula Flash Cards");
  });

  it("shows the empty state, and no Coming Soon row, when nothing matches", async () => {
    await renderPage({ exam: "cpa", format: "posters" });

    expect(count()).toHaveTextContent("0 of 8 reviewers");
    expect(screen.getByText("No reviewers match those filters.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: /^Browse Shopee/ })).toHaveAttribute(
      "href",
      "https://shopee.ph/aceyourcourse",
    );
    expect(comingSoon()).toBeNull();
  });

  describe("with the Member App switch off", () => {
    it("never mentions, links to or filters by the Member App", async () => {
      await renderPage({ app: "1" });

      expect(count()).toHaveTextContent("8 of 8 reviewers");
      expect(hero()).not.toHaveTextContent(/app/i);
      expect(screen.queryByRole("button", { name: "Also in app" })).not.toBeInTheDocument();
      expect(
        within(screen.getByRole("group", { name: "2. How do you like to study?" })).queryByRole(
          "button",
          { name: /^App/ },
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /Two ways to study it/ }),
      ).not.toBeInTheDocument();
      const appLinks = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/app"));
      expect(appLinks).toEqual([]);
    });
  });

  describe("with the Member App switch on", () => {
    it("says most reviewers are in the app and compares physical with the app", async () => {
      await renderPage({}, { memberAppLive: true });

      expect(hero()).toHaveTextContent("Shipped nationwide. Most are also in the app.");
      expect(
        screen.getByRole("heading", { level: 2, name: "Same content. Two ways to study it." }),
      ).toBeVisible();
      expect(screen.getByRole("link", { name: "See app plans" })).toHaveAttribute(
        "href",
        "/app/plans",
      );
      expect(
        within(screen.getByRole("group", { name: "2. How do you like to study?" })).getByRole(
          "button",
          { name: /^App/ },
        ),
      ).toBeVisible();
    });

    it("filters to the Products in the app with app=1", async () => {
      await renderPage({ app: "1" }, { memberAppLive: true });

      expect(count()).toHaveTextContent("5 of 8 reviewers");
      expect(screen.getByRole("button", { name: "Also in app" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});

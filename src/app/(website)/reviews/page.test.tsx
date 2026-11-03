import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { REVIEW_SORTS } from "@/lib/catalogue/review-filters";

// The Reviews page rendered from the real seed: 16 written Reviews of 8 Live
// Products across 5 Exams, 15 of them 5★ and one 3★ (the MedTech notebook),
// none 4★. Two Live Products (the MedTech flash cards and the CE bundle) have
// ratings but no written Reviews, and the 7 Coming Soon Products have neither.
// The wall's filters only replace the URL, so the router is a stub here.
vi.mock("next/navigation", () => ({
  usePathname: () => "/reviews",
  useRouter: () => ({ replace: vi.fn() }),
}));

type SearchParams = Record<string, string>;
type PageModule = typeof import("./page");
type Seam = typeof import("@/services/catalogue");

let page: PageModule;
let seam: Seam;

beforeAll(async () => {
  vi.stubEnv("MEMBER_APP_LIVE", "false");
  vi.resetModules();
  [page, seam] = await Promise.all([import("./page"), import("@/services/catalogue")]);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderPage(searchParams: SearchParams = {}) {
  return render(await page.default({ searchParams: Promise.resolve(searchParams) }));
}

const count = () => screen.getByText(/^\d+ of \d+ written reviews$/);
const wall = () => screen.getByRole("region", { name: "The review wall" });
const cards = () => within(wall()).queryAllByRole("figure");
const quotes = () => cards().map((card) => within(card).getByRole("blockquote").textContent);
function firstCard() {
  const [first] = cards();
  if (!first) throw new Error("the wall has no cards");
  return within(first);
}
function cardQuoting(text: string) {
  const found = cards().find((each) => within(each).getByRole("blockquote").textContent === text);
  if (!found) throw new Error(`the wall has no card quoting "${text}"`);
  return within(found);
}
const ratingRows = () =>
  within(screen.getByRole("list", { name: "Ratings by reviewer" })).getAllByRole("link");
const examChip = (name: string) =>
  within(screen.getByRole("group", { name: "Exam" })).getByRole("button", {
    name: new RegExp(`^${name} `),
  });
const starChip = (name: string) =>
  within(screen.getByRole("group", { name: "Stars" })).getByRole("button", {
    name: new RegExp(`^${name} `),
  });
/** An element's text as a screen reader reads it: without its aria-hidden parts. */
function spokenText(element: Element) {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent?.replace(/\s+/g, " ").trim();
}
const productChip = () => screen.queryByRole("button", { name: /, remove this filter$/ });

describe("Reviews page", () => {
  it("is titled and described, with /reviews as the canonical URL", async () => {
    const metadata = await page.generateMetadata();
    expect(metadata.title).toBe("Reviews from board passers");
    expect(metadata.description).toMatch(/copied word for word/);
    expect(metadata.alternates?.canonical).toBe("/reviews");
    expect(metadata.openGraph).toMatchObject({ url: "/reviews" });
  });

  it("shows the shop's Shopee figures from Website settings, with their date", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "What reviewees say after using them.",
    );
    expect(
      screen.getByText(
        "Every review here was written by a verified buyer on our Shopee shop, copied word for word, including the critical ones.",
      ),
    ).toBeVisible();
    expect(screen.getAllByRole("paragraph").map(spokenText)).toEqual(
      expect.arrayContaining(["4.8 shop rating on Shopee", "874 ratings", "3.7K followers"]),
    );
    expect(screen.getByText("Shopee figures as of Oct 2026")).toBeVisible();
  });

  it("rates every Live Product with figures, best selling first, and never Coming Soon", async () => {
    await renderPage();

    const rows = ratingRows();
    const expected = [
      "CE CE Formula Flash Cards rated 4.8 197 ratings",
      "ME ME Formula Flash Cards rated 4.8 95 ratings",
      "CPA CPA Flash Cards rated 4.8 56 ratings",
      "EE EE Flash Cards rated 4.8 73 ratings",
      "CE Ultimate CE Posters 2.0 rated 4.9 52 ratings",
      "MT MedTech Essential Notebook rated 4.3 29 ratings",
      "MT MedTech Comprehensive Flash Cards rated 5.0 6 ratings",
      "CE CE Review Bundle 3-in-1 rated 4.5 6 ratings",
    ];
    expect(rows).toHaveLength(expected.length);
    rows.forEach((row, index) => expect(row).toHaveAccessibleName(expected[index]));
    expect(rows[0]).toHaveAttribute("href", "/reviews?product=ce-formula-flash-cards#wall");
    expect(screen.getByRole("list", { name: "Ratings by reviewer" })).not.toHaveTextContent(
      /0\.0|Coming soon|CE Solving Notebook/i,
    );
  });

  it("shows every written Review, most helpful first", async () => {
    await renderPage();

    const { items } = await seam.listReviews();
    expect(count()).toHaveTextContent("16 of 16 written reviews");
    expect(quotes()).toEqual(items.map((review) => review.text));
    expect(examChip("All")).toHaveAttribute("aria-pressed", "true");
    expect(starChip("All")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveDisplayValue("Most helpful");
    expect(productChip()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it.each(REVIEW_SORTS)("shows the wall in the seam's %s order", async (sort) => {
    await renderPage({ sort });

    const { items } = await seam.listReviews({ sort });
    expect(quotes()).toEqual(items.map((review) => review.text));
  });

  it("puts the lowest-star Review first when sorted by most critical", async () => {
    await renderPage({ sort: "most-critical" });
    expect(firstCard().getByRole("img", { name: "3 out of 5 stars" })).toBeVisible();
  });

  it("puts the longest Review first when sorted by most detailed", async () => {
    await renderPage({ sort: "most-detailed" });
    const lengths = quotes().map((quote) => quote?.length ?? 0);
    expect(lengths[0]).toBe(Math.max(...lengths));
  });

  it("filters to one Product from its ratings row, with a chip to remove it", async () => {
    await renderPage({ product: "ce-formula-flash-cards" });

    expect(count()).toHaveTextContent("5 of 16 written reviews");
    for (const card of cards()) {
      expect(within(card).getByText("CE Formula Flash Cards")).toBeVisible();
    }
    expect(productChip()).toHaveAccessibleName("CE Formula Flash Cards, remove this filter");
    expect(ratingRows()[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  it("shows only Reviews of 3 stars or fewer, as many as the ≤3★ chip counts", async () => {
    await renderPage({ stars: "3-or-less" });

    expect(starChip("3 stars or fewer")).toHaveAccessibleName("3 stars or fewer 1 review");
    expect(starChip("3 stars or fewer")).toHaveAttribute("aria-pressed", "true");
    expect(count()).toHaveTextContent("1 of 16 written reviews");
    expect(firstCard().getByText("MedTech Essential Notebook")).toBeVisible();
  });

  it("counts each chip group with the other filters applied: CE's Reviews on the star chips", async () => {
    await renderPage({ exam: "ce" });

    expect(examChip("All")).toHaveAccessibleName("All 16 reviews");
    expect(examChip("CE")).toHaveAccessibleName("CE 8 reviews");
    expect(examChip("CE")).toHaveAttribute("aria-pressed", "true");
    expect(examChip("MT")).toHaveAccessibleName("MT 1 review");
    expect(starChip("All")).toHaveAccessibleName("All 8 reviews");
    expect(starChip("5 stars")).toHaveAccessibleName("5 stars 8 reviews");
    expect(starChip("3 stars or fewer")).toBeDisabled();
    expect(count()).toHaveTextContent("8 of 16 written reviews");
  });

  it("counts the Exam chips over the picked stars and the search", async () => {
    await renderPage({ stars: "3-or-less" });

    expect(examChip("All")).toHaveAccessibleName("All 1 review");
    expect(examChip("MT")).toHaveAccessibleName("MT 1 review");
    expect(examChip("CE")).toBeDisabled();
    expect(starChip("5 stars")).toHaveAccessibleName("5 stars 15 reviews");
  });

  it("counts both chip groups over the search", async () => {
    await renderPage({ q: "delivery" });

    expect(examChip("All")).toHaveAccessibleName("All 1 review");
    expect(starChip("All")).toHaveAccessibleName("All 1 review");
  });

  it("searches the Review text, Product short name and variation", async () => {
    await renderPage({ q: "delivery" });
    expect(count()).toHaveTextContent("1 of 16 written reviews");
    expect(quotes()[0]).toMatch(/fast delivery/);

    await renderPage({ q: "Ultimate CE Posters" });
    expect(screen.getAllByText(/^\d+ of 16 written reviews$/).at(-1)).toHaveTextContent(
      "3 of 16 written reviews",
    );
  });

  it("finds a Review by its variation", async () => {
    await renderPage({ q: "second ed" });
    expect(count()).toHaveTextContent("1 of 16 written reviews");
    expect(firstCard().getByText("Variation: BUNDLE SECOND ED.")).toBeVisible();
  });

  it("ignores invalid filters in the URL, showing every Review with no Product chip", async () => {
    await renderPage({ product: "nope", exam: "zz", stars: "2", sort: "bogus" });

    const { items } = await seam.listReviews();
    expect(count()).toHaveTextContent("16 of 16 written reviews");
    expect(quotes()).toEqual(items.map((review) => review.text));
    expect(productChip()).not.toBeInTheDocument();
    expect(examChip("All")).toHaveAttribute("aria-pressed", "true");
    expect(starChip("All")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveDisplayValue("Most helpful");
  });

  it("shows the empty state, with Clear filters, when nothing matches", async () => {
    await renderPage({ exam: "cpa", stars: "3-or-less" });

    expect(count()).toHaveTextContent("0 of 16 written reviews");
    expect(cards()).toHaveLength(0);
    expect(within(wall()).getByText("No reviews match those filters.")).toBeVisible();
    expect(
      within(wall()).getByText(
        "Newer reviewers like the MedTech flash cards have ratings on Shopee but no written reviews yet.",
      ),
    ).toBeVisible();
    expect(within(wall()).getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/reviews",
    );
  });

  it("shows the empty state for a rated Product with no written Reviews", async () => {
    await renderPage({ product: "ce-review-bundle-3-in-1" });
    expect(count()).toHaveTextContent("0 of 16 written reviews");
    expect(productChip()).toHaveAccessibleName("CE Review Bundle 3-in-1, remove this filter");
  });

  it("shows each Review word for word, with its variation, helpful votes and Product link", async () => {
    await renderPage({ product: "ce-formula-flash-cards" });

    const { items } = await seam.listReviews({ productSlug: "ce-formula-flash-cards" });
    const multiline = items.find((review) => review.text.includes("\n"))?.text ?? "";
    const quiet =
      items.find((review) => review.variation === null && review.helpful === 0)?.text ?? "";

    expect(multiline).toContain("\n");
    expect(cardQuoting(multiline).getByRole("blockquote")).toHaveTextContent(multiline, {
      normalizeWhitespace: false,
    });
    expect(cardQuoting(quiet).getByText("Variation not specified")).toBeVisible();
    expect(cardQuoting(quiet).queryByText(/found this helpful/)).not.toBeInTheDocument();
    expect(firstCard().getByText(/^\d+ found this helpful$/)).toBeVisible();
    expect(firstCard().getByRole("link", { name: /View product/ })).toHaveAttribute(
      "href",
      "/products/ce-formula-flash-cards",
    );
  });

  it('invites a board passer\'s story by email, from settings, and links to "Browse reviewers"', async () => {
    await renderPage();

    const band = screen.getByRole("region", { name: "Passed with our cards?" });
    expect(
      within(band).getByText("Send us a message! We would like to feature you and your story."),
    ).toBeVisible();
    expect(within(band).getByRole("link", { name: /^Email us/ })).toHaveAttribute(
      "href",
      "mailto:aceyourcourseinc@gmail.com?subject=My%20board%20exam%20story",
    );
    expect(within(band).getByRole("link", { name: "Browse reviewers" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("emits no Review or rating structured data", async () => {
    const { container } = await renderPage();
    const html = container.innerHTML;
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("aggregateRating");
    expect(html).not.toContain("ratingValue");
    expect(html).not.toContain('"@type":"Review"');
  });

  it("never mentions the Member App", async () => {
    const { container } = await renderPage();
    expect(container).not.toHaveTextContent(/\bapp\b/i);
    expect(container.querySelector('a[href^="/app"]')).toBeNull();
  });
});

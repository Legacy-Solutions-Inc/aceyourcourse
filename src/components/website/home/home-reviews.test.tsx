import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewWithProduct, ShopStats } from "@/services/catalogue.types";

import { testReview } from "../../../../test/fixtures/catalogue";
import { HomeReviews } from "./home-reviews";

// The Home Reviews wall `#reviews` (docs/mockup/website/Home_v2.dc.html
// L214–235): the pinned Reviews, in pin order, across two marquee rows that
// pause on hover or focus, with the shop's Shopee rating and its date.

const shopStats: ShopStats = {
  rating: 4.8,
  ratingCount: 874,
  followers: "2.1k",
  asOf: "2026-10-29",
};
const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

const pinned = (count: number): ReviewWithProduct[] =>
  Array.from({ length: count }, (_, index) =>
    testReview({
      id: `rev-${index + 1}`,
      text: `Pinned review ${index + 1}`,
      homePin: index + 1,
      // The fifth is the critical one, as in the seed.
      stars: index === 4 ? 3 : 5,
    }),
  );

const row = (n: number, of: number) =>
  screen.getByRole("region", { name: `Pinned reviews, row ${n} of ${of}` });
/** The Reviews a row reads out; its hidden second copy is left out. */
const textsIn = (region: HTMLElement) =>
  within(region)
    .getAllByRole("blockquote")
    .map((quote) => quote.textContent);
/** The rating badge a line of it sits in. */
function badgeOf(line: HTMLElement) {
  const badge = line.closest<HTMLElement>("p");
  if (!badge) throw new Error("the line is not in the badge");
  return badge;
}

describe("HomeReviews", () => {
  it("splits the pinned Reviews across two rows in pin order, the first row taking the extra one", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pinned by reviewees" })).toBeVisible();
    expect(screen.getByText("Copied word for word from Shopee")).toBeInTheDocument();
    expect(textsIn(row(1, 2))).toEqual([1, 2, 3, 4, 5].map((n) => `Pinned review ${n}`));
    expect(textsIn(row(2, 2))).toEqual([6, 7, 8, 9].map((n) => `Pinned review ${n}`));
  });

  it("cuts every Review on the wall to a five-line quote, so the rows stay one height", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    for (const quote of screen.getAllByRole("blockquote")) {
      expect(quote, quote.textContent ?? "").toHaveClass("line-clamp-5");
    }
  });

  it("keeps the critical Review on the wall, and links every Review to its Product", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    expect(screen.getByRole("img", { name: "3 out of 5 stars" })).toBeInTheDocument();
    // Each row's second copy, for the seamless loop, is hidden from screen readers.
    expect(screen.getAllByRole("link", { name: "View product" })).toHaveLength(9);
  });

  it("shows the shop's Shopee rating with its as-of date", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    const badge = within(badgeOf(screen.getByText("874 shop ratings")));
    expect(badge.getByText("4.8")).toBeInTheDocument();
    expect(badge.getByRole("img", { name: "out of 5 stars" })).toHaveTextContent("★★★★★");
    expect(badge.getByText("as of Oct 2026")).toBeInTheDocument();
  });

  it("links to every review on the Shopee shop page, in a new tab", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    const readAll = screen.getByRole("link", { name: /^Read every review on Shopee/ });
    expect(readAll).toHaveAttribute("href", SHOPEE_SHOP);
    expect(readAll).toHaveAttribute("target", "_blank");
    expect(readAll).toHaveAccessibleName(/opens in a new tab/);
  });

  it("hides the Shopee link when the shop page is empty", () => {
    render(<HomeReviews reviews={pinned(9)} shopStats={shopStats} shopeeShopLink={null} />);
    expect(screen.queryByRole("link", { name: /Read every review/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View product" })).toHaveLength(9);
  });

  it("uses one row for a single pinned Review", () => {
    render(<HomeReviews reviews={pinned(1)} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />);
    expect(textsIn(row(1, 1))).toEqual(["Pinned review 1"]);
    expect(screen.getAllByRole("region", { name: /^Pinned reviews, row/ })).toHaveLength(1);
  });

  it("renders nothing with no pinned Reviews", () => {
    const { container } = render(
      <HomeReviews reviews={[]} shopStats={shopStats} shopeeShopLink={SHOPEE_SHOP} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

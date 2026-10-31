import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../../test/fixtures/catalogue";
import { RatingsTable } from "./ratings-table";

// "Ratings by reviewer": a row per Live Product with Shopee figures, in the
// order the page passes (best selling first). Each row filters the review
// wall to its Product and jumps to it.

const CE_CARDS = testLiveProduct();
const MT_NOTEBOOK = testLiveProduct({
  id: "prd-test-2",
  slug: "medtech-essential-notebook",
  examCode: "MT",
  shortName: "MedTech Essential Notebook",
  shopee: { rating: 4.3, ratingCount: 1234, unitsSold: 96, asOf: "2026-09-15" },
});

const rows = () => within(screen.getByRole("list", { name: "Ratings by reviewer" }));
const row = (name: string) => rows().getByRole("link", { name: new RegExp(name) });

describe("RatingsTable", () => {
  it("lists each Product with its Exam, rating and number of ratings, in order", () => {
    render(<RatingsTable products={[CE_CARDS, MT_NOTEBOOK]} />);

    expect(rows().getAllByRole("link")).toHaveLength(2);
    expect(row("CE Formula Flash Cards")).toHaveAccessibleName(
      "CE CE Formula Flash Cards rated 4.8 197 ratings",
    );
    expect(row("MedTech Essential Notebook")).toHaveAccessibleName(
      "MT MedTech Essential Notebook rated 4.3 1,234 ratings",
    );
    expect(rows().getAllByRole("link")[0]).toBe(row("CE Formula Flash Cards"));
  });

  it("links each row to the wall, filtered to its Product", () => {
    render(<RatingsTable products={[CE_CARDS, MT_NOTEBOOK]} />);

    expect(row("CE Formula Flash Cards")).toHaveAttribute(
      "href",
      "/reviews?product=ce-formula-flash-cards#wall",
    );
    expect(row("MedTech Essential Notebook")).toHaveAttribute(
      "href",
      "/reviews?product=medtech-essential-notebook#wall",
    );
  });

  it("draws each rating as a bar out of 5, hidden from screen readers", () => {
    render(<RatingsTable products={[MT_NOTEBOOK]} />);

    const bar = within(row("MedTech")).getByTestId("rating-bar");
    expect(bar).toHaveStyle({ width: "86%" });
    expect(bar.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("never lists a Coming Soon Product or one without Shopee figures, so no row reads 0.0", () => {
    render(
      <RatingsTable
        products={[
          CE_CARDS,
          testComingSoonProduct(),
          testLiveProduct({
            id: "prd-test-3",
            slug: "no-figures",
            shortName: "No Figures",
            shopee: null,
          }),
        ]}
      />,
    );

    expect(rows().getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
    expect(screen.queryByText(/No Figures/)).not.toBeInTheDocument();
  });

  it("marks the row the wall is filtered to", () => {
    render(
      <RatingsTable products={[CE_CARDS, MT_NOTEBOOK]} selectedSlug="medtech-essential-notebook" />,
    );

    expect(row("MedTech")).toHaveAttribute("aria-current", "true");
    expect(row("CE Formula")).not.toHaveAttribute("aria-current");
  });

  it("dates the figures by the oldest copy", () => {
    render(<RatingsTable products={[CE_CARDS, MT_NOTEBOOK]} />);
    expect(screen.getByText("Product ratings on Shopee as of Sep 2026")).toBeVisible();
  });

  it("renders nothing with no Products to rate", () => {
    const { container } = render(<RatingsTable products={[testComingSoonProduct()]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

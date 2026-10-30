import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testReview } from "../../../test/fixtures/catalogue";
import { ReviewCard } from "./review-card";

describe("ReviewCard", () => {
  it("shows the stars, text, Product, variation and helpful count", () => {
    render(<ReviewCard review={testReview()} />);
    expect(screen.getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText(/Readable fonts\./).textContent).toBe(
      "Readable fonts.\nHandy for review.",
    );
    expect(screen.getByText("CE Formula Flash Cards")).toBeInTheDocument();
    expect(screen.getByText("Variation: MSTC, HPGE, PSAD,160 gsm")).toBeInTheDocument();
    expect(screen.getByText("8 found this helpful")).toBeInTheDocument();
  });

  it("says when the variation isn't specified, and hides a zero helpful count", () => {
    render(<ReviewCard review={testReview({ variation: null, helpful: 0, stars: 3 })} />);
    expect(screen.getByRole("img", { name: "3 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText("Variation not specified")).toBeInTheDocument();
    expect(screen.queryByText(/found this helpful/)).not.toBeInTheDocument();
  });

  it("links to the Product only when asked", () => {
    const { rerender } = render(<ReviewCard review={testReview()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<ReviewCard review={testReview()} showProductLink />);
    expect(screen.getByRole("link", { name: /view product/i })).toHaveAttribute(
      "href",
      "/products/ce-formula-flash-cards",
    );
  });

  it("cuts the quote to five lines only when asked, keeping the whole text", () => {
    const quote = () => screen.getByRole("blockquote");
    const { rerender } = render(<ReviewCard review={testReview()} />);
    expect(quote()).not.toHaveClass("line-clamp-5");

    rerender(<ReviewCard review={testReview()} clampQuote />);
    expect(quote()).toHaveClass("line-clamp-5");
    expect(quote().textContent).toBe("Readable fonts.\nHandy for review.");
  });
});

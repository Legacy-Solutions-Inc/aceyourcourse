import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testLiveProduct, testReview } from "../../../test/fixtures/catalogue";
import { ProductReviews } from "./product-reviews";

describe("ProductReviews", () => {
  it("shows the Shopee rating with its date, then every Review", () => {
    render(
      <ProductReviews
        product={testLiveProduct()}
        reviews={[testReview(), testReview({ id: "rev-test-2", text: "Second review." })]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByTestId("review-summary")).toHaveTextContent(
      "★ 4.8 · 197 ratings on Shopee · as of Oct 2026",
    );
    expect(screen.getAllByRole("figure")).toHaveLength(2);
  });

  it("says there are no written Reviews yet when there are none", () => {
    render(<ProductReviews product={testLiveProduct()} reviews={[]} />);
    expect(screen.getByText("No written reviews yet")).toBeInTheDocument();
    expect(
      screen.getByText(/bought it\? leave a review on the store you ordered from/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("leaves the rating out for a Product with no Shopee figures", () => {
    render(<ProductReviews product={testLiveProduct({ shopee: null })} reviews={[]} />);
    expect(screen.queryByTestId("review-summary")).not.toBeInTheDocument();
  });
});

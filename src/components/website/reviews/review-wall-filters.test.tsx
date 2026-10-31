import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewFacetCounts, ReviewsQuery } from "@/lib/catalogue/review-filters";

import { ReviewWallFilters } from "./review-wall-filters";

// The wall's filters replace the URL; the page re-reads it on the server. The
// router is the boundary, so it is replaced and its calls are the outcome.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const COUNTS: ReviewFacetCounts = {
  all: 16,
  exams: { CE: 8, ME: 3, EE: 2, MT: 1, CPA: 2 },
  stars: { "5": 15, "4": 0, "3-or-less": 1 },
};

function renderFilters(filters: ReviewsQuery = {}, productName: string | null = null) {
  const props = { examCodes: ["CE", "ME", "EE", "MT", "CPA", "PHLE"], counts: COUNTS };
  const view = render(<ReviewWallFilters filters={filters} productName={productName} {...props} />);
  return {
    ...view,
    rerenderWith: (next: ReviewsQuery, nextName: string | null = null) =>
      view.rerender(<ReviewWallFilters filters={next} productName={nextName} {...props} />),
  };
}

const examChips = () => within(screen.getByRole("group", { name: "Exam" }));
const starChips = () => within(screen.getByRole("group", { name: "Stars" }));
const searchBox = () => screen.getByRole("searchbox", { name: "Search reviews" });
const NO_SCROLL = { scroll: false };

describe("ReviewWallFilters", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Exam and star chips with their counts, the selected ones pressed", () => {
    renderFilters({ examCode: "MT", stars: "3-or-less" });

    expect(examChips().getByRole("button", { name: "All 16 reviews" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(examChips().getByRole("button", { name: "MT 1 review" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(examChips().getByRole("button", { name: "CE 8 reviews" })).toBeVisible();
    expect(starChips().getByRole("button", { name: "All 16 reviews" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(starChips().getByRole("button", { name: "5 stars 15 reviews" })).toBeVisible();
    expect(starChips().getByRole("button", { name: "3 stars or fewer 1 review" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      starChips().getByRole("button", { name: "3 stars or fewer 1 review" }),
    ).toHaveTextContent("≤3★");
  });

  it('presses both "All" chips with no filters', () => {
    renderFilters();
    expect(examChips().getByRole("button", { name: "All 16 reviews" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(starChips().getByRole("button", { name: "All 16 reviews" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables a chip with no Reviews instead of hiding it", () => {
    renderFilters();

    expect(starChips().getByRole("button", { name: "4 stars 0 reviews" })).toBeDisabled();
    expect(examChips().getByRole("button", { name: "PHLE 0 reviews" })).toBeDisabled();
    expect(starChips().getByRole("button", { name: "5 stars 15 reviews" })).toBeEnabled();
  });

  it("replaces the URL without scrolling when a star chip is picked, keeping the other filters", async () => {
    const user = userEvent.setup();
    renderFilters(
      { productSlug: "ce-formula-flash-cards", query: "paper", sort: "highest" },
      "CE Formula Flash Cards",
    );

    await user.click(starChips().getByRole("button", { name: "5 stars 15 reviews" }));

    expect(replace).toHaveBeenCalledWith(
      "/reviews?product=ce-formula-flash-cards&stars=5&q=paper&sort=highest",
      NO_SCROLL,
    );
  });

  it("drops the Product when an Exam chip is picked, as a Product has one Exam", async () => {
    const user = userEvent.setup();
    renderFilters(
      { productSlug: "ce-formula-flash-cards", stars: "5", sort: "most-detailed" },
      "CE Formula Flash Cards",
    );

    await user.click(examChips().getByRole("button", { name: "ME 3 reviews" }));

    expect(replace).toHaveBeenCalledWith("/reviews?exam=me&stars=5&sort=most-detailed", NO_SCROLL);
  });

  it("clears a filter when its pressed chip is picked again", async () => {
    const user = userEvent.setup();
    renderFilters({ examCode: "MT", stars: "3-or-less" });

    await user.click(examChips().getByRole("button", { name: "MT 1 review" }));

    expect(replace).toHaveBeenCalledWith("/reviews?stars=3-or-less", NO_SCROLL);
  });

  it('clears one filter with its "All" chip', async () => {
    const user = userEvent.setup();
    renderFilters({ examCode: "MT", stars: "3-or-less" });

    await user.click(starChips().getByRole("button", { name: "All 16 reviews" }));

    expect(replace).toHaveBeenCalledWith("/reviews?exam=mt", NO_SCROLL);
  });

  it("searches after a pause in typing", async () => {
    const user = userEvent.setup();
    renderFilters({ examCode: "CE" });
    expect(searchBox()).toHaveAttribute("placeholder", "font size, delivery, paper…");

    await user.type(searchBox(), "delivery");

    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/reviews?exam=ce&q=delivery", NO_SCROLL),
    );
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("sorts, most helpful first by default", async () => {
    const user = userEvent.setup();
    renderFilters();
    const sort = screen.getByRole("combobox", { name: "Sort" });
    expect(sort).toHaveDisplayValue("Most helpful");
    expect(
      within(sort)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Most helpful", "Highest rated", "Most critical", "Most detailed"]);

    await user.selectOptions(sort, "Most critical");

    expect(replace).toHaveBeenCalledWith("/reviews?sort=most-critical", NO_SCROLL);
  });

  it("shows the Product filter as a chip that removes only the Product", async () => {
    const user = userEvent.setup();
    renderFilters({ productSlug: "ce-formula-flash-cards", stars: "5" }, "CE Formula Flash Cards");

    const chip = screen.getByRole("button", {
      name: "CE Formula Flash Cards, remove this filter",
    });
    await user.click(chip);

    expect(replace).toHaveBeenCalledWith("/reviews?stars=5", NO_SCROLL);
  });

  it("has no Product chip when the wall isn't filtered to a Product", () => {
    renderFilters({ stars: "5" });
    expect(screen.queryByRole("button", { name: /remove this filter/ })).not.toBeInTheDocument();
  });

  it("clears every filter and the search box", async () => {
    const user = userEvent.setup();
    renderFilters(
      { productSlug: "ce-formula-flash-cards", stars: "5", query: "paper", sort: "highest" },
      "CE Formula Flash Cards",
    );
    expect(searchBox()).toHaveValue("paper");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(replace).toHaveBeenCalledWith("/reviews", NO_SCROLL);
    expect(searchBox()).toHaveValue("");
  });

  it("offers Clear filters only when something is filtered", () => {
    renderFilters();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("follows the URL when something else changes it", () => {
    const { rerenderWith } = renderFilters({ query: "paper" });

    rerenderWith({ productSlug: "ce-formula-flash-cards" }, "CE Formula Flash Cards");

    expect(searchBox()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "CE Formula Flash Cards, remove this filter" }),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});

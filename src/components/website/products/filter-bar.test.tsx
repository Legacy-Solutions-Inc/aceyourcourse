import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FacetCounts, ProductsQuery } from "@/lib/catalogue/product-filters";

import { FilterBar } from "./filter-bar";

// The filter bar replaces the URL; the page re-reads it on the server. The
// router is the boundary, so it is replaced and its calls are the outcome.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const COUNTS: FacetCounts = {
  all: 8,
  exams: { CE: 3, ME: 1, EE: 1, MT: 2, CPA: 1 },
  formats: { "flash-cards": 4, posters: 1, notebook: 0, bundle: 1 },
};

function renderBar(query: ProductsQuery = {}, { memberAppLive = false } = {}) {
  const props = {
    examCodes: ["CE", "ME", "EE", "MT", "CPA", "PHLE"],
    counts: COUNTS,
    priceBounds: { min: 400, max: 1200 },
    memberAppLive,
  };
  const view = render(<FilterBar query={query} {...props} />);
  return {
    ...view,
    rerenderWith: (next: ProductsQuery) => view.rerender(<FilterBar query={next} {...props} />),
  };
}

const examChips = () => within(screen.getByRole("group", { name: "Exam" }));
const formatChips = () => within(screen.getByRole("group", { name: "Format" }));
const NO_SCROLL = { scroll: false };

describe("FilterBar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Exam and format chips with their counts, the selected ones pressed", () => {
    renderBar({ exam: "CE", format: "posters" });

    expect(examChips().getByRole("button", { name: "All 8 reviewers" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(examChips().getByRole("button", { name: "CE 3 reviewers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(examChips().getByRole("button", { name: "MT 2 reviewers" })).toBeVisible();
    // The format "All" chip counts within the selected Exam.
    expect(formatChips().getByRole("button", { name: "All 3 reviewers" })).toBeVisible();
    expect(formatChips().getByRole("button", { name: "Posters 1 reviewer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables a chip with no Products instead of hiding it", () => {
    renderBar();

    expect(formatChips().getByRole("button", { name: "Notebook 0 reviewers" })).toBeDisabled();
    expect(examChips().getByRole("button", { name: "PHLE 0 reviewers" })).toBeDisabled();
    expect(examChips().getByRole("button", { name: "CE 3 reviewers" })).toBeEnabled();
  });

  it("replaces the URL without scrolling when a chip is picked, keeping the other filters", async () => {
    const user = userEvent.setup();
    renderBar({ format: "posters", sort: "top-rated" });

    await user.click(examChips().getByRole("button", { name: "CE 3 reviewers" }));

    expect(replace).toHaveBeenCalledWith(
      "/products?exam=ce&format=posters&sort=top-rated",
      NO_SCROLL,
    );
  });

  it("clears a filter when its pressed chip is picked again", async () => {
    const user = userEvent.setup();
    renderBar({ exam: "CE", format: "posters" });

    await user.click(examChips().getByRole("button", { name: "CE 3 reviewers" }));

    expect(replace).toHaveBeenCalledWith("/products?format=posters", NO_SCROLL);
  });

  it('clears one filter with its "All" chip', async () => {
    const user = userEvent.setup();
    renderBar({ exam: "CE", format: "posters" });

    await user.click(formatChips().getByRole("button", { name: "All 3 reviewers" }));

    expect(replace).toHaveBeenCalledWith("/products?exam=ce", NO_SCROLL);
  });

  it("searches after a pause in typing", async () => {
    const user = userEvent.setup();
    renderBar({ exam: "CE" });

    await user.type(screen.getByRole("searchbox", { name: "Search reviewers" }), "MSTC");

    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/products?exam=ce&q=MSTC", NO_SCROLL),
    );
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("sorts", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "Price: low to high");

    expect(replace).toHaveBeenCalledWith("/products?sort=price-asc", NO_SCROLL);
  });

  it("filters by max price in whole pesos, with the price as its spoken value", async () => {
    renderBar();
    const slider = screen.getByRole("slider", { name: "Max price" });
    expect(slider).toHaveValue("1200");
    expect(slider).toHaveAttribute("aria-valuetext", "Any price");
    expect(slider).toHaveAttribute("min", "400");
    expect(slider).toHaveAttribute("step", "50");

    // A range input can't be dragged in jsdom, so its value is set directly.
    fireEvent.change(slider, { target: { value: "500" } });

    expect(slider).toHaveAttribute("aria-valuetext", "₱500");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/products?max=500", NO_SCROLL));
  });

  it('reads the top of the price slider as "Any"', async () => {
    renderBar({ max: 500 });
    const slider = screen.getByRole("slider", { name: "Max price" });
    expect(slider).toHaveValue("500");

    fireEvent.change(slider, { target: { value: "1200" } });

    expect(screen.getByText("Any")).toBeVisible();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/products", NO_SCROLL));
  });

  it("clears every filter and the search box", async () => {
    const user = userEvent.setup();
    renderBar({ exam: "CE", q: "MSTC", sort: "price-asc", max: 500 });
    expect(screen.getByRole("searchbox", { name: "Search reviewers" })).toHaveValue("MSTC");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(replace).toHaveBeenCalledWith("/products", NO_SCROLL);
    expect(screen.getByRole("searchbox", { name: "Search reviewers" })).toHaveValue("");
  });

  it("offers Clear filters only when something is filtered", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("follows the URL when something else changes it", () => {
    const { rerenderWith } = renderBar({ q: "MSTC", max: 500 });

    rerenderWith({ exam: "CE" });

    expect(screen.getByRole("searchbox", { name: "Search reviewers" })).toHaveValue("");
    expect(screen.getByRole("slider", { name: "Max price" })).toHaveValue("1200");
    expect(replace).not.toHaveBeenCalled();
  });

  it('has no "Also in app" toggle while the Member App switch is off', () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /also in app/i })).not.toBeInTheDocument();
  });

  it('toggles "Also in app" while the Member App switch is on', async () => {
    const user = userEvent.setup();
    renderBar({ exam: "CE" }, { memberAppLive: true });

    const toggle = screen.getByRole("button", { name: "Also in app" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(replace).toHaveBeenCalledWith("/products?exam=ce&app=1", NO_SCROLL);
  });
});

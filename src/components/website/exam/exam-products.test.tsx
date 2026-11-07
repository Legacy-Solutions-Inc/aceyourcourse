import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Product } from "@/services/catalogue.types";

import { testComingSoonProduct, testLiveProduct } from "../../../../test/fixtures/catalogue";
import { ExamProducts, type ExamProductItem } from "./exam-products";

// "Every {code} reviewer": the Exam's Live Products best selling first, then
// its Coming Soon ones, with format chips that filter the list in place when
// the Live Products come in more than one format.

const cards = testLiveProduct({ id: "cards", shortName: "CE Formula Flash Cards" });
const posters = testLiveProduct({
  id: "posters",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
});
const bundle = testLiveProduct({
  id: "bundle",
  shortName: "CE Review Bundle 3-in-1",
  format: "bundle",
});
const soonNotebook = testComingSoonProduct({ id: "notebook", shortName: "CE Solving Notebook" });
const soonPosters = testComingSoonProduct({
  id: "soon-posters",
  shortName: "CE Posters 3.0",
  format: "posters",
});

/** Each Product as an item, its card a plain heading with its name. */
const items = (...products: Product[]): ExamProductItem[] =>
  products.map((product) => ({
    id: product.id,
    format: product.format,
    live: product.state === "live",
    card: <h3>{product.shortName}</h3>,
  }));

const shown = () =>
  within(screen.getByRole("list", { name: "Every CE reviewer" }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
const chip = (name: RegExp) => screen.getByRole("button", { name });

describe("ExamProducts", () => {
  it("lists every Product in the order given, Live then Coming Soon", () => {
    render(<ExamProducts examCode="CE" items={items(cards, posters, bundle, soonNotebook)} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Every CE reviewer");
    expect(shown()).toEqual([
      "CE Formula Flash Cards",
      "Ultimate CE Posters 2.0",
      "CE Review Bundle 3-in-1",
      "CE Solving Notebook",
    ]);
  });

  it("offers a chip per Live format, counting Live Products only, with All pressed", () => {
    render(<ExamProducts examCode="CE" items={items(cards, posters, bundle, soonNotebook)} />);
    const chips = within(screen.getByRole("group", { name: "Filter by format" }));
    expect(chips.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "All3 reviewers",
      "Flash cards1 reviewer",
      "Posters1 reviewer",
      "Bundle1 reviewer",
    ]);
    expect(chip(/^All/)).toHaveAccessibleName("All 3 reviewers");
    // No Live notebook, so no Notebook chip.
    expect(chips.queryByRole("button", { name: /notebook/i })).not.toBeInTheDocument();
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true");
  });

  it("filters the list in place, Coming Soon included, and back to All", async () => {
    const user = userEvent.setup();
    render(
      <ExamProducts
        examCode="CE"
        items={items(cards, posters, bundle, soonNotebook, soonPosters)}
      />,
    );

    await user.click(chip(/^Posters/));
    expect(chip(/^Posters/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "false");
    expect(shown()).toEqual(["Ultimate CE Posters 2.0", "CE Posters 3.0"]);

    await user.click(chip(/^All/));
    expect(shown()).toHaveLength(5);
  });

  it("has no chips when the Live Products are all one format", () => {
    render(<ExamProducts examCode="CE" items={items(cards, soonNotebook, soonPosters)} />);
    expect(screen.queryByRole("group", { name: "Filter by format" })).not.toBeInTheDocument();
    expect(shown()).toEqual(["CE Formula Flash Cards", "CE Solving Notebook", "CE Posters 3.0"]);
  });

  it("has no chips with only Coming Soon Products, even in several formats", () => {
    render(<ExamProducts examCode="CE" items={items(soonNotebook, soonPosters)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(shown()).toHaveLength(2);
  });
});

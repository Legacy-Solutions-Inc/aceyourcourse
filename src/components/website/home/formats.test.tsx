import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "@/services/catalogue.types";

import {
  testComingSoonProduct,
  testExam,
  testLiveProduct,
} from "../../../../test/fixtures/catalogue";
import { Formats } from "./formats";

// "Which format fits how you study?" (docs/mockup/website/Home_v2.dc.html
// L174–197): a card per format, its "For" Exams and "From" price computed from
// the Live Products, each linking to the Products page filtered by format.

const exams = ["CE", "ME", "EE", "MT", "CPA"].map((code) => testExam({ code }));
const live = (slug: string, overrides: Partial<Product>) =>
  testLiveProduct({ id: slug, slug, ...overrides });

// In best-selling order, as listProducts returns them.
const products = [
  live("ce-cards", { examCode: "CE", priceFrom: 120000 }),
  live("me-cards", { examCode: "ME", priceFrom: 95000 }),
  live("ce-posters", { examCode: "CE", format: "posters", priceFrom: 40000, priceTo: 125000 }),
  live("mt-notebook", { examCode: "MT", format: "notebook", priceFrom: 69900 }),
  live("mt-cards", { examCode: "MT", priceFrom: 55000 }),
  live("ce-bundle", {
    examCode: "CE",
    format: "bundle",
    priceFrom: 120000,
    priceTo: 349900,
    // Each part alone, or all three as the 3-in-1: ₱3,699 against ₱3,499.
    variations: [120000, 124900, 125000, 349900].map((price) => ({ name: `₱${price}`, price })),
  }),
];

const cards = () =>
  within(screen.getByRole("list", { name: "Which format fits how you study?" })).getAllByRole(
    "listitem",
  );
/** A card by its title, for queries inside it. */
function card(title: string) {
  const found = cards().find((item) => within(item).queryByRole("heading", { name: title }));
  if (!found) throw new Error(`no ${title} card`);
  return within(found);
}

describe("Formats", () => {
  it("shows a card per format in the mockup's order, linking to Products filtered by it", () => {
    render(<Formats products={products} exams={exams} memberAppLive={false} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Which format fits how you study?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Most passers mix two/)).toBeInTheDocument();
    expect(
      cards().map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["Flash cards", "Notebook", "Posters", "Bundle"]);
    expect(card("Posters").getByRole("link", { name: "Posters" })).toHaveAttribute(
      "href",
      "/products?format=posters",
    );
    expect(card("Flash cards").getByRole("link", { name: "Flash cards" })).toHaveAttribute(
      "href",
      "/products?format=flash-cards",
    );
  });

  it("computes each card's Exams and lowest Live price, next to its fixed copy", () => {
    render(<Formats products={products} exams={exams} memberAppLive={false} />);
    const flashCards = card("Flash cards");
    expect(flashCards.getByText("4 × 6 in · 160 gsm")).toBeInTheDocument();
    expect(flashCards.getByText(/^Formulas and high-yield concepts/)).toBeInTheDocument();
    expect(flashCards.getByText("For CE · ME · MT")).toBeInTheDocument();
    expect(flashCards.getByText("₱550")).toBeInTheDocument();
    expect(card("Notebook").getByText("For MT")).toBeInTheDocument();
    expect(card("Posters").getByText("₱400")).toBeInTheDocument();
    expect(
      card("Bundle").getByText(
        "All three CE formats in one order, ₱200 less than buying each separately.",
      ),
    ).toBeInTheDocument();
  });

  it("drops the bundle's saving when the catalogue gives none", () => {
    const noSaving = products.map((product) =>
      product.format === "bundle" ? { ...product, variations: [] } : product,
    );
    render(<Formats products={noSaving} exams={exams} memberAppLive={false} />);
    expect(card("Bundle").getByText("All three CE formats in one order.")).toBeInTheDocument();
    expect(card("Bundle").queryByText(/less than buying/)).not.toBeInTheDocument();
  });

  it("hides the card of a format with no Live Products, whatever is Coming Soon", () => {
    const soonNotebook = testComingSoonProduct({ id: "ce-notebook", examCode: "CE" });
    const noNotebook = products.filter((product) => product.format !== "notebook");
    render(
      <Formats products={[...noNotebook, soonNotebook]} exams={exams} memberAppLive={false} />,
    );
    expect(
      cards().map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["Flash cards", "Posters", "Bundle"]);
  });

  it("never lets a Coming Soon Product change a card's Exams or price", () => {
    const soonCards = testComingSoonProduct({
      id: "ee-cards",
      examCode: "EE",
      format: "flash-cards",
    });
    render(<Formats products={[soonCards, ...products]} exams={exams} memberAppLive={false} />);
    expect(card("Flash cards").getByText("For CE · ME · MT")).toBeInTheDocument();
    expect(card("Flash cards").getByText("₱550")).toBeInTheDocument();
  });

  it("renders nothing with no Live Products", () => {
    const { container } = render(
      <Formats products={[testComingSoonProduct()]} exams={exams} memberAppLive={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the app band only while the Member App switch is on", () => {
    const { rerender } = render(
      <Formats products={products} exams={exams} memberAppLive={false} />,
    );
    expect(screen.queryByText("Prefer your phone?")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /See app plans/ })).not.toBeInTheDocument();

    rerender(<Formats products={products} exams={exams} memberAppLive />);
    expect(screen.getByText("Prefer your phone?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See app plans/ })).toHaveAttribute(
      "href",
      "/app/plans",
    );
  });
});

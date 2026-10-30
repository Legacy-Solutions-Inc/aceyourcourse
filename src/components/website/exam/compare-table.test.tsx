import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../../test/fixtures/catalogue";
import { CompareTable } from "./compare-table";

// "Which one should I get?": the Exam's Live Products side by side, with what
// each format is best for (docs/mockup/website/Exam_v2.dc.html L106–125).

const cards = testLiveProduct({ id: "cards", availableInApp: true });
const posters = testLiveProduct({
  id: "posters",
  slug: "ultimate-ce-posters-2-0",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
  size: "A3",
  priceFrom: 40000,
  priceTo: 125000,
  availableInApp: false,
});
const soonNotebook = testComingSoonProduct({ id: "notebook" });

const table = () => screen.getByRole("table", { name: "Which one should I get?" });
const rows = () => within(table()).getAllByRole("row").slice(1);
const headers = () =>
  within(table())
    .getAllByRole("columnheader")
    .map((header) => header.textContent);

describe("CompareTable", () => {
  it("compares the Live Products: reviewer, format and size, best for and price", () => {
    render(<CompareTable products={[cards, posters]} memberAppLive={false} />);
    expect(headers()).toEqual(["Reviewer", "Format", "Best for", "Price"]);
    const [first, second] = rows();
    expect(
      within(first ?? table()).getByRole("link", { name: "CE Formula Flash Cards" }),
    ).toHaveAttribute("href", "/products/ce-formula-flash-cards");
    expect(first).toHaveTextContent("Flash cards · 4 × 6 in · 160 gsm");
    expect(first).toHaveTextContent("Quick recall on the go");
    expect(first).toHaveTextContent("₱1,200");
    expect(second).toHaveTextContent("Posters · A3");
    expect(second).toHaveTextContent("Your study wall, active recall");
    expect(second).toHaveTextContent("from ₱400");
  });

  it("adds the In-the-app column only while the Member App is live", () => {
    render(<CompareTable products={[cards, posters]} memberAppLive={true} />);
    expect(headers()).toEqual(["Reviewer", "Format", "Best for", "In the app", "Price"]);
    const [first, second] = rows();
    expect(first).toHaveTextContent("Yes");
    expect(second).toHaveTextContent("Physical only");
  });

  it("leaves Coming Soon Products out", () => {
    render(<CompareTable products={[cards, posters, soonNotebook]} memberAppLive={false} />);
    expect(rows()).toHaveLength(2);
    expect(table()).not.toHaveTextContent("CE Solving Notebook");
  });

  it("renders nothing with fewer than 2 Live Products", () => {
    const { container } = render(
      <CompareTable products={[cards, soonNotebook]} memberAppLive={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

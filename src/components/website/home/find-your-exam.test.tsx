import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Product } from "@/services/catalogue.types";

import {
  testComingSoonProduct,
  testExam,
  testLiveProduct,
} from "../../../../test/fixtures/catalogue";
import { FindYourExam } from "./find-your-exam";

// "Find your exam" (docs/mockup/website/Home_v2.dc.html L86–137, L326–338):
// a tab per Exam with Live Products, each with its Subjects and its Live
// Products by units sold. The mockup's "Other courses" tab and "Coming to the
// site" row were dropped.

const CE = testExam();
const ME = testExam({
  code: "ME",
  board: "MELE",
  name: "Mechanical Engineering",
  longName: "Mechanical Engineering Licensure Exam",
  blurb: "Machine design to power plant.",
  subjects: [{ code: "PIP", name: "Power & Industrial Plant Engineering" }],
});
const PHLE = testExam({ code: "PHLE", board: "PLE", name: "Medicine", subjects: [] });

const ceCards = testLiveProduct();
const cePosters = testLiveProduct({
  id: "ce-posters",
  slug: "ultimate-ce-posters-2-0",
  shortName: "Ultimate CE Posters 2.0",
  format: "posters",
  priceFrom: 40000,
  priceTo: 125000,
  availableInApp: false,
  shopee: { rating: 4.9, ratingCount: 52, unitsSold: 172, asOf: "2026-10-29" },
});
const meCards = testLiveProduct({
  id: "me-cards",
  slug: "me-formula-flash-cards",
  examCode: "ME",
  shortName: "ME Formula Flash Cards",
  priceFrom: 95000,
  availableInApp: false,
  shopee: { rating: 4.8, ratingCount: 95, unitsSold: 404, asOf: "2026-10-29" },
});
const ceSoon = testComingSoonProduct();
const phleSoon = testComingSoonProduct({ id: "phle", slug: "phle-cards", examCode: "PHLE" });

// Live Products by units sold, as listProducts() returns them.
const PRODUCTS: Product[] = [ceCards, meCards, cePosters];

function renderSection({
  products = PRODUCTS,
  memberAppLive = false,
}: { products?: Product[]; memberAppLive?: boolean } = {}) {
  return render(
    <FindYourExam exams={[CE, ME, PHLE]} products={products} memberAppLive={memberAppLive} />,
  );
}

const panel = () => within(screen.getByRole("tabpanel"));
const rows = () => within(panel().getByRole("list", { name: /Choose a format/ }));
const subjectChips = () =>
  within(panel().getByRole("list", { name: "Subjects covered" })).getAllByRole("button");

describe("FindYourExam", () => {
  it("is the #exams section, with a tab per Exam that has Live Products", () => {
    renderSection({ products: [...PRODUCTS, ceSoon, phleSoon] });
    const section = screen.getByRole("region", { name: "Find your exam" });
    expect(section).toHaveAttribute("id", "exams");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "CECivil Engineering",
      "MEMechanical Engineering",
    ]);
    expect(screen.getByRole("tab", { name: /^CE/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/Other courses/i)).toBeNull();
    expect(screen.queryByText(/Coming to the site/i)).toBeNull();
  });

  it("shows the Exam's name, board, long name, blurb and Subjects with full names", () => {
    renderSection();
    expect(panel().getByRole("heading", { level: 3, name: "Civil Engineering" })).toBeVisible();
    expect(panel().getByText("CELE · Civil Engineering Licensure Exam")).toBeInTheDocument();
    expect(panel().getByText("Three subjects, four formats.")).toBeInTheDocument();
    // The code shows, and screen readers hear the full name too.
    const chips = subjectChips();
    expect(chips.map((chip) => chip.firstChild?.textContent)).toEqual(["MSTC", "HPGE", "PSAD"]);
    expect(chips[0]).toHaveAccessibleName(
      "MSTC · Mathematics, Surveying & Transportation Engineering",
    );
    expect(chips[2]).toHaveAccessibleName("PSAD · Principles of Structural Analysis & Design");
  });

  it("lists the Exam's Live Products by units sold, each linking to its Product page", () => {
    renderSection({ products: [...PRODUCTS, ceSoon] });
    expect(panel().getByText("Step 2 · Choose a format · 2 reviewers")).toBeInTheDocument();
    const links = rows()
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["CE Formula Flash Cards", "/products/ce-formula-flash-cards"],
      ["Ultimate CE Posters 2.0", "/products/ultimate-ce-posters-2-0"],
    ]);
    const first = within(rows().getAllByRole("listitem")[0] as HTMLElement);
    expect(first.getByText("Flash cards")).toBeInTheDocument();
    expect(first.getByText("₱1,200")).toBeInTheDocument();
    expect(first.getByText(/764 sold/)).toBeInTheDocument();
    expect(panel().queryByText("CE Solving Notebook")).toBeNull();
  });

  it("links to the Exam page, and never to the app while the switch is off", () => {
    renderSection();
    expect(panel().getByRole("link", { name: "All CE reviewers" })).toHaveAttribute(
      "href",
      "/exams/ce",
    );
    expect(panel().queryByText(/in the app|also in app/i)).toBeNull();
    expect(document.querySelector('a[href^="/app"]')).toBeNull();
  });

  it("offers Review in the app and Also in app badges while the switch is on", () => {
    renderSection({ memberAppLive: true });
    expect(panel().getByRole("link", { name: "Review CE in the app" })).toHaveAttribute(
      "href",
      "/app",
    );
    const [cards, posters] = rows().getAllByRole("listitem");
    expect(within(cards as HTMLElement).getByText("Also in app")).toBeInTheDocument();
    expect(within(posters as HTMLElement).queryByText("Also in app")).toBeNull();
  });

  it("leaves out Review in the app for an Exam with nothing in the app", async () => {
    const user = userEvent.setup();
    renderSection({ memberAppLive: true });
    await user.click(screen.getByRole("tab", { name: /^ME/ }));
    expect(panel().queryByRole("link", { name: /in the app/ })).toBeNull();
  });

  it("moves to the next Exam with ArrowRight, showing its Products", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("tab", { name: /^CE/ }));
    await user.keyboard("{ArrowRight}");

    const me = screen.getByRole("tab", { name: /^ME/ });
    expect(me).toHaveFocus();
    expect(me).toHaveAttribute("aria-selected", "true");
    expect(
      panel().getByRole("heading", { level: 3, name: "Mechanical Engineering" }),
    ).toBeVisible();
    expect(rows().getByRole("link", { name: "ME Formula Flash Cards" })).toHaveAttribute(
      "href",
      "/products/me-formula-flash-cards",
    );
    expect(panel().getByText("Step 2 · Choose a format · 1 reviewer")).toBeInTheDocument();
  });

  it("renders nothing when no Exam has Live Products", () => {
    const { container } = renderSection({ products: [ceSoon] });
    expect(container).toBeEmptyDOMElement();
  });
});

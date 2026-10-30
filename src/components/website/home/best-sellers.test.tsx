import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/services/catalogue.types";

import { testComingSoonProduct, testLiveProduct } from "../../../../test/fixtures/catalogue";
import { BestSellers } from "./best-sellers";

// Home "Best sellers" (docs/mockup/website/Home_v2.dc.html L140–172, L341–342):
// the top Live Products by units sold on Shopee, in a scroll-snap carousel.

function seller(rank: number, unitsSold: number, overrides: Partial<Product> = {}): Product {
  return testLiveProduct({
    id: `seller-${rank}`,
    slug: `seller-${rank}`,
    shortName: `Seller ${rank}`,
    shopee: { rating: 4.8, ratingCount: 100 + rank, unitsSold, asOf: "2026-10-29" },
    ...overrides,
  });
}

const SIX = [764, 404, 273, 240, 172, 96].map((sold, index) => seller(index + 1, sold));

const list = () => within(screen.getByRole("list", { name: "Best sellers" }));
const cards = () => list().getAllByRole("listitem");
/** The card at a 0-based position, for queries inside it. */
function card(position: number) {
  const found = cards()[position];
  if (!found) throw new Error(`no card at ${position}`);
  return within(found);
}
const previous = () => screen.getByRole("button", { name: "Previous best sellers" });
const next = () => screen.getByRole("button", { name: "Next best sellers" });
const track = () => screen.getByRole("list", { name: "Best sellers" });

/** Gives the carousel's track a size and scroll position, as a browser would. */
function layOut(element: HTMLElement, { scrollWidth = 0, clientWidth = 0, scrollLeft = 0 }) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft },
  });
  fireEvent.scroll(element);
}

describe("BestSellers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing with no best sellers", () => {
    const { container } = render(<BestSellers products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ranks the sellers, with units sold on Shopee and the as-of date", () => {
    render(<BestSellers products={SIX} />);
    expect(screen.getByRole("heading", { level: 2, name: "Best sellers" })).toBeInTheDocument();
    expect(screen.getByText("Ranked by units sold on Shopee")).toBeInTheDocument();
    expect(screen.getByText("as of Oct 2026")).toBeInTheDocument();
    expect(cards()).toHaveLength(6);
    expect(cards().map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Seller 1",
      "Seller 2",
      "Seller 3",
      "Seller 4",
      "Seller 5",
      "Seller 6",
    ]);
    expect(card(0).getByText("#1")).toHaveClass("bg-ayc-orange");
    expect(card(1).getByText("#2")).not.toHaveClass("bg-ayc-orange");
  });

  it("shows each card's Exam, format, rating, price and units sold, linking to its Product page", () => {
    render(<BestSellers products={SIX} />);
    const first = card(0);
    expect(first.getByText("CE · Flash cards")).toBeInTheDocument();
    expect(first.getByText("₱1,200")).toBeInTheDocument();
    expect(first.getByText("764 sold")).toBeInTheDocument();
    expect(first.getByRole("img", { name: "Rating" }).parentElement).toHaveTextContent(
      "4.8 · 101 ratings",
    );
    expect(first.getByRole("link", { name: "Seller 1" })).toHaveAttribute(
      "href",
      "/products/seller-1",
    );
  });

  it("draws each sold bar relative to #1", () => {
    render(<BestSellers products={SIX} />);
    const bars = cards().map((card) => card.querySelector<HTMLElement>("[data-sold-bar]"));
    expect(bars[0]).toHaveStyle({ width: "100%" });
    // 404 / 764 = 52.9%
    expect(bars[1]).toHaveStyle({ width: "53%" });
    expect(bars[1]?.closest("[aria-hidden]")).not.toBeNull();
  });

  it("leaves out Coming Soon Products and Products without Shopee figures", () => {
    render(
      <BestSellers
        products={[seller(1, 764), testComingSoonProduct(), seller(2, 404, { shopee: null })]}
      />,
    );
    expect(cards()).toHaveLength(1);
    expect(screen.queryByText("CE Solving Notebook")).toBeNull();
  });

  it("shows only what exists, with both arrows disabled when nothing overflows", () => {
    render(<BestSellers products={SIX.slice(0, 3)} />);
    layOut(track(), { scrollWidth: 1000, clientWidth: 1200 });
    expect(cards()).toHaveLength(3);
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
  });

  it("disables ← at the start and → at the end, and scrolls with →", async () => {
    const user = userEvent.setup();
    render(<BestSellers products={SIX} />);
    const element = track();
    const scrollBy = vi.fn();
    element.scrollBy = scrollBy;

    layOut(element, { scrollWidth: 2000, clientWidth: 1000, scrollLeft: 0 });
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();

    await user.click(next());
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 680 }));

    layOut(element, { scrollWidth: 2000, clientWidth: 1000, scrollLeft: 1000 });
    expect(previous()).toBeEnabled();
    expect(next()).toBeDisabled();

    await user.click(previous());
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -680 }));
  });

  it("scrolls without smoothing for a Visitor who prefers reduced motion", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    render(<BestSellers products={SIX} />);
    const element = track();
    const scrollBy = vi.fn();
    element.scrollBy = scrollBy;
    layOut(element, { scrollWidth: 2000, clientWidth: 500 });

    await user.click(next());
    // 80% of a 500 px track.
    expect(scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "auto" });
  });
});

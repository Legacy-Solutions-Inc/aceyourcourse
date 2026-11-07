import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { ProductCard } from "./product-card";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: null,
};

function card() {
  return screen.getByRole("article");
}

describe("ProductCard", () => {
  it("shows a Live Product's name, format, Subjects, price and Shopee figures, linking to its page", () => {
    render(<ProductCard product={testLiveProduct()} memberAppLive={false} />);
    expect(within(card()).getByRole("link", { name: "CE Formula Flash Cards" })).toHaveAttribute(
      "href",
      "/products/ce-formula-flash-cards",
    );
    expect(card()).toHaveTextContent("Flash cards · 4 × 6 in · 160 gsm");
    expect(card()).toHaveTextContent("MSTC · HPGE · PSAD");
    expect(card()).toHaveTextContent("₱1,200");
    expect(card()).toHaveTextContent("4.8 · 764 sold");
    expect(card()).toHaveTextContent("Any 2 · 4% off");
  });

  it('shows "from" the lowest price for a range', () => {
    render(
      <ProductCard
        product={testLiveProduct({ priceFrom: 40000, priceTo: 125000 })}
        memberAppLive={false}
      />,
    );
    expect(card()).toHaveTextContent("from ₱400");
  });

  it("shows a Coming Soon Product with its badge and placeholder, and no price or figures", () => {
    render(
      <ProductCard product={testComingSoonProduct()} memberAppLive={true} shopLinks={SHOP_LINKS} />,
    );
    expect(card()).toHaveTextContent("Coming soon");
    expect(card()).not.toHaveTextContent("₱");
    expect(card()).not.toHaveTextContent(/sold|ratings|★/i);
    expect(card().querySelector("img")).toHaveAttribute("src", "/products/coming-soon.svg");
    expect(within(card()).queryByRole("link", { name: /buy on/i })).not.toBeInTheDocument();
  });

  it("never shows ₱0, even for a Coming Soon Product priced 0 by mistake", () => {
    render(<ProductCard product={testComingSoonProduct({ priceFrom: 0 })} memberAppLive={false} />);
    expect(card()).not.toHaveTextContent("₱0");
  });

  it("shows the In app badge only while the Member App is live and the Product is in the app", () => {
    const { rerender } = render(<ProductCard product={testLiveProduct()} memberAppLive={true} />);
    expect(within(card()).getByText("In app")).toBeInTheDocument();

    rerender(<ProductCard product={testLiveProduct()} memberAppLive={false} />);
    expect(within(card()).queryByText("In app")).not.toBeInTheDocument();

    rerender(
      <ProductCard product={testLiveProduct({ availableInApp: false })} memberAppLive={true} />,
    );
    expect(within(card()).queryByText("In app")).not.toBeInTheDocument();
  });

  it('shows a highlight such as "#1 in CE" when given one, and none by default', () => {
    const { rerender } = render(<ProductCard product={testLiveProduct()} memberAppLive={false} />);
    expect(card()).not.toHaveTextContent("#1 in CE");

    rerender(
      <ProductCard product={testLiveProduct()} memberAppLive={false} highlight="#1 in CE" />,
    );
    expect(within(card()).getByText("#1 in CE")).toBeInTheDocument();
  });

  it("adds store buttons when given the shop links, hiding any with nowhere to go", () => {
    render(
      <ProductCard product={testLiveProduct()} memberAppLive={false} shopLinks={SHOP_LINKS} />,
    );
    expect(within(card()).getByRole("link", { name: /buy on shopee/i })).toHaveAttribute(
      "href",
      testLiveProduct().listings.shopee,
    );
    expect(within(card()).getByRole("link", { name: /buy on lazada/i })).toHaveAttribute(
      "href",
      SHOP_LINKS.lazada,
    );
    expect(within(card()).queryByRole("link", { name: /tiktok/i })).not.toBeInTheDocument();
  });
});

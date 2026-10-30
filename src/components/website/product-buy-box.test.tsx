import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { testComingSoonProduct, testLiveProduct } from "../../../test/fixtures/catalogue";
import { ProductBuyBox } from "./product-buy-box";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/ce-formula-flash-cards" }));

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
};
const NO_SHOP_LINKS = { shopee: null, lazada: null, tiktok: null };
const EMAIL = "aceyourcourseinc@gmail.com";

describe("ProductBuyBox", () => {
  it("heads the box with the printed copy's price and where it ships from", () => {
    render(
      <ProductBuyBox product={testLiveProduct()} shopLinks={SHOP_LINKS} contactEmail={EMAIL} />,
    );
    expect(screen.getByTestId("buy-box-header")).toHaveTextContent(
      "Printed copy · ₱1,200Ships from Iloilo City",
    );
  });

  it("buys on the Product's Shopee Listing and the other Marketplaces' shop pages", () => {
    const product = testLiveProduct();
    render(<ProductBuyBox product={product} shopLinks={SHOP_LINKS} contactEmail={EMAIL} />);
    expect(screen.getByRole("link", { name: /buy on shopee/i })).toHaveAttribute(
      "href",
      product.listings.shopee,
    );
    expect(screen.getByRole("link", { name: /buy on lazada/i })).toHaveAttribute(
      "href",
      SHOP_LINKS.lazada,
    );
    expect(screen.getByRole("link", { name: /buy on tiktok shop/i })).toHaveAttribute(
      "href",
      SHOP_LINKS.tiktok,
    );
  });

  it("shows the contact note instead when every store button is hidden", () => {
    render(
      <ProductBuyBox
        product={testLiveProduct({ listings: {} })}
        shopLinks={NO_SHOP_LINKS}
        contactEmail={EMAIL}
      />,
    );
    expect(screen.queryByRole("link", { name: /buy on/i })).not.toBeInTheDocument();
    expect(screen.getByText(/store links coming soon\. questions\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute("href", `mailto:${EMAIL}`);
  });

  it("renders nothing for a Coming Soon Product", () => {
    const { container } = render(
      <ProductBuyBox
        product={testComingSoonProduct()}
        shopLinks={SHOP_LINKS}
        contactEmail={EMAIL}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

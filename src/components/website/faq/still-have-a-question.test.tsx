import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StillHaveAQuestion } from "./still-have-a-question";

vi.mock("next/navigation", () => ({ usePathname: () => "/faq" }));

const EMAIL = "aceyourcourseinc@gmail.com";
const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

describe("StillHaveAQuestion", () => {
  it("offers Email us and Chat us on Shopee", () => {
    render(<StillHaveAQuestion contactEmail={EMAIL} shopeeShop={SHOPEE_SHOP} />);
    expect(screen.getByRole("heading", { name: "Still have a question?" })).toBeVisible();
    expect(screen.getByText(`Customer support: email us at ${EMAIL}, or chat us on Shopee.`));
    expect(screen.getByRole("link", { name: "Email us" })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
    const chat = screen.getByRole("link", { name: "Chat us on Shopee (opens in a new tab)" });
    expect(chat).toHaveAttribute("href", SHOPEE_SHOP);
    expect(chat).toHaveAttribute("target", "_blank");
  });

  it("offers only the email when there is no Shopee shop", () => {
    render(<StillHaveAQuestion contactEmail={EMAIL} shopeeShop={null} />);
    expect(screen.getByText(`Customer support: email us at ${EMAIL}.`)).toBeVisible();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Email us"]);
  });
});

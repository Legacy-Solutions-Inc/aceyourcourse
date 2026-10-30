import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "./mobile-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/faq" }));
vi.mock("posthog-js", () => ({ default: { __loaded: true, capture: vi.fn() } }));

const capture = vi.mocked(posthog.capture);

const EXAMS = [
  { code: "CE", name: "Civil Engineering" },
  { code: "MT", name: "Medical Technology" },
];

const SHOP_LINKS = {
  shopee: "https://shopee.ph/aceyourcourse",
  lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
  tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
};

async function openDrawer(props: Partial<Parameters<typeof MobileNav>[0]> = {}) {
  const user = userEvent.setup();
  render(<MobileNav exams={EXAMS} shopLinks={SHOP_LINKS} memberAppLive={false} {...props} />);
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  return { user, drawer: screen.getByRole("dialog") };
}

describe("MobileNav", () => {
  beforeEach(() => {
    capture.mockReset();
  });

  it("starts closed behind a burger button", () => {
    render(<MobileNav exams={EXAMS} shopLinks={SHOP_LINKS} memberAppLive={false} />);
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a drawer with the Exam grid and the four links, marking the current page", async () => {
    const { drawer } = await openDrawer();

    expect(within(drawer).getByRole("link", { name: /^CE/ })).toHaveAttribute("href", "/exams/ce");
    expect(within(drawer).getByRole("link", { name: /^MT/ })).toHaveAttribute("href", "/exams/mt");
    for (const [name, href] of [
      ["Products", "/products"],
      ["Reviews", "/reviews"],
      ["About", "/about"],
      ["FAQ", "/faq"],
    ] as const) {
      expect(within(drawer).getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(within(drawer).getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(drawer).getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });

  it("has a Printed copies row with every Marketplace shop link, opening in a new tab", async () => {
    const { drawer } = await openDrawer();

    expect(within(drawer).getByText(/printed copies/i)).toBeInTheDocument();
    for (const [name, href] of [
      [/shopee/i, SHOP_LINKS.shopee],
      [/lazada/i, SHOP_LINKS.lazada],
      [/tiktok/i, SHOP_LINKS.tiktok],
    ] as const) {
      const link = within(drawer).getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("fires marketplace_click for a shop link, with no Product", async () => {
    const { user, drawer } = await openDrawer();

    await user.click(within(drawer).getByRole("link", { name: /lazada/i }));

    expect(capture).toHaveBeenCalledWith("marketplace_click", {
      marketplace: "lazada",
      page: "/faq",
      link: "shop",
    });
  });

  it("hides a Marketplace with no shop link, leaving no empty link", async () => {
    const { drawer } = await openDrawer({ shopLinks: { ...SHOP_LINKS, lazada: null } });

    expect(within(drawer).queryByRole("link", { name: /lazada/i })).not.toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /shopee/i })).toBeInTheDocument();
    for (const link of within(drawer).getAllByRole("link")) {
      expect(link.getAttribute("href")).toBeTruthy();
      expect(link.textContent?.trim()).toBeTruthy();
    }
  });

  it("drops the Printed copies row when no Marketplace has a shop link", async () => {
    const { drawer } = await openDrawer({
      shopLinks: { shopee: null, lazada: null, tiktok: null },
    });
    expect(within(drawer).queryByText(/printed copies/i)).not.toBeInTheDocument();
  });

  it("has no Member App links while the switch is off", async () => {
    const { drawer } = await openDrawer({ memberAppLive: false });

    expect(within(drawer).queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole("link", { name: /start reviewing/i }),
    ).not.toBeInTheDocument();
    const appLinks = within(drawer)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/app"));
    expect(appLinks).toEqual([]);
  });

  it("links Sign in and Start reviewing to the Member App while the switch is on", async () => {
    const { drawer } = await openDrawer({ memberAppLive: true });

    expect(within(drawer).getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/app");
    expect(within(drawer).getByRole("link", { name: /start reviewing/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("closes when a site link is chosen", async () => {
    const { user, drawer } = await openDrawer();
    window.addEventListener("click", (event) => event.preventDefault(), { once: true });

    await user.click(within(drawer).getByRole("link", { name: "Products" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import posthog from "posthog-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogueSeed } from "@/services/catalogue.schema";
import { resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "../../../test/catalogue-seed";

// The footer is an async Server Component that reads the real Catalogue seam.
// Each test imports it fresh, so the Member App switch and seed edits apply.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("posthog-js", () => ({ default: { __loaded: true, capture: vi.fn() } }));

async function renderFooter({
  memberAppLive,
  editSeed,
}: {
  memberAppLive?: "true" | "false";
  editSeed?: (seed: CatalogueSeed) => void;
} = {}) {
  vi.stubEnv("MEMBER_APP_LIVE", memberAppLive);
  vi.resetModules();
  if (editSeed) {
    editSampleCatalogue(editSeed);
  }
  const { SiteFooter } = await import("./site-footer");
  render(await SiteFooter());
  return screen.getByRole("contentinfo");
}

function link(footer: HTMLElement, name: string | RegExp) {
  return within(footer).getByRole("link", { name });
}

// Every test starts from the seed, whatever the one before it edited.
afterEach(() => {
  resetSampleStore();
});

describe("SiteFooter", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.mocked(posthog.capture).mockReset();
  });

  it("shows the headline and the three Marketplace shop links under Where to buy", async () => {
    const footer = await renderFooter();

    expect(footer).toHaveTextContent("Built by board passers. Designed for dreamers.");
    expect(within(footer).getByText("Where to buy")).toBeInTheDocument();
    for (const [name, href] of [
      // Not the "Shopee · 3.7K followers" link, which goes to the same shop.
      [/^shopee \(opens in a new tab\)$/i, "https://shopee.ph/aceyourcourse"],
      [/^lazada/i, "https://www.lazada.com.ph/shop/aceyourcourse"],
      [/^tiktok shop/i, "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop"],
    ] as const) {
      expect(link(footer, name)).toHaveAttribute("href", href);
      expect(link(footer, name)).toHaveAttribute("target", "_blank");
      expect(link(footer, name)).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("lists every Exam from the catalogue, linking to its Exam page", async () => {
    const footer = await renderFooter();
    const exams = within(footer).getByRole("list", { name: "Exams" });

    expect(
      within(exams)
        .getAllByRole("link")
        .map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["Civil Engineering", "/exams/ce"],
      ["Mechanical Engineering", "/exams/me"],
      ["Electrical Engineering", "/exams/ee"],
      ["Medical Technology", "/exams/mt"],
      ["Accountancy", "/exams/cpa"],
    ]);
  });

  it("has the Shop and Company links, with Reviews going to the Reviews page", async () => {
    const footer = await renderFooter();

    expect(link(footer, "All products")).toHaveAttribute("href", "/products");
    expect(link(footer, "Reviews")).toHaveAttribute("href", "/reviews");
    expect(link(footer, "Spot a fake copy")).toHaveAttribute("href", "/#authenticity");
    expect(link(footer, "About us")).toHaveAttribute("href", "/about");
    expect(link(footer, "FAQ")).toHaveAttribute("href", "/faq");
    expect(link(footer, "Privacy Policy")).toHaveAttribute("href", "/legal/privacy");
    expect(link(footer, "Terms of Use")).toHaveAttribute("href", "/legal/terms");
  });

  it("shows the one contact email from the settings", async () => {
    const footer = await renderFooter();
    expect(link(footer, "aceyourcourseinc@gmail.com")).toHaveAttribute(
      "href",
      "mailto:aceyourcourseinc@gmail.com",
    );
  });

  it("has the Follow links with their handles and the Shopee follower count", async () => {
    const footer = await renderFooter();

    expect(link(footer, /tiktok @aceyourcourse/i)).toHaveAttribute(
      "href",
      "https://www.tiktok.com/@aceyourcourse",
    );
    expect(link(footer, /facebook @aceyourcourseph/i)).toHaveAttribute(
      "href",
      "https://www.facebook.com/aceyourcourseph",
    );
    expect(link(footer, /instagram @aceyourcourseph/i)).toHaveAttribute(
      "href",
      "https://www.instagram.com/aceyourcourseph",
    );
    expect(link(footer, /shopee · 3\.7K followers/i)).toHaveAttribute(
      "href",
      "https://shopee.ph/aceyourcourse",
    );
  });

  it("shows the Manila year and the shop stats with their as-of date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 00:30 on Jan 1, 2027 in Manila, still Dec 31 in UTC.
    vi.setSystemTime(new Date("2026-12-31T16:30:00Z"));
    const footer = await renderFooter();

    expect(footer).toHaveTextContent(
      "© 2027 AceYourCourse · Registered with IPOPHIL. Unauthorized reproduction is prohibited.",
    );
    expect(footer).toHaveTextContent(
      "★ 4.8 · 874 ratings · as of Oct 2026 · Ships all over the Philippines",
    );
  });

  it("fires marketplace_click for a shop link, with no Product", async () => {
    const user = userEvent.setup();
    const footer = await renderFooter();

    await user.click(link(footer, /^tiktok shop/i));

    expect(posthog.capture).toHaveBeenCalledWith("marketplace_click", {
      marketplace: "tiktok",
      page: "/",
      link: "shop",
    });
  });

  it.each([undefined, "false"] as const)(
    "has no Member App link or promise while MEMBER_APP_LIVE is %s",
    async (memberAppLive) => {
      const footer = await renderFooter({ memberAppLive });

      expect(within(footer).queryByRole("link", { name: /sign in to the app/i })).toBeNull();
      expect(footer).not.toHaveTextContent(/in the app/i);
      const appLinks = within(footer)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("href")?.startsWith("/app"));
      expect(appLinks).toEqual([]);
    },
  );

  it("links Sign in to the app, and mentions the app, while the switch is on", async () => {
    const footer = await renderFooter({ memberAppLive: "true" });

    expect(link(footer, "Sign in to the app")).toHaveAttribute("href", "/app");
    expect(footer).toHaveTextContent("Digital reviewers in the app.");
  });

  it("hides a Marketplace or social item whose link is empty, leaving no empty anchor", async () => {
    const footer = await renderFooter({
      editSeed: (seed) => {
        seed.settings.shopLinks.lazada = null;
        seed.settings.shopLinks.shopee = null;
        seed.settings.socialLinks.facebook = null;
      },
    });

    expect(within(footer).queryByRole("link", { name: /lazada/i })).toBeNull();
    expect(within(footer).queryByRole("link", { name: /facebook/i })).toBeNull();
    // With no Shopee shop link, both Shopee items go, including the followers one.
    expect(within(footer).queryByRole("link", { name: /shopee/i })).toBeNull();
    expect(link(footer, /^tiktok shop/i)).toBeInTheDocument();
    expect(link(footer, /instagram/i)).toBeInTheDocument();
    for (const a of within(footer).getAllByRole("link")) {
      expect(a.getAttribute("href")).toBeTruthy();
      expect(a.textContent?.trim()).toBeTruthy();
    }
  });

  it("drops the Where to buy buttons when no Marketplace has a shop link", async () => {
    const footer = await renderFooter({
      editSeed: (seed) => {
        seed.settings.shopLinks = { shopee: null, lazada: null, tiktok: null };
      },
    });
    expect(within(footer).queryByRole("list", { name: "Marketplaces" })).toBeNull();
  });
});

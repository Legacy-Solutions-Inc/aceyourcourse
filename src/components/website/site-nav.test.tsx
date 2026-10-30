import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The nav is an async Server Component that reads the real Catalogue seam. Each
// test imports it fresh so the Member App switch (MEMBER_APP_LIVE) is re-read,
// exactly as a deploy with a different setting would.
vi.mock("next/navigation", () => ({ usePathname: () => "/products/ce-formula-flash-cards" }));

async function renderNav({ memberAppLive }: { memberAppLive?: "true" | "false" } = {}) {
  vi.stubEnv("MEMBER_APP_LIVE", memberAppLive);
  vi.resetModules();
  const { SiteNav } = await import("./site-nav");
  render(await SiteNav());
}

function appLinks() {
  return screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("/app"));
}

describe("SiteNav", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("links the logo to Home", async () => {
    await renderNav();
    expect(screen.getByRole("link", { name: "Ace Your Course" })).toHaveAttribute("href", "/");
  });

  it("links Products, Reviews, About and FAQ, marking the current page", async () => {
    await renderNav();
    const nav = screen.getByRole("navigation", { name: "Main" });

    for (const [name, href] of [
      ["Products", "/products"],
      ["Reviews", "/reviews"],
      ["About", "/about"],
      ["FAQ", "/faq"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(nav).toContainElement(screen.getByRole("link", { name: "Products" }));
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Reviews" })).not.toHaveAttribute("aria-current");
  });

  it("lists every Exam from the catalogue in the Exams menu", async () => {
    const user = userEvent.setup();
    await renderNav();

    await user.click(screen.getByRole("button", { name: /exams/i }));

    const examLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/exams/"));
    expect(examLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/exams/ce",
      "/exams/me",
      "/exams/ee",
      "/exams/mt",
      "/exams/cpa",
    ]);
    expect(screen.getByRole("link", { name: /MT.*Medical Technology.*MTLE/ })).toBeInTheDocument();
  });

  it.each([undefined, "false"] as const)(
    "shows no Member App link or message while MEMBER_APP_LIVE is %s",
    async (memberAppLive) => {
      vi.useFakeTimers();
      await renderNav({ memberAppLive });

      expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /start reviewing/i })).not.toBeInTheDocument();
      expect(appLinks()).toEqual([]);

      // The app message is second in the seed. With the switch off, the bar
      // rotates straight from the first message to the third.
      expect(screen.getByRole("link", { name: /physical copies/i })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(4500));
      expect(screen.getByRole("link", { name: /ships from iloilo city/i })).toBeInTheDocument();
      expect(screen.queryByText(/digital reviewers in the app/i)).not.toBeInTheDocument();
    },
  );

  it("links Sign in and Start reviewing to the Member App, and rotates in the app message, while the switch is on", async () => {
    vi.useFakeTimers();
    await renderNav({ memberAppLive: "true" });

    // Desktop and mobile each have a Sign in link (CSS shows one per width).
    const signIns = screen.getAllByRole("link", { name: "Sign in" });
    expect(signIns).toHaveLength(2);
    for (const signIn of signIns) expect(signIn).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: /start reviewing/i })).toHaveAttribute("href", "/app");

    act(() => vi.advanceTimersByTime(4500));
    expect(screen.getByRole("link", { name: /digital reviewers in the app/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  describe("for a Visitor who dismissed the announcement before launch", () => {
    beforeEach(() => {
      // The seed's announcement id, as the bar stores it on dismiss.
      window.localStorage.setItem("ayc.announcement.dismissed", "2026-10-launch");
    });

    afterEach(() => {
      window.localStorage.clear();
    });

    it("keeps it hidden while the switch is still off", async () => {
      await renderNav({ memberAppLive: "false" });
      expect(
        screen.queryByRole("button", { name: "Dismiss announcement" }),
      ).not.toBeInTheDocument();
    });

    it("shows it again once the switch turns on and the app message joins it", async () => {
      await renderNav({ memberAppLive: "true" });
      expect(screen.getByRole("button", { name: "Dismiss announcement" })).toBeInTheDocument();
    });
  });
});

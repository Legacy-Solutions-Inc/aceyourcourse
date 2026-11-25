import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RenewalBannerView } from "@/lib/member-app/renewal";

import { RenewalBanners } from "./renewal-banners";

// The renewal banners (Phase 4, ticket 12; spec, Phase 4 planning decisions →
// Renewal reminders; stories 141 and 142): one per Exam whose Access Pass
// ends within 7 days, on Home and that Exam's study screens, each leading to
// that Exam's Plans (or the "contact us" note while it has none on sale)
// and dismissible until the next Manila day, which the
// server keeps. Which banners show, and their words, are renewal.test.ts's.
const CE: RenewalBannerView = {
  examCode: "CE",
  text: "Your CE All-Access ends 22 Nov, 27 days before your exam",
  renew: { kind: "plans", label: "Renew to cover your exam", href: "/app/plans?exam=CE" },
};
const ME: RenewalBannerView = {
  examCode: "ME",
  text: "Your ME All-Access ends 20 Nov",
  renew: { kind: "plans", label: "Renew access", href: "/app/plans?exam=ME" },
};

function renderBanners(
  banners = [CE, ME],
  dismiss = vi.fn(async (_examCode: string) => ({ ok: true })),
) {
  const user = userEvent.setup();
  render(
    <main id="main">
      <h1>Home</h1>
      <RenewalBanners banners={banners} dismiss={dismiss} />
    </main>,
  );
  return { user, dismiss };
}

const region = () => screen.getByRole("region", { name: "Access ending soon" });
const dismissButton = (banner: RenewalBannerView) =>
  screen.getByRole("button", { name: `Dismiss: ${banner.text}` });

describe("RenewalBanners", () => {
  it("shows each Exam's banner, its renew link to that Exam's Plans, and its own Dismiss", () => {
    renderBanners();
    const [ce, me] = within(region()).getAllByRole("listitem");

    expect(ce).toHaveTextContent(CE.text);
    expect(within(ce!).getByRole("link", { name: "Renew to cover your exam" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
    expect(me).toHaveTextContent(ME.text);
    expect(within(me!).getByRole("link", { name: "Renew access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=ME",
    );
    expect(dismissButton(CE)).toBeInTheDocument();
    expect(dismissButton(ME)).toBeInTheDocument();
  });

  it("says to ask AYC, with no renew link, while the Exam has no Plan on sale", () => {
    renderBanners([{ ...CE, renew: { kind: "contact", contactEmail: "hello@example.com" } }]);
    const [ce] = within(region()).getAllByRole("listitem");

    expect(ce).toHaveTextContent(/During the beta, access comes from AYC\. Ask us at/);
    expect(within(ce!).getByRole("link", { name: "hello@example.com" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
    expect(within(ce!).queryByRole("link", { name: /Renew/ })).toBeNull();
  });

  it("shows nothing when no pass ends soon", () => {
    renderBanners([]);
    expect(screen.queryByRole("region", { name: "Access ending soon" })).toBeNull();
  });

  it("hides one Exam's banner at once when dismissed, tells the server which, and keeps the other", async () => {
    const { user, dismiss } = renderBanners();
    await user.click(dismissButton(CE));

    expect(screen.queryByText(CE.text)).toBeNull();
    expect(dismiss).toHaveBeenCalledWith("CE");
    expect(screen.getByText(ME.text)).toBeInTheDocument();
    expect(dismissButton(ME)).toHaveFocus();
  });

  it("moves focus to the screen's heading once the last banner is dismissed", async () => {
    const { user } = renderBanners([ME]);
    await user.click(dismissButton(ME));

    expect(screen.queryByRole("region", { name: "Access ending soon" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toHaveFocus();
  });

  it("brings a banner back, saying so, when the server can't be reached", async () => {
    const dismiss = vi.fn(async () => {
      throw new Error("offline");
    });
    const { user } = renderBanners([CE], dismiss);
    await user.click(dismissButton(CE));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t dismiss this. Try again.");
    expect(screen.getByText(CE.text)).toBeInTheDocument();
  });
});

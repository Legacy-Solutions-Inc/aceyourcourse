import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";

// The 403 screen's copy for each reason, the logged time, and the second button,
// which follows the Member App switch (MEMBER_APP_LIVE).
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

async function renderDenied(reason: string, { memberAppLive = false } = {}) {
  vi.stubEnv("MEMBER_APP_LIVE", memberAppLive ? "true" : "false");
  vi.resetModules();
  const { default: DeniedPage } = await import("./page");
  render(await DeniedPage({ searchParams: Promise.resolve({ reason }) }));
}

describe("403 screen", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("tells a User who isn't Staff, with the time the attempt was logged in Manila", async () => {
    jar.set("ayc_admin_sample", "juan.delacruz@gmail.com");
    const { recordDeniedSignIn } = await import("@/services/admin");
    await recordDeniedSignIn({
      email: "juan.delacruz@gmail.com",
      reason: "not-staff",
      at: new Date("2026-10-22T03:42:00Z"),
    });
    await renderDenied("not-staff");

    expect(screen.getByText("403 · NOT AUTHORISED")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This account can’t open the admin dashboard",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/which isn’t on the admin list\. Nothing was changed\./),
    ).toHaveTextContent(
      /^You’re signed in as juan\.delacruz@gmail\.com, which isn’t on the admin list/,
    );
    expect(screen.getByText("THIS ATTEMPT WAS LOGGED · 22 OCT 2026, 11:42 AM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use another account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the website" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Go to the member app" })).not.toBeInTheDocument();
  });

  it("offers the member app instead once the Member App switch is on", async () => {
    jar.set("ayc_admin_sample", "juan.delacruz@gmail.com");
    await renderDenied("not-staff", { memberAppLive: true });
    expect(screen.getByRole("link", { name: "Go to the member app" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(screen.queryByRole("link", { name: "Go to the website" })).not.toBeInTheDocument();
  });

  it("shows no logged time when no attempt was recorded", async () => {
    jar.set("ayc_admin_sample", "someone@example.com");
    await renderDenied("not-staff");
    expect(screen.getByText("someone@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/THIS ATTEMPT WAS LOGGED/)).not.toBeInTheDocument();
  });

  it("tells the expired Invite to ask an Owner to renew it", async () => {
    jar.set("ayc_admin_sample", "expired.invite@example.com");
    await renderDenied("invite-expired");
    expect(
      screen.getByText(/Your invite expired\. Ask an Owner to renew it\. Nothing was changed\./),
    ).toHaveTextContent(/^You’re signed in as expired\.invite@example\.com\./);
  });

  it("tells an Editor the page is for Owners only, with a way back", async () => {
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
    await renderDenied("owners-only");
    expect(screen.getByText("403 · OWNERS ONLY")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "This page is for Owners only" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/an Editor\. Only Owners can open this page\. Nothing was changed\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("button", { name: "Use another account" })).toBeInTheDocument();
  });
});

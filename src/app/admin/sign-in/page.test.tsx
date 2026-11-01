import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";

import SignInPage from "./page";

// The sign-in screen: Staff already signed in go straight on; anyone else sees
// "Continue with Google", which opens the sample "Sign in as" list.
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

const props = (next?: string) => ({ searchParams: Promise.resolve({ next }) });

describe("sign-in screen", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  it("shows the mockup's sign-in copy, with the five sample Users behind Continue with Google", async () => {
    const user = userEvent.setup();
    render(await SignInPage(props("/admin/products")));

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in to manage the site" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    const region = screen.getByRole("region", { name: "Sign in as" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(5);
    for (const input of region.querySelectorAll<HTMLInputElement>('input[name="next"]')) {
      expect(input.value).toBe("/admin/products");
    }
  });

  it("sends back an unsafe next as the Overview", async () => {
    render(await SignInPage(props("https://evil.example")));
    for (const input of document.querySelectorAll<HTMLInputElement>('input[name="next"]')) {
      expect(input.value).toBe("/admin");
    }
  });

  it("sends Staff who are already signed in straight to next", async () => {
    jar.set("ayc_admin_sample", "angel@aceyourcourse.ph");
    await expect(SignInPage(props("/admin/reviews"))).rejects.toThrow(
      "NEXT_REDIRECT /admin/reviews",
    );
  });

  it("still shows sign-in to a signed-in User who isn't Staff", async () => {
    jar.set("ayc_admin_sample", "juan.delacruz@gmail.com");
    render(await SignInPage(props()));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });
});

describe("sign-in screen (closed mode)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("answers 404 and offers no sample Users", async () => {
    // config.ts warns that production has no Supabase; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: ClosedSignInPage } = await import("./page");
    const { listSampleUsers } = await import("@/lib/admin/identity");

    await expect(ClosedSignInPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listSampleUsers()).toEqual([]);
  });
});

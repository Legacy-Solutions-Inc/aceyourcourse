import { afterEach, describe, expect, it, vi } from "vitest";

// Every Admin screen is noindex, and closed mode answers 404 for all of them.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("Admin layout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("keeps every Admin screen out of search engines", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders its screens in sample mode", async () => {
    const { default: AdminLayout } = await import("./layout");
    const screen = <p>Screen</p>;
    expect(AdminLayout({ children: screen })).toBe(screen);
  });

  it("answers 404 in closed mode", async () => {
    // config.ts warns that production has no Supabase; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: AdminLayout } = await import("./layout");
    expect(() => AdminLayout({ children: <p>Screen</p> })).toThrow("NEXT_NOT_FOUND");
  });
});

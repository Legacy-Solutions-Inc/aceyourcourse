import { describe, expect, it, vi } from "vitest";

import LegalIndexPage from "./page";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

describe("/legal", () => {
  it("redirects to the Privacy Policy", () => {
    expect(() => LegalIndexPage()).toThrow("NEXT_REDIRECT /legal/privacy");
    expect(redirect).toHaveBeenCalledWith("/legal/privacy");
  });
});

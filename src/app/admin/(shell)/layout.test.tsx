import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPaidToday } from "@/services/admin";
import { resetSampleStore } from "@/services/mock/sample-store";

import AdminShellLayout from "./layout";

// The signed-in Admin shell's sidebar card (Phase 4, ticket 11; BUILD-MAP §2):
// an Owner's sidebar has "PAID TODAY" opening Orders; an Editor's has none,
// as the seam gives them none. Rendered from the sample data, whose plain
// reset has no Orders. The cookie jar is the framework boundary.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ refresh: () => {} }),
}));
// The seam's own card read, which one test makes fail as a database outage would.
vi.mock("@/services/admin", async (importOriginal) => {
  const seam = await importOriginal<typeof import("@/services/admin")>();
  return { ...seam, getPaidToday: vi.fn(seam.getPaidToday) };
});

// 10:00 Manila on Wednesday 25 Nov 2026.
const NOW = new Date("2026-11-25T02:00:00Z");

async function renderShell(email: string) {
  jar.set("ayc_admin_sample", email);
  render(await AdminShellLayout({ children: <p>Screen</p> }));
}

describe("Admin shell: the PAID TODAY card", () => {
  beforeEach(() => {
    jar.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetSampleStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows an Owner today's money, Orders and Pending, opening Orders", async () => {
    await renderShell("angel@aceyourcourse.ph");

    const card = screen.getByRole("link", { name: /^PAID TODAY/ });
    expect(card).toHaveTextContent(/^PAID TODAY25 NOV₱00 orders · 0 pending$/);
    expect(card).toHaveAttribute("href", "/admin/orders");
  });

  it("leaves the card out, logged, when it can't be read, and still shows the screen", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPaidToday).mockRejectedValueOnce(new Error("The database is down."));

    await renderShell("angel@aceyourcourse.ph");

    expect(screen.getByText("Screen")).toBeInTheDocument();
    expect(screen.queryByText("PAID TODAY")).not.toBeInTheDocument();
    expect(logged).toHaveBeenCalledWith(
      "Couldn't read the sidebar's PAID TODAY card; leaving it out:",
      expect.any(Error),
    );
  });

  it("shows an Editor no card", async () => {
    await renderShell("content@aceyourcourse.ph");

    expect(screen.getByText("Screen")).toBeInTheDocument();
    expect(screen.queryByText("PAID TODAY")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffActivity } from "@/services/admin.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import StaffActivityPage from "./page";

// Staff Activity under Settings (Phase 4, ticket 15): Owners only, on the
// server; the page calls the Staff Guard itself. The cookie jar and
// redirect() are the framework boundary, so they're replaced; the sample
// data is the seam.
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
  usePathname: () => "/admin/settings/activity",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const activityPage = (params: Record<string, string> = {}) =>
  StaffActivityPage({ searchParams: Promise.resolve(params) });

function record(index: number, fields: Partial<StaffActivity> = {}): StaffActivity {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    at: new Date(Date.UTC(2026, 10, 25, 2, index)).toISOString(),
    actor: { email: OWNER, name: "Angel Rose L. Lepaña" },
    entity: "plan",
    entityId: `plan-${index}`,
    action: "update",
    before: { price: 499 },
    after: { price: 599 },
    ...fields,
  };
}

beforeEach(() => {
  jar.clear();
  resetSampleStore(CATALOGUE_SEED);
});

describe("the Staff Activity page", () => {
  it("shows an Owner the records, newest first, under Settings", async () => {
    getSampleStore().staffActivity = [
      record(1),
      record(2, {
        actor: { email: "system:paymongo", name: "PayMongo (system)" },
        entity: "order",
        entityId: "AYC-10001",
        action: "paid",
      }),
    ];
    signInAs(OWNER);
    render(await activityPage());

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "STAFF ACTIVITY" })).toBeInTheDocument();
    const [top, next] = screen.getByRole("list", { name: "Staff Activity" }).children;
    expect(top).toHaveTextContent("PayMongo (system)");
    expect(top).toHaveTextContent("paid · order AYC-10001");
    expect(next).toHaveTextContent("Angel Rose L. Lepaña");
  });

  it("filters by Staff member from the URL", async () => {
    getSampleStore().staffActivity = [
      record(1),
      record(2, { actor: { email: "system:paymongo", name: "PayMongo (system)" } }),
    ];
    signInAs(OWNER);
    render(await activityPage({ actor: "system:paymongo" }));
    const items = screen.getByRole("list", { name: "Staff Activity" }).children;
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("PayMongo (system)");
  });

  it("says No activity before anything is recorded", async () => {
    signInAs(OWNER);
    render(await activityPage());
    expect(screen.getByText("No activity")).toBeInTheDocument();
  });

  it.each<Record<string, string>>([
    { before: "not-a-cursor" },
    { before: "-1" },
    { actor: "nobody@example.com", area: "<script>" },
  ])("handles tampered params %j without failing", async (params) => {
    getSampleStore().staffActivity = [record(1)];
    signInAs(OWNER);
    render(await activityPage(params));
    if ("before" in params) {
      expect(screen.getByRole("list", { name: "Staff Activity" }).children).toHaveLength(1);
    } else {
      expect(screen.getByText("No activity")).toBeInTheDocument();
    }
  });

  it("sends an Editor to the 403 screen, before anything is read", async () => {
    getSampleStore().staffActivity = [record(1)];
    signInAs(EDITOR);
    await expect(activityPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=owners-only");
  });

  it("sends a signed-out visitor to sign in, coming back here with the filters", async () => {
    await expect(activityPage({ area: "plans" })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/settings/activity?area=plans")}`,
    );
  });
});

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSampleStore } from "@/services/mock/sample-store";
import { samplePlanId } from "@/services/mock/plans";

import PlansPage from "./page";

// Plans & prices (Phase 4, ticket 01): Owners only, on the server. The page
// calls the Staff Guard itself. The cookie jar and redirect() are the
// framework boundary, so they're replaced; the sample data is the seam.
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
  usePathname: () => "/admin/plans",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const plansPage = (params: Record<string, string> = {}) =>
  PlansPage({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("Plans & prices", () => {
  it("shows an Owner the starting Plans, under the SALES group, with + New plan", async () => {
    signInAs(OWNER);
    render(await plansPage());

    expect(screen.getByRole("heading", { name: "Plans & prices" })).toBeInTheDocument();
    expect(screen.getByText("SALES")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New plan" })).toHaveAttribute(
      "href",
      "/admin/plans?plan=new",
    );
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(7);
    expect(screen.getByRole("complementary", { name: "Plan editor" })).toHaveTextContent(
      "Select a plan",
    );
  });

  it("opens the selected Plan's editor, keeping the Exam chip", async () => {
    signInAs(OWNER);
    render(await plansPage({ exam: "ce", plan: samplePlanId("CE", 90) }));

    expect(screen.getByText("EDIT PLAN")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "PRICE · WHOLE PESOS" })).toHaveValue("1,299");
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(3);
  });

  it("ignores an Exam chip that isn't an Exam", async () => {
    signInAs(OWNER);
    render(await plansPage({ exam: "xyz" }));
    expect(screen.getByRole("link", { name: "ALL" })).toHaveAttribute("aria-current", "true");
  });

  it("sends a signed-out visitor to sign-in, coming back to the same Plan", async () => {
    await expect(plansPage({ exam: "ce", plan: "new" })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/plans?exam=ce&plan=new")}`,
    );
  });

  it("refuses an Editor", async () => {
    signInAs(EDITOR);
    await expect(plansPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=owners-only");
  });
});

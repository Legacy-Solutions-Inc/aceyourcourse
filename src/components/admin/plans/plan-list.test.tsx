import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminPlan, AdminPlans } from "@/services/admin.types";

import { PlanList } from "./plan-list";

// The Plans & prices list (Phase 4, ticket 01; BUILD-MAP §3.8, mockup
// 591–606): Exam chips, then each Plan with its period, price, per-month
// figure, BEST VALUE tag and On sale switch, which saves at once. The router
// is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const STAMP = { savedAt: "2026-11-24T02:00:00.000Z", savedBy: null };
const plan = (
  id: string,
  examCode: string,
  days: AdminPlan["days"],
  priceCentavos: number,
  extra: Partial<AdminPlan> = {},
): AdminPlan => ({
  id,
  examCode,
  name: `${examCode} All-Access`,
  days,
  priceCentavos,
  bestValue: false,
  onSale: true,
  stamp: STAMP,
  ...extra,
});

const PLANS: AdminPlans = {
  exams: [
    { code: "CE", name: "Civil Engineering" },
    { code: "ME", name: "Mechanical Engineering" },
    { code: "EE", name: "Electrical Engineering" },
  ],
  plans: [
    plan("ce30", "CE", 30, 49_900),
    plan("ce90", "CE", 90, 129_900, { bestValue: true }),
    plan("ce180", "CE", 180, 229_900, { onSale: false }),
    plan("me30", "ME", 30, 44_900),
  ],
};

type Submission = { input: unknown; expected?: { savedAt: string } };

function renderList(
  examChip: string | null = null,
  answer: AdminActionState<AdminPlan> = { status: "saved", value: PLANS.plans[0]! },
) {
  const setOnSale = vi.fn(async (_previous: unknown, _submission: Submission) => answer);
  const user = userEvent.setup();
  render(
    <>
      <PlanList plans={PLANS} examChip={examChip} selected="ce90" setOnSale={setOnSale} />
      <Toaster />
    </>,
  );
  return { user, setOnSale };
}

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  router.refresh.mockClear();
});

describe("PlanList", () => {
  it("lists every Plan with its period, price and per-month figure, under ALL", () => {
    renderList();

    expect(screen.getByRole("columnheader", { name: "PLANS · 4" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringMatching(/CE All-Access.*for 30 days.*1 month.*₱499/),
      expect.stringMatching(/CE All-Access.*BEST VALUE.*₱433 \/ month.*3 months.*₱1,299/),
      expect.stringMatching(/CE All-Access.*NOT ON SALE.*₱383 \/ month.*6 months.*₱2,299/),
      expect.stringMatching(/ME All-Access.*for 30 days.*1 month.*₱449/),
    ]);
    expect(
      screen.getByText(
        "PAID THROUGH PAYMONGO · MEMBERS RENEW THEMSELVES · NOTHING RENEWS AUTOMATICALLY",
      ),
    ).toBeInTheDocument();
  });

  it("links each Plan to its editor, keeping the chip, and marks the selected one", () => {
    renderList("CE");

    const ninety = screen.getByRole("link", { name: /CE All-Access.*3 months/ });
    expect(ninety).toHaveAttribute("href", "/admin/plans?exam=ce&plan=ce90");
    expect(ninety).toHaveAttribute("aria-current", "true");
  });

  it("offers a chip for ALL and each Exam, and shows only the chip's Plans", () => {
    renderList("ME");

    const chips = within(screen.getByRole("group", { name: "Exam" })).getAllByRole("link");
    expect(chips.map((chip) => chip.textContent)).toEqual(["ALL", "CE", "ME", "EE"]);
    expect(screen.getByRole("link", { name: "ME" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "ALL" })).toHaveAttribute("href", "/admin/plans");
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "PLANS · 1" })).toBeInTheDocument();
  });

  it("says when the chip's Exam has no Plans", () => {
    renderList("EE");
    expect(screen.getByText("No plans for EE yet. Add one with + New plan.")).toBeInTheDocument();
  });

  it("switches a Plan off at once, with no conflict check, then reads the page again", async () => {
    const { user, setOnSale } = renderList();
    const toggle = screen.getByRole("switch", { name: "On sale: CE All-Access · 1 month" });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(setOnSale.mock.calls[0]?.[1]).toEqual({ input: { id: "ce30", onSale: false } });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says why switching one on was refused", async () => {
    const message =
      "CE already has a 6 months Plan on sale: “CE Promo”. Switch that one off first.";
    const { user } = renderList(null, {
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: message },
    });

    await user.click(screen.getByRole("switch", { name: "On sale: CE All-Access · 6 months" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

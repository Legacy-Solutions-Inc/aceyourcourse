import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminPlan } from "@/services/admin.types";

import type { PlanEditorActions } from "./plan-editor";
import { PlanPanel } from "./plan-panel";

// The Plans & prices screen's right-hand panel (Phase 4, ticket 01): the
// selected Plan's editor, a new Plan's, or a prompt to pick one. A Plan just
// added opens in its own editor, at its own address. The router is the
// framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const EXAMS = [
  { code: "CE", name: "Civil Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
];
const ADDED: AdminPlan = {
  id: "5d2c1b0a-9e8f-4d7c-8b6a-5f4e3d2c1b0a",
  examCode: "ME",
  name: "ME All-Access",
  days: 30,
  priceCentavos: 44_900,
  bestValue: false,
  onSale: false,
  stamp: { savedAt: "2026-11-24T02:10:00.000Z", savedBy: "Angel" },
};

function actions(): PlanEditorActions {
  const notCalled = async (): Promise<never> => {
    throw new Error("not called");
  };
  return {
    add: vi.fn(async () => ({ status: "saved" as const, value: ADDED })),
    save: notCalled,
    remove: notCalled,
  };
}

describe("PlanPanel", () => {
  it("asks for a Plan to be picked when none is selected", () => {
    render(
      <PlanPanel selected={null} opened={null} exams={EXAMS} examChip={null} actions={actions()} />,
    );
    expect(screen.getByRole("complementary", { name: "Plan editor" })).toHaveTextContent(
      "Select a plan",
    );
  });

  it("says a Plan that isn't there any more is gone", () => {
    render(
      <PlanPanel selected="gone" opened={null} exams={EXAMS} examChip={null} actions={actions()} />,
    );
    expect(screen.getByText("That plan isn’t here any more.")).toBeInTheDocument();
  });

  it("opens a new Plan on the chip's Exam, then its own editor once added", async () => {
    const user = userEvent.setup();
    render(
      <PlanPanel selected="new" opened={null} exams={EXAMS} examChip="ME" actions={actions()} />,
    );

    expect(screen.getByRole("combobox", { name: "EXAM" })).toHaveDisplayValue(
      "ME · Mechanical Engineering",
    );
    await user.type(screen.getByRole("textbox", { name: "PRICE · WHOLE PESOS" }), "449");
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(router.replace).toHaveBeenCalledWith(`/admin/plans?exam=me&plan=${ADDED.id}`, {
      scroll: false,
    });
  });
});

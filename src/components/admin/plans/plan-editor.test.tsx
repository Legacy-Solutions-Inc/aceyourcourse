import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import { PLAN_HAS_ORDERS } from "@/services/plans.core";
import type { AdminPlan, Plan } from "@/services/admin.types";

import { EditPlan, NewPlan, type PlanEditorActions } from "./plan-editor";

// The Plans & prices editor (Phase 4, ticket 01; BUILD-MAP §3.8), saving
// through stub Server Actions that answer as adminAction would. The router is
// the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const OPENED_AT = "2026-11-24T02:00:00.000Z";
const SAVED_AT = "2026-11-24T02:10:00.000Z";
const EXAMS = [
  { code: "CE", name: "Civil Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
];

const CE_90: AdminPlan = {
  id: "0b8f2c4e-1d3a-4f5b-9c6d-7e8f9a0b1c2d",
  examCode: "CE",
  name: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  bestValue: true,
  onSale: true,
  stamp: { savedAt: OPENED_AT, savedBy: null },
};

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

function actionsWith(actions: Partial<PlanEditorActions> = {}): PlanEditorActions {
  return {
    add: answering<AdminPlan>(),
    save: answering<AdminPlan>(),
    remove: answering<Plan>(),
    ...actions,
  };
}

const field = (name: string) => screen.getByRole("textbox", { name });
const select = (name: string) => screen.getByRole("combobox", { name });
const status = () => screen.getByRole("status");
const preview = () => screen.getByRole("region", { name: "PREVIEW · MEMBER PLANS PAGE" });
/** What the browser sent the Server Action, on its first call. */
const sent = (action: { mock: { calls: [unknown, Submission][] } }) => action.mock.calls[0]?.[1];

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("NewPlan", () => {
  function renderNew(actions: Partial<PlanEditorActions> = {}, onAdded = vi.fn()) {
    const user = userEvent.setup();
    render(
      <>
        <NewPlan exams={EXAMS} examCode="CE" actions={actionsWith(actions)} onAdded={onAdded} />
        <Toaster />
      </>,
    );
    return { user, onAdded };
  }

  it("opens a 30-day Plan for the Exam, named after it, off sale, with the editor's notes", () => {
    renderNew();

    expect(screen.getByText("NEW PLAN")).toBeInTheDocument();
    expect(field("PLAN NAME")).toHaveValue("CE All-Access");
    expect(select("EXAM")).toHaveDisplayValue("CE · Civil Engineering");
    expect(select("ACCESS PERIOD")).toHaveDisplayValue("1 month · 30 days");
    expect(
      within(select("ACCESS PERIOD"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "1 month · 30 days",
      "3 months · 90 days",
      "6 months · 180 days",
      "12 months · 365 days",
    ]);
    expect(field("PRICE · WHOLE PESOS")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Mark as best value" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "On sale" })).not.toBeChecked();
    expect(
      screen.getByText("Off hides it from Plans. Current buyers keep access."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Price changes apply to new purchases only. Members who already paid keep what they bought.",
      ),
    ).toBeInTheDocument();
    expect(within(preview()).getByText("for 30 days")).toBeInTheDocument();
  });

  it("previews a 365-day CE Plan with its per-month figure as it's typed", async () => {
    const { user } = renderNew();

    await user.selectOptions(select("ACCESS PERIOD"), "12 months · 365 days");
    await user.type(field("PRICE · WHOLE PESOS"), "3,999");

    const card = preview();
    expect(within(card).getByText("CE · 12 MONTHS")).toBeInTheDocument();
    expect(within(card).getByText("CE All-Access")).toBeInTheDocument();
    expect(within(card).getByText("₱3,999")).toBeInTheDocument();
    expect(within(card).getByText("₱333 / month")).toBeInTheDocument();
    expect(
      within(card).getByText("DOESN’T RENEW AUTOMATICALLY · PAID THROUGH PAYMONGO"),
    ).toBeInTheDocument();
    expect(within(card).queryByText("BEST VALUE")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Mark as best value" }));
    expect(within(card).getByText("BEST VALUE")).toBeInTheDocument();
  });

  it("renames a new Plan after the Exam picked, while it has the default name", async () => {
    const { user } = renderNew();

    await user.selectOptions(select("EXAM"), "ME · Mechanical Engineering");

    expect(field("PLAN NAME")).toHaveValue("ME All-Access");
    expect(within(preview()).getByText("ME · 1 MONTH")).toBeInTheDocument();
  });

  it("adds the Plan with the form's values, then hands over what was saved", async () => {
    const added: AdminPlan = {
      ...CE_90,
      id: "5d2c1b0a-9e8f-4d7c-8b6a-5f4e3d2c1b0a",
      days: 365,
      priceCentavos: 399_900,
      bestValue: false,
      stamp: { savedAt: SAVED_AT, savedBy: "Angel" },
    };
    const add = answering<AdminPlan>({ status: "saved", value: added });
    const { user, onAdded } = renderNew({ add });

    await user.selectOptions(select("ACCESS PERIOD"), "12 months · 365 days");
    await user.type(field("PRICE · WHOLE PESOS"), "3,999");
    await user.click(screen.getByRole("switch", { name: "On sale" }));
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(sent(add)).toEqual({
      input: {
        name: "CE All-Access",
        examCode: "CE",
        days: "365",
        price: "3,999",
        bestValue: false,
        onSale: true,
      },
      expected: { savedAt: expect.any(String) },
    });
    expect(onAdded).toHaveBeenCalledWith(added);
  });

  it("shows each refused field's message, and keeps the edits", async () => {
    const add = answering<AdminPlan>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { price: ["USE WHOLE PESOS · NO CENTAVOS"] } },
    });
    const { user, onAdded } = renderNew({ add });

    await user.type(field("PRICE · WHOLE PESOS"), "499.50");
    await user.click(screen.getByRole("button", { name: "Add plan" }));

    expect(await screen.findByText("USE WHOLE PESOS · NO CENTAVOS")).toBeInTheDocument();
    expect(field("PRICE · WHOLE PESOS")).toHaveAttribute("aria-invalid", "true");
    expect(field("PRICE · WHOLE PESOS")).toHaveValue("499.50");
    expect(status()).toHaveTextContent("FIX THE FIELDS MARKED IN RED");
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe("EditPlan", () => {
  function renderEdit(actions: Partial<PlanEditorActions> = {}) {
    const user = userEvent.setup();
    render(
      <>
        <EditPlan opened={CE_90} exams={EXAMS} examChip="CE" actions={actionsWith(actions)} />
        <Toaster />
      </>,
    );
    return user;
  }

  it("opens with the Plan's fields and its preview", () => {
    renderEdit();

    expect(screen.getByText("EDIT PLAN")).toBeInTheDocument();
    expect(field("PLAN NAME")).toHaveValue("CE All-Access");
    expect(select("ACCESS PERIOD")).toHaveDisplayValue("3 months · 90 days");
    expect(field("PRICE · WHOLE PESOS")).toHaveValue("1,299");
    expect(screen.getByRole("switch", { name: "Mark as best value" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "On sale" })).toBeChecked();
    const card = preview();
    expect(within(card).getByText("BEST VALUE")).toBeInTheDocument();
    expect(within(card).getByText("CE · 3 MONTHS")).toBeInTheDocument();
    expect(within(card).getByText("₱433 / month")).toBeInTheDocument();
  });

  it("saves against the stamp it opened with, then reads the list again", async () => {
    const save = answering<AdminPlan>({
      status: "saved",
      value: { ...CE_90, priceCentavos: 139_900, stamp: { savedAt: SAVED_AT, savedBy: "Angel" } },
    });
    const user = renderEdit({ save });

    await user.clear(field("PRICE · WHOLE PESOS"));
    await user.type(field("PRICE · WHOLE PESOS"), "1,399");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(sent(save)).toEqual({
      input: {
        id: CE_90.id,
        name: "CE All-Access",
        examCode: "CE",
        days: "90",
        price: "1,399",
        bestValue: true,
        onSale: true,
      },
      expected: { savedAt: OPENED_AT },
    });
    expect(status()).toHaveTextContent("✓ SAVED · LIVE ON THE PLANS PAGE");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says who saved first when the edit is stale, keeping the edits", async () => {
    const save = answering<AdminPlan>({
      status: "refused",
      error: { kind: "conflict", savedBy: "AYC Owner Two", savedAt: SAVED_AT },
    });
    const user = renderEdit({ save });

    await user.clear(field("PLAN NAME"));
    await user.type(field("PLAN NAME"), "CE Quarter");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
    expect(screen.getByRole("alert")).toHaveTextContent("AYC Owner Two saved this Plan");
    expect(field("PLAN NAME")).toHaveValue("CE Quarter");
  });

  it("says why a second Plan on sale was refused", async () => {
    const message =
      "CE already has a 3 months Plan on sale: “CE Promo”. Switch that one off first.";
    const save = answering<AdminPlan>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: message },
    });
    const user = renderEdit({ save });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(status()).toHaveTextContent(message);
  });

  it("deletes the Plan once confirmed, then goes back to the list", async () => {
    const remove = answering<Plan>({ status: "saved", value: CE_90 });
    const user = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete plan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete plan" }));

    expect(sent(remove)).toEqual({ input: { id: CE_90.id } });
    expect(router.replace).toHaveBeenCalledWith("/admin/plans?exam=ce", { scroll: false });
  });

  it("says a Plan with Orders can't be deleted", async () => {
    const remove = answering<Plan>({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: PLAN_HAS_ORDERS },
    });
    const user = renderEdit({ remove });

    await user.click(screen.getByRole("button", { name: "Delete plan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete plan" }));

    expect(await within(dialog).findByText(PLAN_HAS_ORDERS)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

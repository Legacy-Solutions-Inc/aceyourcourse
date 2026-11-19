import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AccessPassChange, AdminAccessPass } from "@/services/admin.types";

import { AccessPasses, type PassActions } from "./access-passes";

// ACCESS PASSES on a Member's detail page (ticket 17; stories 131 and 133j;
// BUILD-MAP §3.10's "Extend access…" and "Grant a plan…" panels): each pass
// with its grants, "Extend…" and, while it's active, "End access now…", and
// "Grant Access Pass…" under them. Each asks for a reason Staff Activity
// keeps. No payment is collected, and the Member gets an in-app notice, not an
// email. The Server Actions are the boundary, so they're replaced; the panel
// shows what they answer and reads the page again.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const NOW = new Date("2026-11-19T03:42:00.000Z");
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  name: "Bea Tester",
  email: "tester@example.com",
};
const EXAMS = [
  { code: "CE", name: "Civil Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
];
const ACTIVE: AdminAccessPass = { examCode: "CE", endsAt: "2027-02-15T03:42:00.000Z", grants: [] };
const ENDED: AdminAccessPass = { examCode: "ME", endsAt: "2026-11-14T03:42:00.000Z", grants: [] };

const CHANGE: AccessPassChange = {
  userId: BEA.userId,
  examCode: "CE",
  endsBefore: null,
  endsAt: "2026-12-19T03:42:00.000Z",
  days: 30,
  reason: "Beta tester",
  targetExam: null,
};

type State = AdminActionState<AccessPassChange>;

function renderPanel({
  passes = [ACTIVE, ENDED],
  answer = { status: "saved", value: CHANGE } as State,
} = {}) {
  const answering = () => vi.fn(async (): Promise<State> => answer);
  const actions = { grant: answering(), extend: answering(), end: answering() };
  const user = userEvent.setup();
  render(
    <AccessPasses
      member={BEA}
      passes={passes}
      exams={EXAMS}
      now={NOW}
      actions={actions satisfies PassActions}
    />,
  );
  return { user, actions };
}

const section = () => screen.getByRole("region", { name: "ACCESS PASSES" });
const row = (code: string) => within(section()).getByRole("listitem", { name: `${code} pass` });
const dialog = () => screen.getByRole("dialog");
const reasonField = () => within(dialog()).getByLabelText("REASON · SAVED IN STAFF ACTIVITY");
const status = () => within(section()).getByRole("status");

describe("AccessPasses", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("offers Extend on every pass, and End access now only on an active one", () => {
    renderPanel();
    expect(within(row("CE")).getByRole("button", { name: "Extend…" })).toBeInTheDocument();
    expect(within(row("CE")).getByRole("button", { name: "End access now…" })).toBeInTheDocument();
    expect(within(row("ME")).getByRole("button", { name: "Extend…" })).toBeInTheDocument();
    expect(within(row("ME")).queryByRole("button", { name: "End access now…" })).toBeNull();
  });

  it("says a Member with no pass sees Free Preview only, and still offers a grant", () => {
    renderPanel({ passes: [] });
    expect(section()).toHaveTextContent("No Access Pass. They see Free Preview content only.");
    expect(screen.getByRole("button", { name: "Grant Access Pass…" })).toBeInTheDocument();
  });

  describe("Grant Access Pass", () => {
    it("asks for an Exam, the days and a reason, and says no payment or email goes out", async () => {
      const { user, actions } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));

      expect(dialog()).toHaveAccessibleName("Grant Bea an Access Pass");
      expect(dialog()).toHaveTextContent("No payment is collected.");
      expect(dialog()).toHaveTextContent("in-app notice");
      expect(dialog()).not.toHaveTextContent(/email/i);
      const exam = within(dialog()).getByRole("combobox", { name: "EXAM" });
      expect(
        within(exam)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual(["CE · Civil Engineering", "ME · Mechanical Engineering"]);
      const days = within(dialog()).getByRole("group", { name: "DAYS" });
      expect(within(days).getAllByRole("radio")).toHaveLength(5);
      for (const name of ["30 days", "90 days", "180 days", "365 days", "Custom"]) {
        expect(within(days).getByRole("radio", { name })).toBeInTheDocument();
      }
      expect(within(days).getByRole("radio", { name: "30 days" })).toBeChecked();
      expect(actions.grant).not.toHaveBeenCalled();
    });

    it("sends the Exam, the days and the reason, then says what was granted", async () => {
      const { user, actions } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));
      await user.selectOptions(within(dialog()).getByRole("combobox", { name: "EXAM" }), "ME");
      await user.click(within(dialog()).getByRole("radio", { name: "90 days" }));
      await user.type(reasonField(), "Beta tester");
      await user.click(within(dialog()).getByRole("button", { name: "Grant access" }));

      expect(actions.grant).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { userId: BEA.userId, examCode: "ME", days: 90, reason: "Beta tester" } },
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent("✓ GRANTED CE UNTIL 19 DEC 2026 · NO PAYMENT COLLECTED");
      expect(refresh).toHaveBeenCalled();
    });

    it("sends a custom number of days as typed", async () => {
      const { user, actions } = renderPanel();
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));
      await user.click(within(dialog()).getByRole("radio", { name: "Custom" }));
      await user.type(within(dialog()).getByLabelText("CUSTOM DAYS · 1 TO 365"), "45");
      await user.type(reasonField(), "Beta");
      await user.click(within(dialog()).getByRole("button", { name: "Grant access" }));

      expect(actions.grant).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { userId: BEA.userId, examCode: "CE", days: "45", reason: "Beta" } },
      );
    });

    it("shows a refused field's message next to it, keeping the dialog open", async () => {
      const { user } = renderPanel({
        answer: {
          status: "refused",
          error: {
            kind: "invalid",
            fieldErrors: {
              days: ["GRANT 1 TO 365 WHOLE DAYS"],
              reason: ["ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY"],
            },
          },
        },
      });
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));
      await user.click(within(dialog()).getByRole("radio", { name: "Custom" }));
      await user.type(within(dialog()).getByLabelText("CUSTOM DAYS · 1 TO 365"), "366");
      await user.click(within(dialog()).getByRole("button", { name: "Grant access" }));

      expect(dialog()).toHaveTextContent("GRANT 1 TO 365 WHOLE DAYS");
      expect(reasonField()).toHaveAccessibleDescription(
        "ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY",
      );
    });

    it("says the server couldn't be reached, keeping the dialog open", async () => {
      const { user } = renderPanel({ answer: { status: "failed" } });
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));
      await user.type(reasonField(), "Beta");
      await user.click(within(dialog()).getByRole("button", { name: "Grant access" }));

      expect(within(dialog()).getByRole("alert")).toHaveTextContent(
        "Couldn’t reach the server, so nothing was changed.",
      );
    });

    it("says an Editor was refused", async () => {
      const { user } = renderPanel({
        answer: {
          status: "refused",
          error: { kind: "forbidden", message: "ONLY AN OWNER CAN GRANT, EXTEND OR END ACCESS" },
        },
      });
      await user.click(screen.getByRole("button", { name: "Grant Access Pass…" }));
      await user.type(reasonField(), "Beta");
      await user.click(within(dialog()).getByRole("button", { name: "Grant access" }));

      expect(status()).toHaveTextContent("ONLY AN OWNER CAN GRANT, EXTEND OR END ACCESS");
    });
  });

  describe("Extend", () => {
    it("adds 3, 7, 14 or 30 days to that pass, with a reason", async () => {
      const { user, actions } = renderPanel({
        answer: { status: "saved", value: { ...CHANGE, days: 14 } },
      });
      await user.click(within(row("CE")).getByRole("button", { name: "Extend…" }));

      expect(dialog()).toHaveAccessibleName("Add days to Bea’s CE pass");
      const days = within(dialog()).getByRole("group", { name: "DAYS TO ADD" });
      expect(within(days).getAllByRole("radio")).toHaveLength(4);
      await user.click(within(days).getByRole("radio", { name: "14 days" }));
      await user.type(reasonField(), "Payment confirmed late");
      await user.click(within(dialog()).getByRole("button", { name: "Add days" }));

      expect(actions.extend).toHaveBeenCalledWith(
        { status: "idle" },
        {
          input: { userId: BEA.userId, examCode: "CE", days: 14, reason: "Payment confirmed late" },
        },
      );
      expect(status()).toHaveTextContent("✓ ADDED 14 DAYS · CE UNTIL 19 DEC 2026");
    });

    it("says why the server refused, such as no pass to extend", async () => {
      const { user } = renderPanel({
        answer: {
          status: "refused",
          error: {
            kind: "invalid",
            fieldErrors: {},
            formError: "This Member has no CE Access Pass to extend. Grant one instead.",
          },
        },
      });
      await user.click(within(row("CE")).getByRole("button", { name: "Extend…" }));
      await user.type(reasonField(), "Late");
      await user.click(within(dialog()).getByRole("button", { name: "Add days" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent("no CE Access Pass to extend");
    });
  });

  describe("End access now", () => {
    it("asks first, then ends that pass with a reason", async () => {
      const { user, actions } = renderPanel({
        answer: { status: "saved", value: { ...CHANGE, days: null } },
      });
      await user.click(within(row("CE")).getByRole("button", { name: "End access now…" }));

      expect(dialog()).toHaveAccessibleName("End Bea’s CE access now?");
      expect(dialog()).toHaveTextContent("Their progress stays");
      await user.type(reasonField(), "Granted by mistake");
      await user.click(within(dialog()).getByRole("button", { name: "End access now" }));

      expect(actions.end).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { userId: BEA.userId, examCode: "CE", reason: "Granted by mistake" } },
      );
      expect(status()).toHaveTextContent("✓ ENDED CE ACCESS · THEY SEE THE EXPIRED STATE");
    });

    it("sends nothing when cancelled", async () => {
      const { user, actions } = renderPanel();
      await user.click(within(row("CE")).getByRole("button", { name: "End access now…" }));
      await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(actions.end).not.toHaveBeenCalled();
    });
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import { paths } from "@/paths";
import type { AdminPrivacyRequest, AdminPrivacyRequestDetail } from "@/services/admin.types";

import { PrivacyRequestDetail } from "./privacy-request-detail";

// One Privacy Request's screen (ticket 19; stories 133q and 133r): who asked,
// when it's due, and carrying it out. A data copy downloads as a file from
// the server; a deletion asks for the Member's email first; either is marked
// done. The Server Actions are the boundary, so they're replaced; the screen
// shows what they answer and reads the page again.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" };
const ID = "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a11";

const COPY: AdminPrivacyRequestDetail = {
  id: ID,
  type: "data-copy",
  status: "open",
  requestedAt: "2026-11-19T02:00:00.000Z",
  dueOn: "2026-11-26",
  overdue: false,
  member: BEA,
  doneAt: null,
  doneBy: null,
  deletionBlocked: null,
  deletionUnfinished: false,
  betaTester: true,
  paidOrders: 0,
};
const DELETION: AdminPrivacyRequestDetail = { ...COPY, type: "deletion", dueOn: "2026-12-19" };
const DONE: AdminPrivacyRequest = {
  ...COPY,
  status: "done",
  doneAt: "2026-11-20T02:00:00.000Z",
  doneBy: OWNER,
};

type State = AdminActionState<AdminPrivacyRequest>;

function renderScreen(
  request: AdminPrivacyRequestDetail,
  answer: State = { status: "saved", value: DONE },
) {
  const deleteAccount = vi.fn(async (): Promise<State> => answer);
  const markDone = vi.fn(async (): Promise<State> => answer);
  const user = userEvent.setup();
  render(<PrivacyRequestDetail request={request} actions={{ deleteAccount, markDone }} />);
  return { user, deleteAccount, markDone };
}

const status = () => screen.getByRole("status");
const dialog = () => screen.getByRole("dialog");
const typedEmail = () => within(dialog()).getByLabelText("TYPE THEIR EMAIL TO CONFIRM");

describe("PrivacyRequestDetail", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  describe("a data copy", () => {
    it("says who asked, when, when it's due, and that it's open", () => {
      renderScreen(COPY);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Copy of Bea Tester’s data",
      );
      expect(screen.getByRole("link", { name: "Bea Tester" })).toHaveAttribute(
        "href",
        paths.admin.user(BEA.userId),
      );
      const facts = screen.getByRole("definition", { name: "DUE" });
      expect(facts).toHaveTextContent("26 NOV 2026");
      expect(screen.getByRole("definition", { name: "REQUESTED" })).toHaveTextContent(
        "19 NOV 2026",
      );
      expect(screen.getByRole("definition", { name: "STATUS" })).toHaveTextContent("OPEN");
      expect(screen.queryByText("OVERDUE")).toBeNull();
    });

    it("flags it once it's overdue", () => {
      renderScreen({ ...COPY, overdue: true });
      expect(screen.getByRole("definition", { name: "STATUS" })).toHaveTextContent(
        "OPEN · OVERDUE",
      );
    });

    it("downloads the Member's data from the server, saying the Owner emails it themselves", () => {
      renderScreen(COPY);

      const download = screen.getByRole("button", { name: "Download this Member’s data" });
      const form = download.closest("form");
      expect(form).toHaveAttribute("method", "post");
      expect(form).toHaveAttribute("action", paths.admin.privacyRequestData(ID));
      expect(
        screen.getByText(/Email it from the support inbox to tester@example.com/),
      ).toBeVisible();
      expect(screen.getByText(/The Admin sends nothing/)).toBeVisible();
      // What the file holds (ticket 14 added the Orders).
      expect(screen.getByText(/notices, and Orders with any invoice requests/)).toBeVisible();
    });

    it("marks it done, then says so and reads the page again", async () => {
      const { user, markDone } = renderScreen(COPY);

      await user.click(screen.getByRole("button", { name: "Mark done" }));

      expect(markDone).toHaveBeenCalledWith({ status: "idle" }, { input: { requestId: ID } });
      expect(status()).toHaveTextContent("✓ MARKED DONE");
      expect(refresh).toHaveBeenCalled();
    });

    it("says when it was done and by whom, still offering the file but not “Mark done”", () => {
      renderScreen({ ...COPY, ...DONE });

      expect(screen.getByRole("definition", { name: "STATUS" })).toHaveTextContent(
        "DONE · 20 NOV 2026 · Angel Rose L. Lepaña",
      );
      expect(screen.getByRole("button", { name: "Download this Member’s data" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
    });

    it("says “Already deleted” once the account is gone, offering only “Mark done”", () => {
      renderScreen({ ...COPY, member: null, betaTester: false });

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Data copy");
      expect(screen.getByRole("definition", { name: "MEMBER" })).toHaveTextContent(
        "Account deleted",
      );
      expect(screen.getByText(/^Already deleted\./)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Download this Member’s data" })).toBeNull();
      expect(screen.getByRole("button", { name: "Mark done" })).toBeVisible();
    });

    it("says why “Mark done” was refused", async () => {
      const refused = renderScreen(COPY, {
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "This request is already done." },
      });
      await refused.user.click(screen.getByRole("button", { name: "Mark done" }));
      expect(status()).toHaveTextContent("This request is already done.");
    });

    it("says when the server couldn't be reached", async () => {
      const { user } = renderScreen(COPY, { status: "failed" });
      await user.click(screen.getByRole("button", { name: "Mark done" }));
      expect(status()).toHaveTextContent("Couldn’t reach the server, so nothing was changed.");
    });
  });

  describe("a deletion", () => {
    it("asks for the Member's email before deleting, saying what goes and that nothing is refunded", async () => {
      const { user, deleteAccount } = renderScreen(DELETION);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Delete Bea Tester’s account",
      );
      await user.click(screen.getByRole("button", { name: "Delete this account" }));

      expect(dialog()).toHaveAccessibleName("Delete Bea Tester’s account?");
      expect(dialog()).toHaveTextContent("tester@example.com");
      expect(dialog()).toHaveTextContent("Access Passes, with no refund");
      expect(dialog()).toHaveTextContent("can’t be undone");
      // No paid Orders: nothing to say about tax records (ticket 14).
      expect(dialog()).not.toHaveTextContent("tax records");
      expect(typedEmail()).toHaveValue("");
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it.each([
      [2, "2 paid Orders are kept for tax records, without the account."],
      [1, "1 paid Order is kept for tax records, without the account."],
    ])("says the %i paid Orders kept for tax records (ticket 14)", async (paidOrders, line) => {
      const { user } = renderScreen({ ...DELETION, paidOrders });
      await user.click(screen.getByRole("button", { name: "Delete this account" }));
      expect(dialog()).toHaveTextContent(line);
    });

    it("says their email stays on the Beta Tester list", async () => {
      const { user } = renderScreen(DELETION);
      await user.click(screen.getByRole("button", { name: "Delete this account" }));
      expect(dialog()).toHaveTextContent("Their email stays on the Beta Tester list");
    });

    it("sends the request and what was typed, then says the account is deleted", async () => {
      const { user, deleteAccount } = renderScreen(DELETION);
      await user.click(screen.getByRole("button", { name: "Delete this account" }));
      await user.type(typedEmail(), BEA.email);
      await user.click(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(deleteAccount).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { requestId: ID, confirmation: BEA.email } },
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent("✓ ACCOUNT DELETED · REQUEST DONE");
      expect(refresh).toHaveBeenCalled();
    });

    it("shows the server's refusal of the typed email under the field, keeping the dialog open", async () => {
      const { user } = renderScreen(DELETION, {
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { confirmation: ["TYPE THIS MEMBER’S EMAIL EXACTLY TO CONFIRM"] },
        },
      });
      await user.click(screen.getByRole("button", { name: "Delete this account" }));
      await user.type(typedEmail(), "someone@example.com");
      await user.click(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(typedEmail()).toHaveAccessibleDescription(
        "TYPE THIS MEMBER’S EMAIL EXACTLY TO CONFIRM",
      );
      expect(dialog()).toBeVisible();
    });

    it("says what the server said when it deleted the data but not the sign-in", async () => {
      const notDeleted =
        "The Member’s data is deleted, but their sign-in couldn’t be deleted just now.";
      const { user } = renderScreen(DELETION, {
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: notDeleted },
      });
      await user.click(screen.getByRole("button", { name: "Delete this account" }));
      await user.type(typedEmail(), BEA.email);
      await user.click(within(dialog()).getByRole("button", { name: "Delete account" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(status()).toHaveTextContent(notDeleted);
    });

    it("says why it can't be deleted while the email is on the staff list, with no delete button", () => {
      const blocked = "This email is on the staff list. Remove them from Staff first.";
      renderScreen({ ...DELETION, deletionBlocked: blocked });

      expect(screen.getByText(blocked)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Delete this account" })).toBeNull();
    });

    it("says why it can't be deleted while a payment is in progress, with no delete button (ticket 14)", () => {
      const blocked =
        "This Member has a payment in progress. Try again after it’s confirmed or expires (by 20 Nov 2026, 9:00 am).";
      renderScreen({ ...DELETION, deletionBlocked: blocked, paidOrders: 1 });

      expect(screen.getByText(blocked)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Delete this account" })).toBeNull();
    });

    it("offers “Mark done” to close it without deleting, saying it deletes nothing", async () => {
      const { user, markDone, deleteAccount } = renderScreen(DELETION);

      expect(screen.getByText(/marking it done deletes nothing/)).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Mark done" }));

      expect(markDone).toHaveBeenCalledWith({ status: "idle" }, { input: { requestId: ID } });
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("offers to finish a half-done deletion, with no email to type", async () => {
      const { user, deleteAccount } = renderScreen({
        ...DELETION,
        member: null,
        betaTester: false,
        deletionUnfinished: true,
      });

      expect(screen.getByText(/the sign-in is still there/)).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Finish deleting" }));

      expect(deleteAccount).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { requestId: ID, confirmation: "" } },
      );
      expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
    });

    it("offers “Mark done” for an account already gone", () => {
      renderScreen({ ...DELETION, member: null, betaTester: false });

      expect(screen.getByText(/^Already deleted\./)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Delete this account" })).toBeNull();
      expect(screen.getByRole("button", { name: "Mark done" })).toBeVisible();
    });

    it("says a done deletion deleted the account, offering nothing more", () => {
      renderScreen({ ...DELETION, ...DONE, type: "deletion", member: null, betaTester: false });

      expect(screen.getByText("The account is deleted.")).toBeVisible();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});

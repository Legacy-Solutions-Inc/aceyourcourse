import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DeletionFormState } from "@/app/app/(shell)/account/actions";
import type { PrivacyRequest } from "@/services/member.types";

import { AccountPrivacy } from "./account-privacy";

// Account's Privacy section (Phase 3, ticket 18; stories 110–112; mockup
// L620–631): what the Member agreed to, and their Privacy Requests. The
// warning and the typed confirmation are a convenience: the action refuses a
// deletion without the confirmation (account.test.tsx).
const EMAIL = "tester@example.com";
// 10:00 on 17 Nov 2026 in Manila.
const AGREEMENT = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  termsVersion: "2.0",
  privacyVersion: "2.1",
  agreedAt: "2026-11-17T02:00:00.000Z",
};
const request = (type: PrivacyRequest["type"], dueOn: string): PrivacyRequest => ({
  id: `0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a1${type === "deletion" ? 2 : 3}`,
  userId: AGREEMENT.userId,
  type,
  status: "open",
  // 00:30 on 20 Nov in Manila, still the 19th in UTC.
  requestedAt: "2026-11-19T16:30:00.000Z",
  dueOn,
});

function renderPrivacy(
  requests: PrivacyRequest[] = [],
  deletion: DeletionFormState = { error: null },
) {
  const requestDataCopyAction = vi.fn(async () => {});
  const requestDeletionAction = vi.fn(
    async (_previous: DeletionFormState, _formData: FormData) => deletion,
  );
  const user = userEvent.setup();
  const privacy = (shown: PrivacyRequest[]) => (
    <AccountPrivacy
      email={EMAIL}
      agreement={AGREEMENT}
      requests={shown}
      requestDataCopyAction={requestDataCopyAction}
      requestDeletionAction={requestDeletionAction}
    />
  );
  const { rerender } = render(privacy(requests));
  /** The page as the server draws it again once the action is done. */
  const redrawWith = (shown: PrivacyRequest[]) => rerender(privacy(shown));
  return { user, requestDataCopyAction, requestDeletionAction, redrawWith };
}

const deleteButton = () => screen.getByRole("button", { name: "Delete my account" });
const confirmation = () => screen.getByRole("group", { name: "Delete your account?" });

describe("AccountPrivacy", () => {
  it("says which versions the Member agreed to, and when, in Manila", () => {
    renderPrivacy();
    expect(
      screen.getByText("You agreed to Terms v2.0 and Privacy v2.1 on 17 Nov 2026."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
  });

  describe("a data copy", () => {
    it("is asked for with one button", async () => {
      const { user, requestDataCopyAction } = renderPrivacy();
      await user.click(screen.getByRole("button", { name: "Request a copy of my data" }));
      expect(requestDataCopyAction).toHaveBeenCalledOnce();
    });

    it("moves focus to what's pending once the page is drawn again", async () => {
      const { user, redrawWith } = renderPrivacy();
      await user.click(screen.getByRole("button", { name: "Request a copy of my data" }));
      redrawWith([request("data-copy", "2026-11-27")]);
      expect(screen.getByRole("status", { name: "Data copy" })).toHaveFocus();
    });

    it("shows as pending once asked for, with no button to ask again", () => {
      renderPrivacy([request("data-copy", "2026-11-27")]);
      expect(screen.getByRole("status", { name: "Data copy" })).toHaveTextContent(
        `Data copy requested on 20 Nov 2026. AYC will email your data to ${EMAIL} within 7 days.`,
      );
      expect(
        screen.queryByRole("button", { name: "Request a copy of my data" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("a deletion", () => {
    it("warns first: removed within 30 days, paid access not refunded, progress lost", async () => {
      const { user, requestDeletionAction } = renderPrivacy();
      expect(screen.queryByRole("group")).not.toBeInTheDocument();

      await user.click(deleteButton());

      expect(confirmation()).toHaveTextContent(
        "Your account, your progress and your Access Passes are removed within 30 days. Access you paid for isn’t refunded, and your progress is lost for good.",
      );
      expect(within(confirmation()).getByLabelText("Type DELETE to confirm")).toHaveFocus();
      expect(requestDeletionAction).not.toHaveBeenCalled();
    });

    it("sends what the Member typed", async () => {
      const { user, requestDeletionAction } = renderPrivacy();
      await user.click(deleteButton());
      await user.type(within(confirmation()).getByLabelText("Type DELETE to confirm"), "DELETE");
      await user.click(within(confirmation()).getByRole("button", { name: "Delete my account" }));

      expect(requestDeletionAction).toHaveBeenCalledOnce();
      const [, formData] = requestDeletionAction.mock.calls[0] ?? [];
      expect(formData?.get("confirmation")).toBe("DELETE");
    });

    it("shows the action's refusal", async () => {
      const refusal = "Type DELETE, in capitals, to confirm.";
      const { user } = renderPrivacy([], { error: refusal });
      await user.click(deleteButton());
      await user.type(within(confirmation()).getByLabelText("Type DELETE to confirm"), "delete");
      await user.click(within(confirmation()).getByRole("button", { name: "Delete my account" }));

      expect(await within(confirmation()).findByRole("alert")).toHaveTextContent(refusal);
    });

    it("keeps the account: Keep my account closes the warning", async () => {
      const { user, requestDeletionAction } = renderPrivacy();
      await user.click(deleteButton());
      await user.click(screen.getByRole("button", { name: "Keep my account" }));

      expect(screen.queryByRole("group")).not.toBeInTheDocument();
      expect(deleteButton()).toHaveFocus();
      expect(requestDeletionAction).not.toHaveBeenCalled();
    });

    it("moves focus to what's pending once the page is drawn again", async () => {
      const { user, redrawWith } = renderPrivacy();
      await user.click(deleteButton());
      await user.type(within(confirmation()).getByLabelText("Type DELETE to confirm"), "DELETE");
      await user.click(within(confirmation()).getByRole("button", { name: "Delete my account" }));
      redrawWith([request("deletion", "2026-12-20")]);
      expect(screen.getByRole("status", { name: "Account deletion" })).toHaveFocus();
    });

    it("leaves focus alone when the page opens with the request pending", () => {
      renderPrivacy([request("deletion", "2026-12-20")]);
      expect(screen.getByRole("status", { name: "Account deletion" })).not.toHaveFocus();
    });

    it("shows as pending once asked for, with no button to ask again", () => {
      renderPrivacy([request("deletion", "2026-12-20")]);
      expect(screen.getByRole("status", { name: "Account deletion" })).toHaveTextContent(
        "Deletion requested on 20 Nov 2026. Your account and its data are removed by 20 Dec 2026.",
      );
      expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
    });
  });

  it("shows both pending together", () => {
    renderPrivacy([request("data-copy", "2026-11-27"), request("deletion", "2026-12-20")]);
    expect(screen.getByRole("status", { name: "Data copy" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Account deletion" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

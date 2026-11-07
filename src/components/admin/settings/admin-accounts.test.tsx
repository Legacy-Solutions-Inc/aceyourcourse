import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import type { Invite, StaffList, StaffMember } from "@/services/admin.types";

import { type AdminAccountsActions, AdminAccounts } from "./admin-accounts";

// ADMIN ACCOUNTS, with its Server Actions stubbed as adminAction would answer.
// After every answer the screen reads the staff list again (router.refresh).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const NOW = "2026-10-22T03:42:00.000Z";
const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(Date.parse(NOW) + offset).toISOString();
const SITE = "https://aceyourcourse.ph/";

const EDITOR: StaffMember = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
  addedAt: iso(-30 * DAY),
  lastSignedInAt: iso(-2 * DAY),
};
const KIM: Invite = {
  email: "kim.reyes@gmail.com",
  role: "editor",
  createdAt: iso(-DAY),
  expiresAt: "2026-10-28T03:42:00.000Z",
};
const LIST: StaffList = {
  staff: [
    {
      email: "angel@aceyourcourse.ph",
      name: "Angel Rose L. Lepaña",
      role: "owner",
      addedAt: iso(-90 * DAY),
      lastSignedInAt: null,
    },
    EDITOR,
  ],
  invites: [
    KIM,
    {
      email: "expired.invite@example.com",
      role: "editor",
      createdAt: iso(-8 * DAY),
      expiresAt: iso(-DAY),
    },
  ],
};

const KIM_MESSAGE =
  "Hi! You've been added to the Ace Your Course Admin as an Editor. Open https://aceyourcourse.ph/admin, choose “Continue with Google” and sign in as kim.reyes@gmail.com. Please sign in by Wed, 28 Oct 2026, when the invite expires.";

/** A stub Server Action giving one answer. */
function answering<T>(state: AdminActionState<T>) {
  return vi.fn<AdminAction<T>>(async () => state);
}

const unused = <T,>() => vi.fn<AdminAction<T>>(async () => ({ status: "failed" }));

function renderAccounts(actions: Partial<AdminAccountsActions> = {}) {
  const user = userEvent.setup();
  const all: AdminAccountsActions = {
    addInvite: unused<Invite>(),
    renewStaffInvite: unused<Invite>(),
    cancelStaffInvite: unused<Invite>(),
    changeStaffMemberRole: unused<StaffMember>(),
    removeStaffMember: unused<StaffMember>(),
    ...actions,
  };
  render(
    <AdminAccounts
      list={LIST}
      you="angel@aceyourcourse.ph"
      now={NOW}
      siteUrl={SITE}
      actions={all}
    />,
  );
  return { user, actions: all };
}

const row = (text: string) =>
  within(screen.getByRole("list", { name: "Admin accounts" }))
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(text)) ?? null;

function rowOf(text: string) {
  const found = row(text);
  if (!found) throw new Error(`no row for ${text}`);
  return within(found);
}

const status = () =>
  within(screen.getByRole("region", { name: "ADMIN ACCOUNTS" }))
    .getAllByRole("status")
    .at(-1);

describe("AdminAccounts", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("gives your own row no controls, so you can't remove or demote yourself", () => {
    renderAccounts();
    const you = rowOf("angel@aceyourcourse.ph");
    expect(you.getByText("YOU · CAN’T BE REMOVED")).toBeInTheDocument();
    expect(you.queryAllByRole("button")).toEqual([]);
  });

  it("asks before removing, with the adjusted copy, then removes and reads the list again", async () => {
    const removeStaffMember = answering<StaffMember>({ status: "saved", value: EDITOR });
    const { user } = renderAccounts({ removeStaffMember });

    await user.click(rowOf(EDITOR.email).getByRole("button", { name: "Remove AYC Content Team" }));
    const dialog = screen.getByRole("dialog", { name: "Remove AYC Content Team as an admin?" });
    expect(dialog).toHaveAccessibleDescription(
      "content@aceyourcourse.ph loses access right away. Their edits stay. If they also have a member account, that isn’t affected.",
    );
    expect(dialog).not.toHaveTextContent("signed out");
    expect(removeStaffMember).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));
    expect(removeStaffMember).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: EDITOR.email } },
    );
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "✓ REMOVED · CONTENT@ACEYOURCOURSE.PH NO LONGER HAS ACCESS",
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("moves focus to the heading once a confirmed row's dialog closes, as the row goes", async () => {
    const removeStaffMember = answering<StaffMember>({ status: "saved", value: EDITOR });
    const { user } = renderAccounts({ removeStaffMember });
    await user.click(rowOf(EDITOR.email).getByRole("button", { name: "Remove AYC Content Team" }));
    await user.click(screen.getByRole("button", { name: "Remove access" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "ADMIN ACCOUNTS" })).toHaveFocus(),
    );
  });

  it("changes nothing when the removal is cancelled", async () => {
    const removeStaffMember = answering<StaffMember>({ status: "saved", value: EDITOR });
    const { user } = renderAccounts({ removeStaffMember });
    await user.click(rowOf(EDITOR.email).getByRole("button", { name: "Remove AYC Content Team" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(removeStaffMember).not.toHaveBeenCalled();
  });

  it("says why a refused change didn't happen", async () => {
    const changeStaffMemberRole = answering<StaffMember>({
      status: "refused",
      error: {
        kind: "invalid",
        fieldErrors: {},
        formError: "There must always be at least one Owner.",
      },
    });
    const { user } = renderAccounts({ changeStaffMemberRole });

    await user.click(
      rowOf(EDITOR.email).getByRole("button", { name: "AYC Content Team: Make Owner" }),
    );
    expect(changeStaffMemberRole).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: EDITOR.email, role: "owner" } },
    );
    await waitFor(() =>
      expect(status()).toHaveTextContent("There must always be at least one Owner."),
    );
  });

  it("asks before cancelling an Invite, with the adjusted copy", async () => {
    const cancelStaffInvite = answering<Invite>({ status: "saved", value: KIM });
    const { user } = renderAccounts({ cancelStaffInvite });

    await user.click(
      rowOf(KIM.email).getByRole("button", { name: `Cancel invite to ${KIM.email}` }),
    );
    const dialog = screen.getByRole("dialog", { name: `Cancel the invite to ${KIM.email}?` });
    expect(dialog).toHaveAccessibleDescription(
      "They can’t use it to sign in. You can invite them again anytime.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel invite" }));
    expect(cancelStaffInvite).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: KIM.email } },
    );
    await waitFor(() =>
      expect(status()).toHaveTextContent("✓ INVITE CANCELLED · KIM.REYES@GMAIL.COM"),
    );
  });

  it("renews an Invite at once", async () => {
    const renewStaffInvite = answering<Invite>({ status: "saved", value: KIM });
    const { user } = renderAccounts({ renewStaffInvite });
    const expired = rowOf("expired.invite@example.com");
    expect(expired.getByText(/^EXPIRED ·/)).toBeInTheDocument();

    await user.click(
      expired.getByRole("button", { name: "RENEW the invite to expired.invite@example.com" }),
    );
    expect(renewStaffInvite).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { email: "expired.invite@example.com" } },
    );
  });

  it("says an Invite that was already cancelled is gone, and reads the list again", async () => {
    const renewStaffInvite = answering<Invite>({ status: "refused", error: { kind: "not-found" } });
    const { user } = renderAccounts({ renewStaffInvite });
    await user.click(
      rowOf(KIM.email).getByRole("button", { name: `RENEW the invite to ${KIM.email}` }),
    );
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "That’s no longer on the staff list, so nothing was changed. The list is up to date.",
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("copies an Invite's message from its row", async () => {
    const { user } = renderAccounts();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(
      rowOf(KIM.email).getByRole("button", { name: `Copy invite message for ${KIM.email}` }),
    );
    expect(writeText).toHaveBeenCalledWith(KIM_MESSAGE);
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "✓ INVITE MESSAGE COPIED · SEND IT TO KIM.REYES@GMAIL.COM",
      ),
    );
  });

  it("shows the message selected in a field to copy by hand when the clipboard refuses", async () => {
    const { user } = renderAccounts();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("NotAllowedError"));
    await user.click(
      rowOf(KIM.email).getByRole("button", { name: `Copy invite message for ${KIM.email}` }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Copy the invite message" });
    const field = within(dialog).getByLabelText<HTMLTextAreaElement>("INVITE MESSAGE");
    expect(field).toHaveValue(KIM_MESSAGE);
    expect(field).toHaveAttribute("readonly");
    await waitFor(() => expect(field).toHaveFocus());
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe(KIM_MESSAGE);
    expect(
      within(dialog).getByText("Couldn’t copy it for you. Copy it from here."),
    ).toBeInTheDocument();
  });

  describe("+ Authorise an account", () => {
    const NEW_INVITE: Invite = {
      email: "new.editor@example.com",
      role: "editor",
      createdAt: NOW,
      expiresAt: "2026-10-29T03:42:00.000Z",
    };

    it("opens the mockup's modal, without the email line", async () => {
      const { user } = renderAccounts();
      await user.click(screen.getByRole("button", { name: "+ Authorise an account" }));

      const dialog = screen.getByRole("dialog", { name: "Give someone admin access" });
      expect(within(dialog).getByText("AUTHORISE AN ACCOUNT")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("GOOGLE ACCOUNT EMAIL")).toHaveValue("");
      const roles = within(dialog).getByRole("group", { name: "ROLE" });
      expect(within(roles).getByRole("radio", { name: /^Editor/ })).toBeChecked();
      expect(within(roles).getByRole("radio", { name: /^Owner/ })).not.toBeChecked();
      expect(
        within(dialog).getByText(
          "Access starts the first time they sign in with this Google account. Invites expire after 7 days.",
        ),
      ).toBeInTheDocument();
      expect(dialog).not.toHaveTextContent("They get an email");
      expect(within(dialog).getByRole("button", { name: "Add invite" })).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Send invite" })).not.toBeInTheDocument();
    });

    it("shows the field message for an email the server refused", async () => {
      const addInvite = answering<Invite>({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { email: ["This email is already on the staff list."] },
        },
      });
      const { user } = renderAccounts({ addInvite });
      await user.click(screen.getByRole("button", { name: "+ Authorise an account" }));
      await user.type(screen.getByLabelText("GOOGLE ACCOUNT EMAIL"), "KIM.REYES@gmail.com");
      await user.click(screen.getByRole("radio", { name: /^Owner/ }));
      await user.click(screen.getByRole("button", { name: "Add invite" }));

      expect(addInvite).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { email: "KIM.REYES@gmail.com", role: "owner" } },
      );
      const field = screen.getByLabelText("GOOGLE ACCOUNT EMAIL");
      await waitFor(() =>
        expect(field).toHaveAccessibleDescription("This email is already on the staff list."),
      );
      expect(field).toHaveValue("KIM.REYES@gmail.com");
    });

    it("opens the invite message once saved, and copies it", async () => {
      const addInvite = answering<Invite>({ status: "saved", value: NEW_INVITE });
      const { user } = renderAccounts({ addInvite });
      await user.click(screen.getByRole("button", { name: "+ Authorise an account" }));
      await user.type(screen.getByLabelText("GOOGLE ACCOUNT EMAIL"), NEW_INVITE.email);
      await user.click(screen.getByRole("button", { name: "Add invite" }));

      const dialog = await screen.findByRole("dialog", { name: "Now send them the invite" });
      const message =
        "Hi! You've been added to the Ace Your Course Admin as an Editor. Open https://aceyourcourse.ph/admin, choose “Continue with Google” and sign in as new.editor@example.com. Please sign in by Thu, 29 Oct 2026, when the invite expires.";
      expect(within(dialog).getByLabelText("INVITE MESSAGE")).toHaveValue(message);

      const writeText = vi.spyOn(navigator.clipboard, "writeText");
      await user.click(within(dialog).getByRole("button", { name: "Copy invite message" }));
      expect(writeText).toHaveBeenCalledWith(message);
      expect(
        await within(dialog).findByText("✓ COPIED · PASTE IT INTO AN EMAIL OR CHAT"),
      ).toBeInTheDocument();
    });

    it("opens empty again after an invite", async () => {
      const addInvite = answering<Invite>({ status: "saved", value: NEW_INVITE });
      const { user } = renderAccounts({ addInvite });
      await user.click(screen.getByRole("button", { name: "+ Authorise an account" }));
      await user.type(screen.getByLabelText("GOOGLE ACCOUNT EMAIL"), NEW_INVITE.email);
      await user.click(screen.getByRole("button", { name: "Add invite" }));
      await user.click(await screen.findByRole("button", { name: "Done" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "+ Authorise an account" }));
      expect(screen.getByLabelText("GOOGLE ACCOUNT EMAIL")).toHaveValue("");
    });
  });
});

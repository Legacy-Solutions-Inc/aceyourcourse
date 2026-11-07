"use client";

import { useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
  type AdminDialogTone,
} from "@/components/admin/admin-dialog";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { copyToClipboard, inviteMessage } from "@/lib/admin/copy-invite";
import { type StaffRow, staffRows } from "@/lib/admin/staff-rows";
import { cn } from "@/lib/utils";
import type { AdminError, Invite, StaffList, StaffMember } from "@/services/admin.types";

import { AddInviteDialog } from "./add-invite-dialog";
import { InviteMessage } from "./invite-message";
import { useStaffAction } from "./use-staff-action";

export interface AdminAccountsActions {
  addInvite: AdminAction<Invite>;
  renewStaffInvite: AdminAction<Invite>;
  cancelStaffInvite: AdminAction<Invite>;
  changeStaffMemberRole: AdminAction<StaffMember>;
  removeStaffMember: AdminAction<StaffMember>;
}

interface AdminAccountsProps {
  /** The staff list, read on the server for this render. */
  list: StaffList;
  /** The signed-in Owner's email: their own row can't be removed or changed. */
  you: string;
  /** When the server read the list, for "EXPIRES IN N DAYS" and "LAST SIGNED IN …". */
  now: string;
  /** The Website's address, for the invite message. */
  siteUrl: string;
  actions: AdminAccountsActions;
}

type Notice = { tone: "done" | "refused"; text: string };
/** The dialog that's asking first. It keeps its row while it closes, so its text stays put. */
type Confirming = { kind: "remove" | "cancel"; row: StaffRow; open: boolean };

/** Pure: what the screen says about a staff action that was refused. */
function refusalText(error: AdminError): string {
  switch (error.kind) {
    case "invalid":
      return (
        error.formError ?? Object.values(error.fieldErrors).flat()[0] ?? "Nothing was changed."
      );
    case "forbidden":
      return error.message;
    case "not-found":
      return "That’s no longer on the staff list, so nothing was changed. The list is up to date.";
    case "conflict":
      return "Nothing was changed. Reload the page and try again.";
  }
}

const BADGE_COLOURS = {
  OWNER: "border-foreground text-foreground",
  EDITOR: "border-ayc-blue text-ayc-blue",
  INVITED: "border-ayc-warning text-ayc-warning",
} as const;

const STATUS_COLOURS: Record<StaffRow["kind"], string> = {
  you: "text-muted-foreground",
  staff: "text-muted-foreground",
  invite: "text-ayc-warning",
  expired: "text-destructive",
};

/** Where a row's controls sit: under the row in a narrow card, beside it in a wide one. */
const ROW_CONTROLS =
  "col-span-2 flex flex-wrap gap-x-3 gap-y-1 @sm:col-span-1 @sm:col-start-2 @sm:justify-end";

const rowAction =
  "min-h-6 cursor-pointer text-xs font-semibold underline-offset-2 hover:underline disabled:cursor-wait";

/**
 * ADMIN ACCOUNTS in Settings (mockup 694–699; BUILD-MAP §3.11): who can use
 * the Admin. The Owner invites by Google email, copies the invite message to
 * send by hand, renews or cancels Invites, changes a Staff User's Staff Role
 * and removes them. The server enforces every rule; this screen only offers
 * what can work, so the Owner's own row has no controls.
 */
export function AdminAccounts({ list, you, now, siteUrl, actions }: AdminAccountsProps) {
  const rows = staffRows(list, you, new Date(now));
  const { pending, run } = useStaffAction();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState(0);
  /** The invite message to copy by hand, when the clipboard refused it. */
  const heading = useRef<HTMLHeadingElement>(null);
  const [copyByHand, setCopyByHand] = useState<{ message: string; open: boolean } | null>(null);

  /** Runs a row's action, then says how it went. */
  function act<T>(action: AdminAction<T>, input: unknown, done: (value: T) => string) {
    setNotice(null);
    run(action, input, (state: AdminActionState<T>) => {
      if (state.status === "saved") setNotice({ tone: "done", text: done(state.value) });
      else if (state.status === "refused") {
        setNotice({ tone: "refused", text: refusalText(state.error) });
      } else if (state.status === "failed") {
        setNotice({ tone: "refused", text: "Couldn’t reach the server, so nothing was changed." });
      }
    });
  }

  const renew = (row: StaffRow) =>
    act(
      actions.renewStaffInvite,
      { email: row.email },
      (invite) => `✓ RENEWED · ${invite.email.toUpperCase()} HAS 7 DAYS TO SIGN IN`,
    );

  const changeRole = (row: StaffRow) => {
    const role = row.role === "owner" ? "editor" : "owner";
    act(
      actions.changeStaffMemberRole,
      { email: row.email, role },
      (member) => `✓ ${member.name.toUpperCase()} IS NOW AN ${member.role.toUpperCase()}`,
    );
  };

  function confirm() {
    if (!confirming) return;
    const { kind, row } = confirming;
    setConfirming({ ...confirming, open: false });
    if (kind === "remove") {
      act(
        actions.removeStaffMember,
        { email: row.email },
        (member) => `✓ REMOVED · ${member.email.toUpperCase()} NO LONGER HAS ACCESS`,
      );
    } else {
      act(
        actions.cancelStaffInvite,
        { email: row.email },
        (invite) => `✓ INVITE CANCELLED · ${invite.email.toUpperCase()}`,
      );
    }
  }

  async function copyInvite(row: StaffRow & { expiresAt: string }) {
    const message = inviteMessage({ ...row, siteUrl });
    if (await copyToClipboard(message)) {
      setNotice({
        tone: "done",
        text: `✓ INVITE MESSAGE COPIED · SEND IT TO ${row.email.toUpperCase()}`,
      });
    } else setCopyByHand({ message, open: true });
  }

  return (
    <section
      aria-labelledby="settings-admin-accounts"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <h2
        ref={heading}
        tabIndex={-1}
        id="settings-admin-accounts"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        ADMIN ACCOUNTS
      </h2>
      <p className="text-sm leading-normal">
        Only these Google accounts can open the admin dashboard.
      </p>
      <ul aria-label="Admin accounts" className="@container flex flex-col">
        {rows.map((row) => (
          // A narrow card puts the controls under the row, so the email keeps
          // its width (container query: the card is half the screen on desktops).
          <li
            key={`${row.kind}:${row.email}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 border-b border-ayc-ruled py-2.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5 @sm:row-span-2">
              <span className="text-sm font-bold">{row.name}</span>
              <span className="font-mono text-[11px] wrap-anywhere text-muted-foreground">
                {row.email}
              </span>
              <span className={cn("font-mono text-[11px]", STATUS_COLOURS[row.kind])}>
                {row.status}
                {row.kind === "invite" || row.kind === "expired" ? (
                  <>
                    {" · "}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => renew(row)}
                      className="inline-flex min-h-6 cursor-pointer items-center font-bold underline underline-offset-2 disabled:cursor-wait"
                    >
                      RENEW<span className="sr-only"> the invite to {row.email}</span>
                    </button>
                  </>
                ) : null}
              </span>
            </div>
            <span
              className={cn(
                "self-start justify-self-end border-[1.5px] px-1.5 py-1 font-mono text-[10px] leading-none font-bold @sm:self-end",
                BADGE_COLOURS[row.badge],
              )}
            >
              {row.badge}
            </span>
            <RowActions
              row={row}
              pending={pending}
              onChangeRole={() => changeRole(row)}
              onRemove={() => setConfirming({ kind: "remove", row, open: true })}
              onCancel={() => setConfirming({ kind: "cancel", row, open: true })}
              onCopy={copyInvite}
            />
          </li>
        ))}
      </ul>
      <p
        role="status"
        className={cn(
          "-mt-1.5 min-h-4",
          notice?.tone === "refused"
            ? "text-sm font-semibold text-destructive"
            : "font-mono text-[11px] font-medium text-ayc-success",
        )}
      >
        {notice?.text ?? ""}
      </p>
      <button
        type="button"
        onClick={() => {
          setAddKey((key) => key + 1);
          setAdding(true);
        }}
        className="min-h-10 cursor-pointer self-start border-[1.5px] border-dashed bg-transparent px-3.5 text-[13px] font-semibold hover:bg-ayc-sand"
      >
        + Authorise an account
      </button>

      <AddInviteDialog
        key={addKey}
        open={adding}
        onOpenChange={setAdding}
        action={actions.addInvite}
        siteUrl={siteUrl}
      />
      <ConfirmDialog
        confirming={confirming}
        onClose={() => confirming && setConfirming({ ...confirming, open: false })}
        onConfirm={confirm}
        // Confirmed, the row it opened from goes, so focus goes to the heading.
        afterConfirm={() => heading.current?.focus()}
      />
      <AdminDialog
        open={copyByHand?.open ?? false}
        onOpenChange={(open) => !open && copyByHand && setCopyByHand({ ...copyByHand, open })}
        tag="COPY INVITE MESSAGE"
        tone="info"
        title="Copy the invite message"
        // The field takes focus, with its text selected, to copy by hand.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {copyByHand ? (
          // A new message mounts afresh, selected again.
          <InviteMessage key={copyByHand.message} message={copyByHand.message} copyFailed />
        ) : null}
        <AdminDialogButtons>
          <AdminDialogButton
            onClick={() => copyByHand && setCopyByHand({ ...copyByHand, open: false })}
          >
            Done
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </section>
  );
}

interface RowActionsProps {
  row: StaffRow;
  pending: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onCopy: (row: StaffRow & { expiresAt: string }) => void;
}

/** A row's controls: none on your own row, so you can't lock yourself out. */
function RowActions({ row, pending, onChangeRole, onRemove, onCancel, onCopy }: RowActionsProps) {
  switch (row.kind) {
    case "you":
      return null;
    case "staff":
      return (
        <div className={ROW_CONTROLS}>
          <button type="button" disabled={pending} onClick={onChangeRole} className={rowAction}>
            <span className="sr-only">{row.name}: </span>
            {row.role === "owner" ? "Make Editor" : "Make Owner"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            className={cn(rowAction, "text-destructive")}
          >
            Remove<span className="sr-only"> {row.name}</span>
          </button>
        </div>
      );
    case "invite":
    case "expired":
      return (
        <div className={ROW_CONTROLS}>
          {row.kind === "invite" ? (
            <button type="button" onClick={() => onCopy(row)} className={rowAction}>
              Copy invite message<span className="sr-only"> for {row.email}</span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={cn(rowAction, "text-destructive")}
          >
            Cancel invite<span className="sr-only"> to {row.email}</span>
          </button>
        </div>
      );
  }
}

/** What Remove and Cancel invite ask first (BUILD-MAP §2, with CONVENTIONS §4's copy). */
interface ConfirmCopy {
  tag: string;
  tone: AdminDialogTone;
  title: string;
  description: string;
  confirm: string;
  variant: "danger" | "primary";
}

const CONFIRMS: Record<Confirming["kind"], (row: StaffRow) => ConfirmCopy> = {
  remove: (row) => ({
    tag: "REMOVE ADMIN",
    tone: "danger",
    title: `Remove ${row.name} as an admin?`,
    description: `${row.email} loses access right away. Their edits stay. If they also have a member account, that isn’t affected.`,
    confirm: "Remove access",
    variant: "danger",
  }),
  cancel: (row) => ({
    tag: "CANCEL INVITE",
    tone: "warning",
    title: `Cancel the invite to ${row.email}?`,
    description: "They can’t use it to sign in. You can invite them again anytime.",
    confirm: "Cancel invite",
    variant: "primary",
  }),
};

/** Remove and Cancel invite ask first. Cancel closes it with nothing changed. */
function ConfirmDialog({
  confirming,
  onClose,
  onConfirm,
  afterConfirm,
}: {
  confirming: Confirming | null;
  onClose: () => void;
  onConfirm: () => void;
  /** Where focus goes once a confirmed dialog has closed. */
  afterConfirm: () => void;
}) {
  const confirmed = useRef(false);
  if (!confirming) return null;
  const copy = CONFIRMS[confirming.kind](confirming.row);
  return (
    <AdminDialog
      open={confirming.open}
      onOpenChange={(open) => !open && onClose()}
      tag={copy.tag}
      tone={copy.tone}
      title={copy.title}
      description={copy.description}
      onCloseAutoFocus={(event) => {
        if (!confirmed.current) return;
        confirmed.current = false;
        event.preventDefault();
        afterConfirm();
      }}
    >
      <AdminDialogButtons>
        <AdminDialogButton onClick={onClose}>Cancel</AdminDialogButton>
        <AdminDialogButton
          variant={copy.variant}
          onClick={() => {
            confirmed.current = true;
            onConfirm();
          }}
        >
          {copy.confirm}
        </AdminDialogButton>
      </AdminDialogButtons>
    </AdminDialog>
  );
}

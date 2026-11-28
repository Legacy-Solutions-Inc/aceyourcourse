"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { refusalText, UNREACHABLE } from "@/lib/admin/users-refusal";
import { formatDate } from "@/lib/manila-time";
import { ALREADY_DELETED, PRIVACY_REQUEST_DAYS } from "@/lib/member-app/privacy-requests";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { AdminPrivacyRequest, AdminPrivacyRequestDetail } from "@/services/admin.types";

/** The Server Actions that carry a request out. */
export interface PrivacyRequestActions {
  deleteAccount: AdminAction<AdminPrivacyRequest>;
  markDone: AdminAction<AdminPrivacyRequest>;
}

interface PrivacyRequestDetailProps {
  /** The request, read on the server for this render. */
  request: AdminPrivacyRequestDetail;
  actions: PrivacyRequestActions;
}

type Notice = { tone: "done" | "refused"; text: string };

const label = "font-mono text-[11px] font-bold tracking-[0.06em]";
const term = "font-mono text-xs text-muted-foreground";
const button =
  "min-h-10.5 w-fit cursor-pointer border-[1.5px] px-4 text-sm font-bold disabled:cursor-wait";

/** Pure: a date or an instant as its day in Manila, "19 NOV 2026". */
const day = (iso: string) => formatDate(iso).toUpperCase();

/** Pure: what deleting keeps of the Member's paid Orders (ticket 14); nothing to say for none. */
const keptOrdersLine = (paidOrders: number) =>
  paidOrders === 0
    ? null
    : ` ${paidOrders} paid ${paidOrders === 1 ? "Order is" : "Orders are"} kept for tax records, without the account.`;

/** One fact about the request: its mono term, then the value, named by the term. */
function Fact({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  return (
    <>
      <dt id={id} className={term}>
        {name}
      </dt>
      <dd aria-labelledby={id} className="min-w-0 wrap-anywhere">
        {children}
      </dd>
    </>
  );
}

/**
 * One Privacy Request's screen (ticket 19; stories 133q and 133r): who asked,
 * when, when it's due (flagged once overdue) and whether it's done, then
 * carrying it out.
 *
 * - A data copy: "Download this Member's data" posts to the server, which
 *   answers with the JSON file and logs the download. The Owner emails it
 *   from the support inbox: the Admin sends nothing.
 * - A deletion: "Delete this account" asks for the Member's email first, and
 *   says what goes (the sign-in, every Member App record, their Access
 *   Passes with no refund), how many paid Orders stay for tax records
 *   (ticket 14), and that it can't be undone. The server refuses an email on
 *   the staff list, or a Member with a payment in progress (ticket 14), so
 *   the screen says why instead of offering it; a deletion whose Supabase
 *   User wasn't deleted offers "Finish deleting".
 * - "Mark done", for either type, but not a half-done deletion. On a deletion
 *   whose account is still there it deletes nothing, and says so.
 *
 * Everything shown is what the server holds: after each answer the page is
 * read again.
 */
export function PrivacyRequestDetail({ request, actions }: PrivacyRequestDetailProps) {
  const { pending, run } = useStaffAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = useRef(false);

  const { id, type, status, member, overdue } = request;
  const shownName = member ? (member.name ?? member.email) : null;
  const isOpen = status === "open";
  const copy = type === "data-copy";
  const title = copy
    ? shownName
      ? `Copy of ${shownName}’s data`
      : "Data copy"
    : shownName
      ? `Delete ${shownName}’s account`
      : "Account deletion";
  const canMarkDone = isOpen && !request.deletionUnfinished;
  /** "Mark done" on a deletion whose account is still there closes it without deleting anything. */
  const closesWithoutDeleting = !copy && member !== null;

  /** What a carried-out request's notice says, or the refusal. */
  function answer(state: AdminActionState<AdminPrivacyRequest>, saved: string) {
    if (state.status === "failed") setNotice({ tone: "refused", text: UNREACHABLE });
    if (state.status === "refused") setNotice({ tone: "refused", text: refusalText(state.error) });
    if (state.status === "saved") setNotice({ tone: "done", text: saved });
  }

  function markDone() {
    if (pending) return;
    setNotice(null);
    run(actions.markDone, { requestId: id }, (state) => answer(state, "✓ MARKED DONE"));
  }

  function finishDeleting() {
    if (pending) return;
    setNotice(null);
    run(actions.deleteAccount, { requestId: id, confirmation: "" }, (state) =>
      answer(state, "✓ ACCOUNT DELETED · REQUEST DONE"),
    );
  }

  function submitDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setTypedError(undefined);
    setFailed(false);
    run(actions.deleteAccount, { requestId: id, confirmation: typed }, (state) => {
      if (state.status === "failed") {
        setFailed(true);
        return;
      }
      const fieldError =
        state.status === "refused" && state.error.kind === "invalid"
          ? state.error.fieldErrors.confirmation?.[0]
          : undefined;
      if (fieldError) {
        setTypedError(fieldError);
        return;
      }
      answer(state, "✓ ACCOUNT DELETED · REQUEST DONE");
      answered.current = true;
      setOpen(false);
    });
  }

  return (
    <section
      aria-labelledby="privacy-request-title"
      className="flex max-w-170 min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <p className={cn(label, copy ? "text-ayc-blue" : "text-destructive")}>
        {copy ? "DATA COPY" : "DELETION"} · PRIVACY REQUEST
      </p>
      <h2
        ref={heading}
        tabIndex={-1}
        id="privacy-request-title"
        className="text-xl font-extrabold wrap-anywhere"
      >
        {title}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
        <Fact id="privacy-request-member" name="MEMBER">
          {member ? (
            <span className="flex flex-col gap-0.5">
              <Link
                href={paths.admin.user(member.userId)}
                className="w-fit font-bold text-ayc-navy underline-offset-2 hover:underline"
              >
                {shownName}
              </Link>
              {member.name ? (
                <span className="font-mono text-[11px] text-muted-foreground">{member.email}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Account deleted</span>
          )}
        </Fact>
        <Fact id="privacy-request-requested" name="REQUESTED">
          <span className="font-mono text-xs">{day(request.requestedAt)}</span>
        </Fact>
        <Fact id="privacy-request-due" name="DUE">
          <span className={cn("font-mono text-xs", overdue && "font-bold text-destructive")}>
            {day(request.dueOn)} · {PRIVACY_REQUEST_DAYS[type]} DAYS
          </span>
        </Fact>
        <Fact id="privacy-request-status" name="STATUS">
          <span className="font-mono text-xs font-bold">
            {isOpen ? "OPEN" : "DONE"}
            {overdue ? <span className="text-destructive"> · OVERDUE</span> : null}
            {request.doneAt ? ` · ${day(request.doneAt)}` : null}
            {request.doneBy ? (
              <span className="font-sans font-semibold"> · {request.doneBy.name}</span>
            ) : null}
          </span>
        </Fact>
      </dl>

      <div className="flex flex-col gap-2.5 border-t-[1.5px] pt-3.5">
        {copy ? (
          member ? (
            <>
              <form method="post" action={paths.admin.privacyRequestData(id)}>
                <button type="submit" className={cn(button, "bg-primary text-primary-foreground")}>
                  Download this Member’s data
                </button>
              </form>
              <p className="text-sm text-muted-foreground">
                A JSON file of everything kept about them: profile, Target Exams, consents, Access
                Passes, progress, resume state, device log, notices, and Orders with any invoice
                requests. Email it from the support inbox to {member.email}. The Admin sends
                nothing. Each download is logged in Staff Activity.
              </p>
            </>
          ) : (
            <AlreadyDeleted />
          )
        ) : !isOpen ? (
          <p className="text-sm font-semibold">The account is deleted.</p>
        ) : request.deletionUnfinished ? (
          <>
            <p className="text-sm">
              The Member’s data is deleted, but the sign-in is still there. Finish deleting to
              remove it; the request is done once it’s gone.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={finishDeleting}
              className={cn(button, "bg-destructive text-white")}
            >
              {pending ? "Deleting…" : "Finish deleting"}
            </button>
          </>
        ) : !member ? (
          <AlreadyDeleted />
        ) : request.deletionBlocked ? (
          <p className="text-sm font-semibold text-destructive">{request.deletionBlocked}</p>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setNotice(null);
                setTyped("");
                setTypedError(undefined);
                setFailed(false);
                setOpen(true);
              }}
              className={cn(button, "bg-destructive text-white")}
            >
              Delete this account
            </button>
            <p className="text-sm text-muted-foreground">
              Deletes their sign-in, every Member App record and their Access Passes and Courses,
              with no refund. The request is done once the account is deleted.
            </p>
          </>
        )}

        {canMarkDone ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={markDone}
              className={cn(button, "bg-transparent hover:bg-ayc-sand")}
            >
              Mark done
            </button>
            {closesWithoutDeleting ? (
              <p className="text-sm text-muted-foreground">
                Only for a request carried out another way, for example one the Member withdrew:
                marking it done deletes nothing.
              </p>
            ) : null}
          </>
        ) : null}

        {/* On paper, where the success green passes 4.5:1. */}
        <p
          role="status"
          className={cn(
            "min-h-4",
            notice?.tone === "refused"
              ? "text-sm font-semibold text-destructive"
              : "font-mono text-[11px] font-medium text-ayc-success",
          )}
        >
          {notice?.text ?? ""}
        </p>
      </div>

      {member && !copy ? (
        <AdminDialog
          open={open}
          onOpenChange={setOpen}
          tag="DELETE ACCOUNT"
          tone="danger"
          title={`Delete ${shownName}’s account?`}
          description={
            <>
              This deletes {member.email}’s sign-in, every Member App record (Target Exams,
              progress, device log, notices) and their Access Passes and Courses, with no refund. It
              can’t be undone.
              {keptOrdersLine(request.paidOrders)}
              {request.betaTester
                ? " Their email stays on the Beta Tester list: remove it there if they shouldn’t come back."
                : null}
            </>
          }
          onCloseAutoFocus={(event) => {
            if (!answered.current) return;
            // Answered, the button is gone with the account, so focus goes to the heading.
            answered.current = false;
            event.preventDefault();
            heading.current?.focus();
          }}
        >
          <form noValidate onSubmit={submitDeletion} className="flex flex-col gap-3">
            <AdminTextField
              label="TYPE THEIR EMAIL TO CONFIRM"
              name="confirmation"
              type="email"
              autoComplete="off"
              placeholder={member.email}
              value={typed}
              error={typedError}
              onChange={(event) => setTyped(event.target.value)}
            />
            {failed ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {UNREACHABLE}
              </p>
            ) : null}
            <AdminDialogButtons>
              <AdminDialogButton onClick={() => setOpen(false)}>Cancel</AdminDialogButton>
              <AdminDialogButton type="submit" variant="danger" disabled={pending}>
                {pending ? "Deleting…" : "Delete account"}
              </AdminDialogButton>
            </AdminDialogButtons>
          </form>
        </AdminDialog>
      ) : null}
    </section>
  );
}

/** A request whose Member's account is gone: there's nothing left to download or delete. */
function AlreadyDeleted() {
  return <p className="text-sm">{ALREADY_DELETED}</p>;
}

"use client";

import { type FormEvent, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { formatChangedOn } from "@/lib/admin/time";
import { cn } from "@/lib/utils";
import type { AdminError, BetaTester } from "@/services/admin.types";

export interface BetaTestersActions {
  addTester: AdminAction<BetaTester>;
  removeTester: AdminAction<BetaTester>;
}

interface BetaTestersProps {
  /** The Beta Tester list, read on the server for this render. */
  testers: BetaTester[];
  /** The Member App switch: once it's on, anyone gets in, and the list no longer decides. */
  memberAppLive: boolean;
  actions: BetaTestersActions;
}

type Notice = { tone: "done" | "refused"; text: string };
/** The dialog that's asking first. It keeps its tester while it closes, so its text stays put. */
type Confirming = { tester: BetaTester; open: boolean };

/** Pure: what the screen says about an action that was refused, apart from the email field's own message. */
function refusalText(error: AdminError): string {
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "Nothing was changed.";
    case "forbidden":
      return error.message;
    case "not-found":
      return "That email is no longer a Beta Tester, so nothing was changed. The list is up to date.";
    case "conflict":
      return "Nothing was changed. Reload the page and try again.";
  }
}

/**
 * BETA TESTERS in Users (spec, Phase 3 → The beta gate; stories 133a and
 * 133b): the Google emails that get into the Member App while its switch is
 * off. An Owner adds an email before the person has an account, and removes
 * one. The server enforces every rule and records each change in Staff
 * Activity; this screen only shows what it answered.
 */
export function BetaTesters({ testers, memberAppLive, actions }: BetaTestersProps) {
  const { pending, run } = useStaffAction();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmed = useRef(false);

  /** Says how an action went. An invalid email shows under its field instead. */
  function answer<T>(state: AdminActionState<T>, done: (value: T) => string) {
    if (state.status === "saved") setNotice({ tone: "done", text: done(state.value) });
    else if (state.status === "failed") {
      setNotice({ tone: "refused", text: "Couldn’t reach the server, so nothing was changed." });
    } else if (state.status === "refused") {
      const fieldError = state.error.kind === "invalid" ? state.error.fieldErrors.email?.[0] : null;
      if (fieldError) setEmailError(fieldError);
      else setNotice({ tone: "refused", text: refusalText(state.error) });
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setNotice(null);
    setEmailError(undefined);
    run(actions.addTester, { email }, (state) => {
      answer(state, (tester) => `✓ ADDED · ${tester.email.toUpperCase()} IS A BETA TESTER`);
      if (state.status === "saved") setEmail("");
    });
  }

  function remove() {
    if (!confirming) return;
    const { tester } = confirming;
    setConfirming({ tester, open: false });
    setNotice(null);
    setEmailError(undefined);
    run(actions.removeTester, { email: tester.email }, (state) =>
      answer(
        state,
        (removed) => `✓ REMOVED · ${removed.email.toUpperCase()} IS NO LONGER A BETA TESTER`,
      ),
    );
  }

  return (
    <section
      aria-labelledby="users-beta-testers"
      className="flex max-w-3xl min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <h2
        ref={heading}
        tabIndex={-1}
        id="users-beta-testers"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        BETA TESTERS
      </h2>
      <p className="text-sm leading-normal">
        {memberAppLive
          ? "The Member App is open to everyone, so this list no longer decides who gets in."
          : "Until the Member App opens to everyone, only Staff and these Google accounts can use it. Everyone else sees “Not open yet”."}
      </p>

      {testers.length > 0 ? (
        <ul aria-label="Beta Testers" className="flex flex-col">
          {testers.map((tester) => (
            <li
              key={tester.email}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-ayc-ruled py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold wrap-anywhere">{tester.email}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  ADDED {formatChangedOn(tester.addedAt)} · BY {tester.addedBy.name.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming({ tester, open: true })}
                className="min-h-6 cursor-pointer text-xs font-semibold text-destructive underline-offset-2 hover:underline disabled:cursor-wait"
              >
                Remove<span className="sr-only"> {tester.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
          No Beta Testers yet. Add the first one below.
        </p>
      )}

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

      <form noValidate onSubmit={add} className="flex flex-wrap items-start gap-2.5">
        <AdminTextField
          label="GOOGLE ACCOUNT EMAIL"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-[1_1_260px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-[22px] min-h-10 cursor-pointer border-[1.5px] bg-primary px-3.5 text-[13px] font-bold text-primary-foreground disabled:cursor-wait"
        >
          {pending ? "Saving…" : "Add Beta Tester"}
        </button>
      </form>
      <p className="text-[13px] leading-[1.45]">
        You can add someone before they have an account. They get in the first time they sign in
        with this Google account. Adding them gives no Access Pass: they start on Free Preview.
      </p>

      {confirming ? (
        <AdminDialog
          open={confirming.open}
          onOpenChange={(open) => !open && setConfirming({ ...confirming, open: false })}
          tag="REMOVE BETA TESTER"
          tone="danger"
          title={`Remove ${confirming.tester.email} from the beta?`}
          description="They can’t open the Member App from their next click, until it opens to everyone. Their account and study progress are kept."
          onCloseAutoFocus={(event) => {
            if (!confirmed.current) return;
            // Confirmed, the row it opened from goes, so focus goes to the heading.
            confirmed.current = false;
            event.preventDefault();
            heading.current?.focus();
          }}
        >
          <AdminDialogButtons>
            <AdminDialogButton onClick={() => setConfirming({ ...confirming, open: false })}>
              Cancel
            </AdminDialogButton>
            <AdminDialogButton
              variant="danger"
              onClick={() => {
                confirmed.current = true;
                remove();
              }}
            >
              Remove Beta Tester
            </AdminDialogButton>
          </AdminDialogButtons>
        </AdminDialog>
      ) : null}
    </section>
  );
}

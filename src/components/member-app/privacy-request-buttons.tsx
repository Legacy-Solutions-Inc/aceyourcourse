"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import type { DeletionFormState } from "@/app/app/(shell)/account/actions";
import { DELETION_CONFIRMATION, PRIVACY_REQUEST_DAYS } from "@/lib/member-app/privacy-requests";

// Account's two Privacy Request buttons (Phase 3, ticket 18; stories 111 and
// 112; mockup L629–631). Each one gives way to what's pending once the server
// draws the page again after the request, and focus moves there, so it isn't
// lost with the button. A page that opens with a request pending leaves focus
// alone.

const button =
  "flex min-h-11 cursor-pointer items-center border-[1.5px] px-4 text-sm font-bold disabled:cursor-not-allowed";
const pendingStyle =
  "border-l-4 border-ayc-success bg-ayc-paper px-3.5 py-2.5 text-sm leading-normal focus:outline-2 focus:outline-offset-2";

/**
 * What's pending in place of a button: shown while `text` is set, and focused
 * when it appears after the Member asked here (`asked` marks that).
 */
function usePending(text: string | null) {
  const status = useRef<HTMLParagraphElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (text !== null && asked.current) {
      asked.current = false;
      status.current?.focus();
    }
  }, [text]);
  return { status, markAsked: () => (asked.current = true) };
}

function PendingStatus({
  label,
  text,
  status,
}: {
  label: string;
  text: string;
  status: React.RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p ref={status} tabIndex={-1} role="status" aria-label={label} className={pendingStyle}>
      {text}
    </p>
  );
}

interface DataCopyRequestProps {
  action: () => Promise<void>;
  /** What Account says while the Member's data copy request is open, or null. */
  pending: string | null;
}

/** "Request a copy of my data" (mockup L629): one click, then it's pending. */
export function DataCopyRequest({ action, pending }: DataCopyRequestProps) {
  const { status, markAsked } = usePending(pending);
  if (pending !== null) return <PendingStatus label="Data copy" text={pending} status={status} />;
  return (
    <form action={action}>
      <button type="submit" onClick={markAsked} className={button}>
        Request a copy of my data
      </button>
    </form>
  );
}

interface DeleteAccountProps {
  /** The deletion request's Server Action, which checks the typed confirmation itself. */
  action: (previous: DeletionFormState, formData: FormData) => Promise<DeletionFormState>;
  /** What Account says while the Member's deletion request is open, or null. */
  pending: string | null;
}

const IDLE: DeletionFormState = { error: null };

/**
 * "Delete my account" (mockup L631; story 112): opens a warning in place, with
 * a field to type the confirmation, "Delete my account" and "Keep my account".
 * The action refuses a send without the confirmation.
 */
export function DeleteAccount({ action, pending }: DeleteAccountProps) {
  const [state, formAction, sending] = useActionState(action, IDLE);
  const [confirming, setConfirming] = useState(false);
  const { status, markAsked } = usePending(pending);
  const openButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const kept = useRef(false);
  const titleId = useId();
  const warningId = useId();
  const errorId = useId();

  // Opening moves focus to the field; "Keep my account" brings it back to the button.
  useEffect(() => {
    if (confirming) field.current?.focus();
    else if (kept.current) {
      kept.current = false;
      openButton.current?.focus();
    }
  }, [confirming]);

  if (pending !== null) {
    return <PendingStatus label="Account deletion" text={pending} status={status} />;
  }

  if (!confirming) {
    return (
      <button
        ref={openButton}
        type="button"
        onClick={() => setConfirming(true)}
        className={`${button} self-start border-destructive text-destructive`}
      >
        Delete my account
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={warningId}
      className="flex flex-col gap-3 border-[1.5px] border-destructive bg-ayc-paper p-4"
    >
      <p id={titleId} className="text-base font-extrabold text-destructive">
        Delete your account?
      </p>
      <p id={warningId} className="max-w-prose text-sm leading-normal">
        Your account, your progress and your Access Passes are removed within{" "}
        {PRIVACY_REQUEST_DAYS.deletion} days. Access you paid for isn’t refunded, and your progress
        is lost for good. Payment records are kept as the law requires.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Type {DELETION_CONFIRMATION} to confirm
          <input
            ref={field}
            name="confirmation"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? errorId : undefined}
            className="min-h-11 max-w-60 border-[1.5px] bg-white px-3 font-mono text-base font-semibold"
          />
        </label>
        {state.error ? (
          <p id={errorId} role="alert" className="text-sm font-semibold text-destructive">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending}
            onClick={markAsked}
            className={`${button} border-destructive bg-destructive text-white`}
          >
            Delete my account
          </button>
          <button
            type="button"
            onClick={() => {
              kept.current = true;
              setConfirming(false);
            }}
            className={`${button} bg-transparent`}
          >
            Keep my account
          </button>
        </div>
      </form>
    </div>
  );
}

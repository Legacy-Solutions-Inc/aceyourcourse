"use client";

import { type FormEvent, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction } from "@/lib/admin/action";
import { formatLoggedAt } from "@/lib/admin/time";
import { cn } from "@/lib/utils";
import type { AdminError, ForcedSignOut } from "@/services/admin.types";
import type { ActiveDevice } from "@/services/member.types";

interface ForceSignOutProps {
  member: { userId: string; name: string | null; email: string };
  /** The Member's Active Device, read on the server for this render. */
  device: ActiveDevice | null;
  action: AdminAction<ForcedSignOut>;
}

type Notice = { tone: "done" | "refused"; text: string };

const FAILED = "Couldn’t reach the server, so nothing was changed.";

/** Pure: what the panel says about a refusal that isn't the reason field's. */
function refusalText(error: AdminError): string {
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "Nothing was changed.";
    case "forbidden":
      return error.message;
    case "not-found":
      return "This Member isn’t there any more, so nothing was changed.";
    case "conflict":
      return "Nothing was changed. Reload the page and try again.";
  }
}

/**
 * ACTIVE DEVICE on a Member's detail page, with "Sign out this device"
 * (story 132; mockup 799–802 and its signOut confirm). It asks first, with a
 * reason that Staff Activity keeps. The server clears the Active Device, so
 * the device's next Member App request shows "Session ended"; this panel only
 * shows what the server answered, then reads the page again.
 */
export function ForceSignOut({ member, device, action }: ForceSignOutProps) {
  const { pending, run } = useStaffAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = useRef(false);
  const firstName = member.name?.trim().split(/\s+/)[0] ?? member.email;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setReasonError(undefined);
    setFailed(false);
    run(action, { userId: member.userId, reason }, (state) => {
      if (state.status === "failed") {
        setFailed(true);
        return;
      }
      if (state.status === "refused") {
        const fieldError =
          state.error.kind === "invalid" ? state.error.fieldErrors.reason?.[0] : undefined;
        if (fieldError) {
          setReasonError(fieldError);
          return;
        }
        setNotice({ tone: "refused", text: refusalText(state.error) });
      } else if (state.status === "saved") {
        const label = state.value.signedOut.deviceLabel.toUpperCase();
        setNotice({
          tone: "done",
          text: `✓ SIGNED OUT · ${label} · THEIR NEXT CLICK SHOWS “SESSION ENDED”`,
        });
        setReason("");
      }
      answered.current = true;
      setOpen(false);
    });
  }

  return (
    <section
      aria-labelledby="member-active-device"
      className="flex flex-col gap-1.5 border-t-[1.5px] pt-3"
    >
      <h2
        ref={heading}
        tabIndex={-1}
        id="member-active-device"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        ACTIVE DEVICE
      </h2>
      {device ? (
        <>
          <p className="text-sm font-semibold">{device.deviceLabel}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            ACTIVE SINCE {formatLoggedAt(device.claimedAt)}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setNotice(null);
              setFailed(false);
              setReasonError(undefined);
              setOpen(true);
            }}
            className="mt-1 min-h-10.5 cursor-pointer border-[1.5px] bg-transparent px-4 text-sm font-bold hover:bg-ayc-sand disabled:cursor-wait"
          >
            Sign out this device
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No Active Device. Nothing to sign out.</p>
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

      {device ? (
        <AdminDialog
          open={open}
          onOpenChange={setOpen}
          tag="SIGN OUT DEVICE"
          tone="warning"
          title={`Sign ${firstName} out of ${device.deviceLabel}?`}
          description="Their next click in the Member App shows “Session ended”, and they can sign in again on any device. Their Access Passes and progress stay the same."
          onCloseAutoFocus={(event) => {
            if (!answered.current) return;
            // Answered, the button may be gone with the device, so focus goes to the heading.
            answered.current = false;
            event.preventDefault();
            heading.current?.focus();
          }}
        >
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            <AdminTextField
              label="REASON · SAVED IN STAFF ACTIVITY"
              name="reason"
              autoComplete="off"
              placeholder="e.g. Shared with a classmate"
              value={reason}
              error={reasonError}
              onChange={(event) => setReason(event.target.value)}
            />
            {failed ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {FAILED}
              </p>
            ) : null}
            <AdminDialogButtons>
              <AdminDialogButton onClick={() => setOpen(false)}>Cancel</AdminDialogButton>
              <AdminDialogButton type="submit" variant="danger" disabled={pending}>
                {pending ? "Signing out…" : "Sign out device"}
              </AdminDialogButton>
            </AdminDialogButtons>
          </form>
        </AdminDialog>
      ) : null}
    </section>
  );
}

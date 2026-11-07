"use client";

import { type FormEvent, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { showSaveFailedToast } from "@/components/admin/save-failed-toast";
import type { AdminAction } from "@/lib/admin/action";
import { inviteMessage } from "@/lib/admin/copy-invite";
import { cn } from "@/lib/utils";
import type { Invite, StaffRole } from "@/services/admin.types";

import { InviteMessage } from "./invite-message";
import { useStaffAction } from "./use-staff-action";

// The Staff Roles, as the Admin's permissions are in Phase 2 (spec, Phase 2 →
// Staff Role permissions). The mockup's orders, prices, users and courses
// arrive in later phases.
const ROLES: { value: StaffRole; name: string; description: string }[] = [
  {
    value: "editor",
    name: "Editor",
    description:
      "Exam pages and the promo, Products, Reviews and FAQs. Can’t open Settings or manage admin accounts.",
  },
  {
    value: "owner",
    name: "Owner",
    description: "Everything, including Settings and admin accounts.",
  },
];

interface AddInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AdminAction<Invite>;
  /** The Website's address, for the invite message. */
  siteUrl: string;
}

/**
 * "+ Authorise an account" (mockup 926–941; BUILD-MAP §2, addAdmin): a Google
 * email and a Staff Role make an Invite. No email is sent, so saving opens the
 * invite message for the Owner to copy and send themselves.
 */
export function AddInviteDialog({ open, onOpenChange, action, siteUrl }: AddInviteDialogProps) {
  const [values, setValues] = useState<{ email: string; role: StaffRole }>({
    email: "",
    role: "editor",
  });
  const [errors, setErrors] = useState<{ email?: string; role?: string; form?: string }>({});
  const [invited, setInvited] = useState<Invite | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const { pending, run } = useStaffAction();

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending) return;
    setErrors({});
    run(action, values, (state) => {
      if (state.status === "saved") setInvited(state.value);
      else if (state.status === "failed") {
        showSaveFailedToast({
          what: "Authorise an account",
          onRetry: () => form.current?.requestSubmit(),
        });
      } else if (state.status === "refused") {
        const { error } = state;
        if (error.kind === "invalid") {
          setErrors({
            email: error.fieldErrors.email?.[0],
            role: error.fieldErrors.role?.[0],
            form: error.formError,
          });
        } else if (error.kind === "forbidden") setErrors({ form: error.message });
        else setErrors({ form: "Not saved. Reload the page and try again." });
      }
    });
  }

  if (invited) {
    return (
      <AdminDialog
        open={open}
        onOpenChange={onOpenChange}
        tag="AUTHORISE AN ACCOUNT"
        tone="info"
        title="Now send them the invite"
        description={`No email is sent. Copy this message and send it to ${invited.email} yourself, by email or chat.`}
      >
        <InviteMessage message={inviteMessage({ ...invited, siteUrl })} />
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => onOpenChange(false)}>Done</AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    );
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      tag="AUTHORISE AN ACCOUNT"
      tone="info"
      title="Give someone admin access"
    >
      <form ref={form} noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <AdminTextField
          label="GOOGLE ACCOUNT EMAIL"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={errors.role ? "add-invite-role-error" : undefined}
        >
          <legend className="mb-2 font-mono text-xs font-medium text-muted-foreground">ROLE</legend>
          {ROLES.map((role) => (
            <label
              key={role.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 border-[1.5px] bg-ayc-paper px-3.5 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                values.role === role.value && "border-2 border-ayc-blue",
              )}
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={values.role === role.value}
                onChange={() => setValues({ ...values, role: role.value })}
                className="mt-0.75 size-4 flex-none accent-ayc-blue focus-visible:outline-none"
              />
              <span className="flex flex-col gap-0.75">
                <span className="text-[15px] font-bold">{role.name}</span>
                <span className="text-[13px] leading-[1.45]">{role.description}</span>
              </span>
            </label>
          ))}
          {errors.role ? (
            <p
              id="add-invite-role-error"
              className="font-mono text-[11px] font-medium text-destructive"
            >
              {errors.role}
            </p>
          ) : null}
        </fieldset>
        <p className="text-[13px] leading-[1.45]">
          Access starts the first time they sign in with this Google account. Invites expire after 7
          days.
        </p>
        {errors.form ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errors.form}
          </p>
        ) : null}
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => onOpenChange(false)}>Cancel</AdminDialogButton>
          <AdminDialogButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add invite"}
          </AdminDialogButton>
        </AdminDialogButtons>
      </form>
    </AdminDialog>
  );
}

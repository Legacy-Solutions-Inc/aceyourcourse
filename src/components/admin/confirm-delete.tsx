"use client";

import { useState, useTransition } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import type { AdminActionState } from "@/lib/admin/action";

/** Pure: what a refused or failed delete says, in the dialog. */
function deleteError(state: AdminActionState<unknown>): string | undefined {
  if (state.status === "failed") return "COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return undefined;
  const { error } = state;
  if (error.kind === "invalid" && error.formError) return error.formError;
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "not-found") return "IT’S ALREADY GONE · RELOAD THE PAGE";
  return "NOT DELETED · RELOAD THE PAGE AND TRY AGAIN";
}

interface ConfirmDeleteProps {
  /** The button that opens the confirmation, e.g. "Delete exam". */
  label: string;
  /** The button's accessible name, when it needs more than its label. */
  ariaLabel?: string;
  buttonClassName: string;
  tag: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Sends the delete; gives its answer. */
  send: () => Promise<AdminActionState<unknown>>;
  onDeleted: () => void;
}

/** A delete button and its in-page confirmation (the Admin's dialog, never the browser's). */
export function ConfirmDelete({
  label,
  ariaLabel,
  buttonClassName,
  tag,
  title,
  description,
  confirmLabel,
  send,
  onDeleted,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await send();
      if (state.status === "saved") {
        setOpen(false);
        onDeleted();
      } else {
        setError(deleteError(state));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className={buttonClassName}
      >
        {label}
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        tag={tag}
        tone="danger"
        title={title}
        description={description}
      >
        {error ? (
          <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => setOpen(false)}>Cancel</AdminDialogButton>
          <AdminDialogButton
            variant="danger"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {confirmLabel}
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </>
  );
}

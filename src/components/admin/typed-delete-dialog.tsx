"use client";

import { useId, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";

/** The word to type, exactly, in capitals. */
const WORD = "DELETE";

interface TypedDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The bar's label, e.g. "DELETE PRODUCT". */
  tag: string;
  title: string;
  /** What goes, and what doesn't, with exact counts. */
  description: string;
  /** The delete button's label, e.g. "Delete product". */
  confirmLabel: string;
  onConfirm: () => void;
  /** While the delete is on its way: the button waits. */
  pending: boolean;
  /** Why the last delete didn't go through. */
  error?: string;
}

/**
 * The confirmation for a delete that can't be undone (mockup 912–921; BUILD-MAP
 * §2: deleteProduct, deleteLesson, deleteReviewer): the delete button stays
 * disabled until "DELETE" is typed exactly. Closing it clears what was typed.
 */
export function TypedDeleteDialog({
  open,
  onOpenChange,
  tag,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  error,
}: TypedDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const confirmed = typed === WORD;

  function change(next: boolean) {
    if (!next) setTyped("");
    onOpenChange(next);
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={change}
      tag={tag}
      tone="danger"
      title={title}
      description={description}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          // The dialog is portaled, but React still bubbles the submit to any
          // form it's rendered from, such as the editor it deletes from.
          event.stopPropagation();
          if (confirmed && !pending) onConfirm();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="font-mono text-xs font-medium text-muted-foreground">
            TYPE {WORD} TO CONFIRM
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? errorId : undefined}
            className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 font-mono text-sm text-foreground"
          />
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="font-mono text-[11px] font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => change(false)}>Cancel</AdminDialogButton>
          <AdminDialogButton
            type="submit"
            variant="danger"
            disabled={!confirmed || pending}
            aria-busy={pending || undefined}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel}
          </AdminDialogButton>
        </AdminDialogButtons>
      </form>
    </AdminDialog>
  );
}

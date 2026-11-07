"use client";

import { toast } from "sonner";

interface SaveFailedToastProps {
  /** The form's name, quoted in the message: “Store & social links” wasn’t saved. */
  what: string;
  /** What's kept, after "Check your connection.". Forms keep their edits; a toggle switches back. */
  kept?: string;
  onRetry: () => void;
  onDismiss: () => void;
}

const EDITS_KEPT = "Your edits are still in the form.";

/**
 * The mockup's "Couldn't save" toast (mockup 943–949; BUILD-MAP §2,
 * saveFailed): the save broke down, nothing was saved, and the form still
 * holds the edits.
 */
export function SaveFailedToast({
  what,
  kept = EDITS_KEPT,
  onRetry,
  onDismiss,
}: SaveFailedToastProps) {
  return (
    <div className="flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 border-[1.5px] bg-ayc-paper px-4 py-3.5 text-foreground shadow-hard-md shadow-destructive">
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-destructive">
        COULDN’T SAVE
      </p>
      <p className="text-sm leading-[1.45]">
        “{what}” wasn’t saved. Check your connection. {kept}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-9.5 cursor-pointer border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9.5 cursor-pointer border-[1.5px] px-4 text-sm font-bold hover:bg-ayc-sand"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Shows the "Couldn't save" toast until it's dismissed. Try again closes it and
 * calls `onRetry`. One toast per form: a second failure replaces the first.
 */
export function showSaveFailedToast({
  what,
  kept,
  onRetry,
}: {
  what: string;
  kept?: string;
  onRetry: () => void;
}) {
  const id = `save-failed:${what}`;
  toast.custom(
    () => (
      <SaveFailedToast
        what={what}
        kept={kept}
        onRetry={() => {
          toast.dismiss(id);
          onRetry();
        }}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { id, duration: Infinity },
  );
}

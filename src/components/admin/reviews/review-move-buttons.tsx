"use client";

import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import type { ReviewMove } from "@/services/admin.schema";
import type { AdminError } from "@/services/admin.types";

interface ReviewMoveButtonsProps {
  reviewId: string;
  /** Names the Review in the buttons' labels, e.g. its first words. */
  name: string;
  /** Whether it's first or last in the Home order, so it can't go further. */
  first: boolean;
  last: boolean;
  /** Why the order can't be changed here, e.g. while other filters are on; null when it can. */
  disabledReason: string | null;
  action: AdminAction<string[]>;
}

const BUTTON =
  "flex size-6 cursor-pointer items-center justify-center border-[1.5px] bg-ayc-paper font-mono text-[11px] font-bold hover:bg-ayc-sand disabled:cursor-not-allowed disabled:border-ayc-rule disabled:text-ayc-rule disabled:hover:bg-ayc-paper";

/**
 * ▲▼ in "Pinned on Home only" (spec, Phase 2 → Reviews): moves the Review one
 * place earlier or later in the Home order, saving at once (useInstantSave).
 * ▲ on the first and ▼ on the last are disabled; the server refuses them too.
 */
export function ReviewMoveButtons({
  reviewId,
  name,
  first,
  last,
  disabledReason,
  action,
}: ReviewMoveButtonsProps) {
  const { save, pending } = useInstantSave(action, {
    what: "The Home order",
    kept: "The order is as it was.",
    refused: moveRefusal,
  });
  const move = (direction: ReviewMove) => save({ id: reviewId, direction });

  const locked = pending || disabledReason !== null;
  return (
    <span className="flex gap-1" aria-busy={pending || undefined}>
      <button
        type="button"
        aria-label={`Move up on Home: ${name}`}
        title={disabledReason ?? undefined}
        disabled={locked || first}
        onClick={() => move("up")}
        className={BUTTON}
      >
        <span aria-hidden="true">▲</span>
      </button>
      <button
        type="button"
        aria-label={`Move down on Home: ${name}`}
        title={disabledReason ?? undefined}
        disabled={locked || last}
        onClick={() => move("down")}
        className={BUTTON}
      >
        <span aria-hidden="true">▼</span>
      </button>
    </span>
  );
}

/** Pure: what a refused move says: why the server refused it, when it said. */
function moveRefusal(error: AdminError): string {
  if (error.kind === "not-found") {
    return "That Review is no longer in the catalogue. The list is up to date.";
  }
  if (error.kind === "invalid" && error.formError) return error.formError;
  return "The order wasn’t changed. Reload the page and try again.";
}

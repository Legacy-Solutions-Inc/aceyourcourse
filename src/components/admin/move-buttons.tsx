"use client";

import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import { cn } from "@/lib/utils";
import type { AdminError } from "@/services/admin.types";

export interface MoveButtonsProps {
  /** The record that moves. */
  id: string;
  /** The buttons' accessible names, e.g. "Move up on Home: “Glossy…”". */
  labels: { up: string; down: string };
  /** Whether it's first or last in its order, so it can't go further. */
  first: boolean;
  last: boolean;
  /** Why the order can't be changed here, e.g. while searching; null when it can. */
  disabledReason: string | null;
  action: AdminAction<string[]>;
  /** What the "Couldn't save" toast names, e.g. "The Home order". */
  what: string;
  /** What a move of a record that's gone says. */
  gone: string;
  className?: string;
}

const BUTTON =
  "flex size-6 cursor-pointer items-center justify-center border-[1.5px] bg-ayc-paper font-mono text-[11px] font-bold hover:bg-ayc-sand disabled:cursor-not-allowed disabled:border-ayc-rule disabled:text-ayc-rule disabled:hover:bg-ayc-paper";

/**
 * ▲▼ (spec, Phase 2 → Reviews, FAQ): moves the record one place earlier or
 * later in its order, saving at once (useInstantSave). ▲ on the first and ▼
 * on the last are disabled; the server refuses them too.
 */
export function MoveButtons({
  id,
  labels,
  first,
  last,
  disabledReason,
  action,
  what,
  gone,
  className,
}: MoveButtonsProps) {
  const { save, pending } = useInstantSave(action, {
    what,
    kept: "The order is as it was.",
    refused: (error) => moveRefusal(error, gone),
  });
  const move = (direction: "up" | "down") => save({ id, direction });

  const locked = pending || disabledReason !== null;
  return (
    <span className={cn("flex gap-1", className)} aria-busy={pending || undefined}>
      <button
        type="button"
        aria-label={labels.up}
        title={disabledReason ?? undefined}
        disabled={locked || first}
        onClick={() => move("up")}
        className={BUTTON}
      >
        <span aria-hidden="true">▲</span>
      </button>
      <button
        type="button"
        aria-label={labels.down}
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
function moveRefusal(error: AdminError, gone: string): string {
  if (error.kind === "not-found") return gone;
  if (error.kind === "invalid" && error.formError) return error.formError;
  return "The order wasn’t changed. Reload the page and try again.";
}

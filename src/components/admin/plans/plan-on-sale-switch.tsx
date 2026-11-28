"use client";

import { useOptimistic } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import type { AdminError } from "@/services/admin.types";

interface PlanOnSaleSwitchProps<T> {
  /** The Plan's id, or a One-time purchase's Course's (Phase 5, ticket 06). */
  id: string;
  /** On sale, as the server last read it. */
  checked: boolean;
  /** Its name, for its label and messages: "CE All-Access · 3 months", "PSAD Masterclass". */
  title: string;
  action: AdminAction<T>;
}

/**
 * A list row's On sale switch (mockup 603), for a Plan or a One-time
 * purchase: it flips at once and saves with no conflict check
 * (useInstantSave). A refused switch, such as a second Plan on sale for the
 * same Exam and duration, or a Course with no price yet, flips back and says
 * why.
 */
export function PlanOnSaleSwitch<T>({ id, checked, title, action }: PlanOnSaleSwitchProps<T>) {
  const [shown, show] = useOptimistic(checked);
  const { save, pending } = useInstantSave(action, {
    what: title,
    kept: "The switch is back as it was.",
    refused: (error) => refusalText(error, title),
  });
  return (
    <AdminSwitch
      checked={shown}
      onCheckedChange={(next) => save({ id, onSale: next }, () => show(next))}
      aria-label={`On sale: ${title}`}
      aria-busy={pending || undefined}
    />
  );
}

/** Pure: what the list says about a switch that was refused. */
function refusalText(error: AdminError, title: string): string {
  if (error.kind === "invalid" && error.formError) return error.formError;
  if (error.kind === "not-found") {
    return `${title} is no longer there, so nothing was changed. The list is up to date.`;
  }
  if (error.kind === "forbidden") return error.message;
  return `${title} wasn’t changed. Reload the page and try again.`;
}

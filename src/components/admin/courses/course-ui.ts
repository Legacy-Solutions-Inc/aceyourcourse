import type { AdminActionState } from "@/lib/admin/action";
import type { AdminError } from "@/services/admin.types";

// What the Course builder's screens (Phase 5, ticket 01) show for a save that
// didn't go through: a field's own message, or what else the refusal says.

/** Pure: what a refused or failed save says, apart from a field's own message and a conflict. */
export function refusalText(state: AdminActionState<unknown>, invalid: string): string {
  if (state.status === "failed") return "COULDN’T SAVE · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return "";
  const error: AdminError = state.error;
  switch (error.kind) {
    case "invalid":
      return error.formError ?? invalid;
    case "forbidden":
      return error.message;
    case "not-found":
      return "IT’S NO LONGER THERE · RELOAD THE PAGE";
    case "conflict":
      return "NOT SAVED";
  }
}

/** Pure: each field's first message, from a refused save. */
export function fieldErrorsOf(state: AdminActionState<unknown>): Record<string, string> {
  if (state.status !== "refused" || state.error.kind !== "invalid") return {};
  return Object.fromEntries(
    Object.entries(state.error.fieldErrors).flatMap(([field, messages]) =>
      messages[0] ? [[field, messages[0]]] : [],
    ),
  );
}

/** Pure: the conflict a refused save reports, or null. */
export const conflictOf = (state: AdminActionState<unknown>) =>
  state.status === "refused" && state.error.kind === "conflict" ? state.error : null;

export const BUTTON =
  "min-h-9 cursor-pointer border-[1.5px] px-3 text-[13px] font-bold disabled:cursor-wait disabled:opacity-60";
export const PRIMARY_BUTTON = `${BUTTON} bg-primary text-primary-foreground`;
export const PLAIN_BUTTON = `${BUTTON} bg-ayc-paper hover:bg-ayc-sand`;
export const TEXT_BUTTON =
  "min-h-6 cursor-pointer text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline";
export const LABEL = "font-mono text-xs font-medium text-muted-foreground";
export const TAG =
  "border border-ayc-rule px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground";

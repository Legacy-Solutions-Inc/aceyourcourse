import { cn } from "@/lib/utils";

/** Where an editor stands (spec, Phase 2 → Live on save; BUILD-MAP §5, "Save states"). */
export type SaveStatus = "up-to-date" | "unsaved" | "saving" | "saved" | "error";

interface SaveStateProps {
  status: SaveStatus;
  /** What a save made live, e.g. "✓ SAVED · EVERY STORE BUTTON UPDATED". */
  savedMessage: string;
  /** Why the last save didn't go through, while the status is "error". */
  errorMessage?: string;
}

const LINES: Record<Exclude<SaveStatus, "saved" | "error">, string> = {
  "up-to-date": "UP TO DATE",
  unsaved: "UNSAVED CHANGES",
  saving: "SAVING…",
};

const COLOURS: Record<SaveStatus, string> = {
  "up-to-date": "text-muted-foreground",
  unsaved: "text-ayc-warning",
  saving: "text-muted-foreground",
  saved: "text-ayc-success",
  error: "text-destructive",
};

/**
 * An editor's save-state line, next to its Save button (mockup 224, 274). It
 * is a status region, so a screen reader hears each change.
 */
export function SaveState({ status, savedMessage, errorMessage }: SaveStateProps) {
  const line =
    status === "saved"
      ? savedMessage
      : status === "error"
        ? (errorMessage ?? "NOT SAVED")
        : LINES[status];
  return (
    <p role="status" className={cn("font-mono text-[11px] font-medium", COLOURS[status])}>
      {line}
    </p>
  );
}

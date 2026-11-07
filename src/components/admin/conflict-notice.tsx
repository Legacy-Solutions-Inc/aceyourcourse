"use client";

import { formatSavedAt } from "@/lib/admin/time";

interface ConflictNoticeProps {
  /** Who saved first, or null for a record nobody has saved, such as after a Reset. */
  savedBy: string | null;
  /** When they saved, as an ISO time. */
  savedAt: string;
  /** What they saved, as the sentence names it: "these settings", "this Product". */
  what: string;
}

/**
 * Says that someone saved this record after the form opened, so this save was
 * refused and the form keeps its values (spec, Phase 2 → Conflict check).
 * Reloading shows their save and discards the form's changes.
 */
export function ConflictNotice({ savedBy, savedAt, what }: ConflictNoticeProps) {
  const time = formatSavedAt(savedAt, new Date());
  const message = savedBy
    ? `${savedBy} saved ${what} at ${time}. Copy your changes, then reload to see theirs.`
    : `${what.charAt(0).toUpperCase()}${what.slice(1)} changed at ${time}. Copy your changes, then reload to see the new version.`;

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 border-[1.5px] border-destructive bg-background px-3.5 py-3"
    >
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-destructive">
        SOMEONE SAVED FIRST
      </p>
      <p className="text-sm leading-[1.45]">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-9 cursor-pointer border-[1.5px] px-3 text-[13px] font-bold hover:bg-ayc-sand"
      >
        Reload
      </button>
    </div>
  );
}

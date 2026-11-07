"use client";

import { useTransition } from "react";

interface ResetSampleDataButtonProps {
  /** The Reset Server Action. */
  action: () => Promise<void>;
}

/**
 * The header's Reset, beside the SAMPLE DATA tag (spec, Phase 2 → Two stages):
 * the sample data starts again from the seed, then the page reloads, so every
 * form opens on the seed's values.
 */
export function ResetSampleDataButton({ action }: ResetSampleDataButtonProps) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action();
          window.location.reload();
        })
      }
      className="min-h-10 cursor-pointer border-[1.5px] border-dashed border-destructive px-3 text-[13px] font-bold text-destructive hover:bg-ayc-sand disabled:cursor-wait"
    >
      {pending ? "Resetting…" : "Reset"}
    </button>
  );
}

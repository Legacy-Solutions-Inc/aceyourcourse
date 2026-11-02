"use client";

import { useOptimistic } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import type { AdminReview } from "@/services/admin.types";

interface ReviewPinSwitchProps {
  reviewId: string;
  /** The pin as the server last read it. */
  pinned: boolean;
  action: AdminAction<AdminReview>;
  /** Spread onto the switch: its name, or the ids of the row that names it. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/**
 * The HOME switch (mockup 248, 1165): it flips at once and saves with no
 * conflict check (useInstantSave). Pinning puts the Review at the end of the
 * Home order. A failed save switches back and shows the "Couldn't save"
 * toast; a Review deleted elsewhere says so.
 */
export function ReviewPinSwitch({ reviewId, pinned, action, ...names }: ReviewPinSwitchProps) {
  const [shown, show] = useOptimistic(pinned);
  const { save, pending } = useInstantSave(action, {
    what: "Pin on Home",
    kept: "The switch is back as it was.",
    refused: (error) =>
      error.kind === "not-found"
        ? "That Review is no longer in the catalogue, so nothing was changed. The list is up to date."
        : "The pin wasn’t changed. Reload the page and try again.",
  });

  return (
    <AdminSwitch
      checked={shown}
      onCheckedChange={(next) => save({ id: reviewId, pinned: next }, () => show(next))}
      aria-busy={pending || undefined}
      {...names}
    />
  );
}

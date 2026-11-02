"use client";

import { MoveButtons } from "@/components/admin/move-buttons";
import type { AdminAction } from "@/lib/admin/action";

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

/** ▲▼ in "Pinned on Home only" (spec, Phase 2 → Reviews): one place in the Home order. */
export function ReviewMoveButtons({ reviewId, name, ...props }: ReviewMoveButtonsProps) {
  return (
    <MoveButtons
      id={reviewId}
      labels={{ up: `Move up on Home: ${name}`, down: `Move down on Home: ${name}` }}
      what="The Home order"
      gone="That Review is no longer in the catalogue. The list is up to date."
      {...props}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { reviewListHref } from "@/lib/admin/review-list";
import type { AdminReview, AdminReviewList, ReviewDeletePreview } from "@/services/admin.types";

import { EditReview, NewReview, type ReviewEditorActions } from "./review-editor";

interface ReviewPanelProps {
  /** The selected Review's id, "new", or null. */
  selected: string | null;
  /** The selected Review, or null when it isn't in the catalogue. */
  opened: AdminReview | null;
  /** What deleting the selected Review takes with it. */
  deletePreview: ReviewDeletePreview | null;
  list: Pick<AdminReviewList, "products" | "pinnedOnHome" | "query">;
  actions: ReviewEditorActions;
}

const NOTHING_GOES: ReviewDeletePreview = { faqQuotes: 0 };

/**
 * The right-hand panel (mockup 261–276): the selected Review's editor, a new
 * Review's, or a prompt to pick one. A Review just added opens in its editor
 * at its own address, still saying "✓ SAVED".
 */
export function ReviewPanel({ selected, opened, deletePreview, list, actions }: ReviewPanelProps) {
  const router = useRouter();
  const [added, setAdded] = useState<AdminReview | null>(null);
  // "✓ SAVED" is for the editor the new Review opens in; another selection forgets it.
  if (added && selected !== "new" && selected !== added.review.id) setAdded(null);

  const pinnedCount = list.pinnedOnHome;
  let body: React.ReactNode;
  if (selected === "new") {
    body = (
      <NewReview
        products={list.products}
        pinnedCount={pinnedCount}
        actions={actions}
        onAdded={(review) => {
          setAdded(review);
          router.replace(reviewListHref(list.query, review.review.id), { scroll: false });
        }}
      />
    );
  } else if (opened) {
    const id = opened.review.id;
    body = (
      <EditReview
        key={id}
        opened={opened}
        products={list.products}
        deletePreview={deletePreview ?? NOTHING_GOES}
        pinnedCount={pinnedCount}
        listHref={reviewListHref(list.query)}
        actions={actions}
        savedOnOpen={added?.review.id === id ? added : undefined}
      />
    );
  } else {
    body = (
      <>
        <p className="font-bold">Select a review</p>
        <p className="text-sm text-muted-foreground">
          Pick one from the list to edit it, or add a new one.
        </p>
      </>
    );
  }

  return (
    <aside
      aria-label="Review editor"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      {body}
    </aside>
  );
}

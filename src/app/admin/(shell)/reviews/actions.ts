"use server";

import { adminAction } from "@/lib/admin/action";
import {
  createReview,
  deleteReview,
  moveReviewPin,
  previewReviewDelete,
  setReviewPinned,
  updateReview,
} from "@/services/admin";
import {
  addReviewInputSchema,
  reviewIdInputSchema,
  reviewMoveInputSchema,
  reviewPinInputSchema,
  saveReviewInputSchema,
} from "@/services/admin.schema";

// The REVIEWS tab's Server Actions, for any Staff User. Each one checks the
// input's shape; the seam checks every Review rule, so the form is told each
// field's message.

/** The HOME switch: it always saves, with no conflict check. */
export const setReviewPin = adminAction(
  { role: "staff", schema: reviewPinInputSchema },
  async (actor, { id, pinned }) => setReviewPinned(actor, id, pinned),
);

/** ▲ or ▼ in "Pinned on Home only": one place in the Home order. It always saves. */
export const moveReviewOnHome = adminAction(
  { role: "staff", schema: reviewMoveInputSchema },
  async (actor, { id, direction }) => moveReviewPin(actor, id, direction),
);

/** "Add review": a new Review, pinned on Home or not. */
export const addReview = adminAction({ role: "staff", schema: addReviewInputSchema }, createReview);

/** "Save review": the editor's fields, with the conflict check against the stamp it opened with. */
export const saveReview = adminAction(
  { role: "staff", schema: saveReviewInputSchema },
  async (actor, { id, ...form }, expected) => updateReview(actor, id, form, expected),
);

/**
 * The delete dialog's count of FAQ quotes, read as it opens, so it's exact
 * even when an FAQ quoted the Review since the page loaded. It changes nothing.
 */
export const countReviewDelete = adminAction(
  { role: "staff", schema: reviewIdInputSchema },
  async (actor, { id }) => {
    const preview = await previewReviewDelete(actor, id);
    return preview
      ? { ok: true as const, value: preview, tags: [] }
      : { ok: false as const, error: { kind: "not-found" as const } };
  },
);

/** The delete dialog's "Delete review": the Review, and the FAQ quotes taken from it. */
export const removeReview = adminAction(
  { role: "staff", schema: reviewIdInputSchema },
  async (actor, { id }) => deleteReview(actor, id),
);

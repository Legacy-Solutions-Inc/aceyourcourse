"use server";

import { after } from "next/server";

import { adminAction } from "@/lib/admin/action";
import {
  deleteReviewerPdf,
  placeReviewerPdf,
  recordReviewerPdf,
  setReviewerPdfFreePreview,
  setReviewerPdfPublished,
} from "@/services/admin";
import {
  reviewerPdfFreePreviewInputSchema,
  reviewerPdfIdInputSchema,
  reviewerPdfPlacementSchema,
  reviewerPdfPublishedInputSchema,
  reviewerPdfRecordSchema,
} from "@/services/admin.schema";
import { startReviewerPdfRun } from "@/services/reviewer-pdf-runs";
import { createReviewerPdfUpload as createUpload } from "@/services/uploads";
import { reviewerPdfUploadRequestSchema } from "@/services/uploads.types";

// The Reviewer PDFs screen's Server Actions (Phase 3, ticket 12): any Staff
// User uploads a Reviewer PDF and deletes one. The browser asks for the
// upload, sends the PDF straight to the private bucket, then records it,
// which starts the job that splits it into page images, after the response.
// Like every Admin action, each runs the Staff Guard first, so a Member or
// someone signed out never reaches the seam, which checks every rule again.
// A Reviewer PDF's screen (ticket 13) places it under a Topic (the form's
// save, with its stamp), publishes or unpublishes it, and flags it Free
// Preview; "+ New topic" is the Topics editor's own addTopic. None clears a
// cache tag: the Member App reads its content fresh.

/** Where the browser sends a Reviewer PDF: a resumable upload, or the sample data's one-time URL. */
export const createReviewerPdfUpload = adminAction(
  { role: "staff", schema: reviewerPdfUploadRequestSchema },
  async (actor, request) => createUpload(actor, request),
);

/** Once it's uploaded: records the Reviewer PDF as Processing, and starts its job. */
export const addReviewerPdf = adminAction(
  { role: "staff", schema: reviewerPdfRecordSchema },
  async (actor, input) => {
    const result = await recordReviewerPdf(actor, input);
    if (result.ok) {
      const { id } = result.value;
      after(() => startReviewerPdfRun(id));
    }
    return result;
  },
);

/** Delete, after the typed confirmation: the Reviewer PDF, its original and every page image. */
export const removeReviewerPdf = adminAction(
  { role: "staff", schema: reviewerPdfIdInputSchema },
  async (actor, { id }) => deleteReviewerPdf(actor, id),
);

/** "Save placement": an editor's save, so it sends the stamp the placement had when the form opened. */
export const saveReviewerPdfPlacement = adminAction(
  { role: "staff", schema: reviewerPdfPlacementSchema, requiresStamp: true },
  placeReviewerPdf,
);

/** Publish or Unpublish: the seam refuses publishing without a Topic, or before every page is split. */
export const saveReviewerPdfPublished = adminAction(
  { role: "staff", schema: reviewerPdfPublishedInputSchema },
  async (actor, { id, published }) => setReviewerPdfPublished(actor, id, published),
);

/** "Free Preview": a single toggle. */
export const saveReviewerPdfFreePreview = adminAction(
  { role: "staff", schema: reviewerPdfFreePreviewInputSchema },
  async (actor, { id, freePreview }) => setReviewerPdfFreePreview(actor, id, freePreview),
);

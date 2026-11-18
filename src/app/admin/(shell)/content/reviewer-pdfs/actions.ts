"use server";

import { after } from "next/server";

import { adminAction } from "@/lib/admin/action";
import { deleteReviewerPdf, recordReviewerPdf } from "@/services/admin";
import { reviewerPdfIdInputSchema, reviewerPdfRecordSchema } from "@/services/admin.schema";
import { startReviewerPdfRun } from "@/services/reviewer-pdf-runs";
import { createReviewerPdfUpload as createUpload } from "@/services/uploads";
import { reviewerPdfUploadRequestSchema } from "@/services/uploads.types";

// The Reviewer PDFs screen's Server Actions (Phase 3, ticket 12): any Staff
// User uploads a Reviewer PDF and deletes one. The browser asks for the
// upload, sends the PDF straight to the private bucket, then records it,
// which starts the job that splits it into page images, after the response.
// Like every Admin action, each runs the Staff Guard first, so a Member or
// someone signed out never reaches the seam, which checks every rule again.

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

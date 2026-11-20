import { beforeEach, describe, expect, it } from "vitest";

import { originalPath } from "@/lib/reviewer-pdfs/paths";
import type { StaffActor } from "@/services/admin.types";
import { sampleReviewerPdfStore } from "@/services/mock/admin/reviewer-pdfs";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { reviewerPdfCalls } from "@/services/reviewer-pdfs.core";
import type { ReviewerPdfFiles } from "@/services/uploads";

import { uploadSampleReviewerPdf } from "../../test/reviewer-pdf-uploads";
import { pdfOfPages } from "../../test/reviewer-pdfs";

// Recording a Reviewer PDF with Storage's files (ticket 12): Storage keeps an
// upload where the browser sent it, so claiming its path again gives the
// same Reviewer PDF. The same request sent twice must then be refused, and
// leave the first one's original alone. The sample data's files hand an
// upload over once, so the seam suite (admin.reviewer-pdfs.test.ts) meets
// this only on the database arm with Storage; here, the sample data's store
// with files that claim as Storage's do.

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

/** The sample data's files, claiming an upload as Storage does: again and again. */
function storageLike(files: ReviewerPdfFiles): ReviewerPdfFiles {
  const claimed = new Map<string, { id: string; size: number }>();
  return {
    ...files,
    async claimUpload(path) {
      const before = claimed.get(path);
      if (before) return before;
      const found = await files.claimUpload(path);
      if (found && found !== "waiting") claimed.set(path, found);
      return found;
    },
  };
}

beforeEach(() => {
  resetSampleStore();
});

describe("recording a Reviewer PDF on Storage", () => {
  it("refuses the same upload recorded twice, keeping the first one's original", async () => {
    const calls = reviewerPdfCalls({
      ...sampleReviewerPdfStore,
      files: storageLike(sampleReviewerPdfStore.files),
    });
    const bytes = pdfOfPages(2);
    const path = await uploadSampleReviewerPdf(bytes);
    const first = await calls.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" });
    if (!first.ok) throw new Error("expected the upload to be recorded");

    expect(await calls.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).toEqual({
      ok: false,
      error: { kind: "invalid", fieldErrors: {}, formError: "UPLOAD THE PDF AGAIN" },
    });

    expect(getSampleStore().reviewerPdfFiles[originalPath(first.value.id)]).toEqual(bytes);
    expect(getSampleStore().staffActivity.map(({ action }) => action)).toEqual(["upload"]);
  });
});

describe("recording a Reviewer PDF that can't be saved", () => {
  it("deletes the original it claimed, so no file is left that nothing records", async () => {
    const calls = reviewerPdfCalls({
      ...sampleReviewerPdfStore,
      add: async () => {
        throw new Error("The database is down.");
      },
    });
    const path = await uploadSampleReviewerPdf(pdfOfPages(2));

    await expect(calls.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).rejects.toThrow(
      "The database is down.",
    );

    expect(getSampleStore().reviewerPdfFiles).toEqual({});
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { MAX_PDF_BYTES } from "@/lib/reviewer-pdfs/job";
import { originalPath, pagePath } from "@/lib/reviewer-pdfs/paths";
import { NOT_A_PDF, PDF_TOO_BIG } from "@/lib/reviewer-pdfs/pdf-file";
import type { StaffActor } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import {
  createReviewerPdfUpload,
  readSampleUpload,
  receiveSampleUpload,
  sampleReviewerPdfFiles,
} from "@/services/uploads.mock";
import type { ReviewerPdfUploadTicket } from "@/services/uploads.types";

import { pdfOfPages } from "../../test/reviewer-pdfs";

// The upload seam's Reviewer PDF uploads in the sample data (Phase 3, ticket
// 12): an Editor's PDF goes to a one-time URL, as an import's files do, and
// the upload route never serves it; the Reviewer PDF's record claims it, and
// the job reads the original and stores the page images in the sample data's
// private Reviewer PDFs bucket. The Storage arm's are in uploads.storage.test.ts.

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const PDF = pdfOfPages(3);

async function upload(bytes: Uint8Array = PDF) {
  const created = await createReviewerPdfUpload(EDITOR, {
    contentType: "application/pdf",
    size: bytes.byteLength,
  });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  return created.value;
}

function urlParts(ticket: ReviewerPdfUploadTicket) {
  if (ticket.method !== "put") throw new Error("expected the sample data's one-time URL");
  const url = new URL(ticket.uploadUrl, "http://localhost");
  return { id: url.pathname.split("/").at(-1) ?? "", token: url.searchParams.get("token") ?? "" };
}

async function send(ticket: ReviewerPdfUploadTicket, bytes: Uint8Array = PDF) {
  const { id, token } = urlParts(ticket);
  return receiveSampleUpload(id, token, {
    contentType: "application/pdf",
    contentLength: bytes.byteLength,
    body: async () => bytes,
  });
}

beforeEach(() => {
  resetSampleStore();
});

describe("createReviewerPdfUpload (sample data)", () => {
  it("gives a one-time URL that takes the PDF once, and that never serves it back", async () => {
    const ticket = await upload();
    expect(ticket).toEqual({
      method: "put",
      uploadUrl: expect.stringMatching(/^\/api\/dev\/uploads\/[0-9a-f-]{36}\?token=.+$/),
      path: expect.stringMatching(/^uploads\/[0-9a-f-]{36}$/),
    });

    expect(await send(ticket)).toBe("stored");
    expect(await send(ticket)).toBe("already-uploaded");
    // The route's GET never gives a Reviewer PDF to a browser.
    expect(readSampleUpload(urlParts(ticket).id)).toBeNull();
  });

  it("refuses a file that doesn't start as a PDF", async () => {
    const notPdf = new TextEncoder().encode("not a PDF at all");
    expect(await send(await upload(notPdf), notPdf)).toBe("not-an-image");
  });

  it.each([
    ["a file that isn't a PDF", { contentType: "image/png", size: 100 }, "contentType", NOT_A_PDF],
    [
      "a PDF over 200 MB",
      { contentType: "application/pdf", size: MAX_PDF_BYTES + 1 },
      "size",
      PDF_TOO_BIG,
    ],
    ["an empty file", { contentType: "application/pdf", size: 0 }, "size", "THE FILE IS EMPTY"],
  ])("refuses %s before it's uploaded", async (_, request, field, message) => {
    expect(await createReviewerPdfUpload(EDITOR, request as never)).toEqual({
      ok: false,
      error: { kind: "invalid", fieldErrors: { [field]: [message] } },
    });
    expect(getSampleStore().uploads).toEqual({});
  });

  it("takes a PDF of exactly 200 MB", async () => {
    const created = await createReviewerPdfUpload(EDITOR, {
      contentType: "application/pdf",
      size: MAX_PDF_BYTES,
    });
    expect(created.ok).toBe(true);
  });

  it("refuses someone signed out", async () => {
    expect(
      await createReviewerPdfUpload(null, { contentType: "application/pdf", size: 10 }),
    ).toEqual({ ok: false, error: { kind: "forbidden", message: "SIGN IN TO UPLOAD FILES" } });
  });
});

describe("sampleReviewerPdfFiles", () => {
  it("files an uploaded PDF under a new Reviewer PDF, once", async () => {
    const ticket = await upload();
    await send(ticket);

    const claimed = await sampleReviewerPdfFiles.claimUpload(ticket.path);
    if (!claimed || claimed === "waiting") throw new Error("expected the upload to be claimed");
    expect(claimed).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), size: PDF.byteLength });
    expect(await sampleReviewerPdfFiles.readOriginal(claimed.id)).toEqual(PDF);
    // The upload is gone: it can't be claimed twice.
    expect(await sampleReviewerPdfFiles.claimUpload(ticket.path)).toBeNull();
  });

  it("waits for a PDF the browser hasn't sent, and knows nothing else", async () => {
    const ticket = await upload();
    expect(await sampleReviewerPdfFiles.claimUpload(ticket.path)).toBe("waiting");
    expect(await sampleReviewerPdfFiles.claimUpload("uploads/nothing-here")).toBeNull();
    expect(await sampleReviewerPdfFiles.claimUpload("somewhere/else.pdf")).toBeNull();
  });

  it("won't claim another kind of upload", async () => {
    const { createContentUpload } = await import("@/services/uploads.mock");
    const csv = await createContentUpload(EDITOR, { purpose: "import-csv", size: 5 });
    if (!csv.ok) throw new Error("expected a CSV upload");
    expect(await sampleReviewerPdfFiles.claimUpload(csv.value.path)).toBeNull();
  });

  it("stores page images, and removes the original with every page", async () => {
    const ticket = await upload();
    await send(ticket);
    const claimed = await sampleReviewerPdfFiles.claimUpload(ticket.path);
    if (!claimed || claimed === "waiting") throw new Error("expected the upload to be claimed");
    const image = new Uint8Array([1, 2, 3]);
    await sampleReviewerPdfFiles.putPage(claimed.id, 1, image);
    await sampleReviewerPdfFiles.putPage(claimed.id, 2, image);
    // A page put twice (a restarted run) is stored once, as the last one put.
    await sampleReviewerPdfFiles.putPage(claimed.id, 2, new Uint8Array([4]));
    expect(Object.keys(getSampleStore().reviewerPdfFiles).sort()).toEqual(
      [originalPath(claimed.id), pagePath(claimed.id, 1), pagePath(claimed.id, 2)].sort(),
    );
    expect(getSampleStore().reviewerPdfFiles[pagePath(claimed.id, 2)]).toEqual(new Uint8Array([4]));

    await sampleReviewerPdfFiles.remove(claimed.id, 2);
    expect(getSampleStore().reviewerPdfFiles).toEqual({});
    expect(await sampleReviewerPdfFiles.readOriginal(claimed.id)).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewerPdfUploadTicket } from "@/services/uploads.types";

import { sendReviewerPdf, TUS_CHUNK_BYTES } from "./send-reviewer-pdf";

// The browser's half of a Reviewer PDF upload (ticket 12): a resumable (TUS)
// upload straight to Storage, in the 6 MB pieces Supabase takes, or one PUT
// to the sample data's one-time URL. tus-js-client and putFile are replaced:
// what's checked is what they're asked to send, and where.

const { Upload, uploads, putFile } = vi.hoisted(() => {
  const uploads: { file: File; options: Record<string, unknown> & UploadCallbacks }[] = [];
  interface UploadCallbacks {
    onProgress?: (sent: number, total: number) => void;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
  }
  class Upload {
    constructor(
      readonly file: File,
      readonly options: Record<string, unknown> & UploadCallbacks,
    ) {
      uploads.push({ file, options });
    }
    start = vi.fn();
  }
  return { Upload, uploads, putFile: vi.fn() };
});
vi.mock("tus-js-client", () => ({ Upload }));
vi.mock("@/components/admin/products/put-file", () => ({ putFile }));

const FILE = new File(["%PDF-1.4"], "MSTC Reviewer.pdf", { type: "application/pdf" });

const TUS: ReviewerPdfUploadTicket = {
  method: "tus",
  endpoint: "https://abc.supabase.co/storage/v1/upload/resumable/sign",
  headers: { "x-signature": "token", apikey: "sb_publishable_x" },
  metadata: {
    bucketName: "reviewer-pdfs",
    objectName: "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21/original.pdf",
    contentType: "application/pdf",
    cacheControl: "3600",
  },
  path: "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21/original.pdf",
};

afterEach(() => {
  uploads.length = 0;
  vi.clearAllMocks();
});

describe("sendReviewerPdf", () => {
  it("sends a resumable upload to Storage, in 6 MB pieces, with the token and metadata", async () => {
    const progress = vi.fn();
    const sending = sendReviewerPdf(TUS, FILE, progress);

    const [upload] = uploads;
    if (!upload) throw new Error("expected an upload");
    expect(upload.file).toBe(FILE);
    expect(TUS_CHUNK_BYTES).toBe(6 * 1024 * 1024);
    expect(upload.options).toMatchObject({
      endpoint: TUS.endpoint,
      headers: TUS.headers,
      metadata: TUS.metadata,
      chunkSize: TUS_CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Each upload has its own path, so one can't pick up another's.
      storeFingerprintForResuming: false,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
    });

    upload.options.onProgress?.(3, 4);
    expect(progress).toHaveBeenCalledWith(0.75);
    upload.options.onProgress?.(0, 0);
    expect(progress).toHaveBeenCalledTimes(1);
    upload.options.onSuccess?.();
    await expect(sending).resolves.toBeUndefined();
  });

  it("rejects when the resumable upload gives up", async () => {
    const sending = sendReviewerPdf(TUS, FILE, () => {});
    uploads[0]?.options.onError?.(new Error("tus: unexpected response"));
    await expect(sending).rejects.toThrow("tus: unexpected response");
  });

  it("PUTs the PDF to the sample data's one-time URL", async () => {
    putFile.mockResolvedValue(undefined);
    const progress = vi.fn();

    await sendReviewerPdf(
      { method: "put", uploadUrl: "/api/dev/uploads/x?token=t", path: "uploads/x" },
      FILE,
      progress,
    );

    expect(putFile).toHaveBeenCalledWith(
      "/api/dev/uploads/x?token=t",
      FILE,
      progress,
      "application/pdf",
    );
    expect(uploads).toEqual([]);
  });
});

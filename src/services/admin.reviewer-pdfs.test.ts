import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PDF_BYTES,
  MAX_RESTARTS,
  PAGES_PER_RUN,
  STALE_AFTER_MS,
} from "@/lib/reviewer-pdfs/job";
import { originalPath, pagePath } from "@/lib/reviewer-pdfs/paths";
import type { AdminReviewerPdf, StaffActor } from "@/services/admin.types";
import { createFakeRenderer } from "@/services/page-images.fake";
import type { PdfRenderer } from "@/services/page-images.types";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { pdfOfPages, reviewerPdfFixture } from "../../test/reviewer-pdfs";

// The Admin seam's Reviewer PDFs (Phase 3, ticket 12; stories 114, 115; spec,
// Phase 3 planning decisions → The Reviewer PDF job): an Editor's upload is
// recorded as Processing, a chain of runs splits it into page images, 25
// pages a run, through the page-images interface (the fake renderer here),
// and it ends a Draft, or Failed with the fix to try. The cron restarts a job
// whose runs have stopped, and fails it after too many restarts. Deleting
// removes the original and every page image. Run against each arm.

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};
const OWNER: StaffActor = { email: "owner@aceyourcourse.ph", name: "AYC Owner", role: "owner" };

const START = new Date("2026-11-18T08:00:00.000Z");
const renderer = createFakeRenderer();

/** A renderer that renders as the fake does, noting each page it's asked for. */
function watchedRenderer(pages: number[], { dieAt }: { dieAt?: number } = {}): PdfRenderer {
  return {
    async open(bytes) {
      const opened = await renderer.open(bytes);
      if (!opened.ok) return opened;
      return {
        ok: true,
        pdf: {
          ...opened.pdf,
          async renderPage(page) {
            // The server dies halfway: not a problem with the PDF.
            if (page === dieAt) throw new Error("The function ran out of time.");
            pages.push(page);
            return opened.pdf.renderPage(page);
          },
        },
      };
    },
  };
}

describe.each(ADMIN_ARMS)("Reviewer PDFs ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: START });
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Uploads a PDF and records it, as the Reviewer PDFs screen does. */
  async function uploaded(
    bytes: Uint8Array = pdfOfPages(3),
    { actor = EDITOR, fileName = "MSTC Reviewer.pdf" } = {},
  ): Promise<AdminReviewerPdf> {
    const path = await arm.uploadReviewerPdf(bytes);
    const result = await seam.recordReviewerPdf(actor, { path, fileName });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    return result.value;
  }

  async function listed(id: string) {
    return (await seam.listReviewerPdfsForAdmin(EDITOR)).find((pdf) => pdf.id === id);
  }

  /** Runs the job until it stops asking for another run, as the chain of runs does. */
  async function runToTheEnd(id: string, using: PdfRenderer = renderer) {
    const runs = [];
    for (let run = 0; run < 50; run++) {
      const outcome = await seam.runReviewerPdfJob(id, using);
      runs.push(outcome);
      if (outcome !== "more") return runs;
    }
    throw new Error("The job never finished");
  }

  const later = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));

  describe("an upload", () => {
    it("is recorded as Processing, with its file's name and size, in Staff Activity", async () => {
      const bytes = pdfOfPages(3);
      const path = await arm.uploadReviewerPdf(bytes);

      const result = await seam.recordReviewerPdf(EDITOR, {
        path,
        fileName: " MSTC Reviewer.pdf ",
      });

      if (!result.ok) throw new Error(JSON.stringify(result.error));
      const pdf = result.value;
      expect(pdf).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: "processing",
        placement: null,
        upload: {
          fileName: "MSTC Reviewer.pdf",
          fileSize: bytes.byteLength,
          uploadedAt: START.toISOString(),
          pageCount: null,
          pagesDone: 0,
          heartbeatAt: START.toISOString(),
          restarts: 0,
          failure: null,
        },
      });
      expect(result.tags).toEqual([]);
      expect(await listed(pdf.id)).toEqual(pdf);
      // The original is filed under the Reviewer PDF.
      expect(await arm.reviewerPdfFile(originalPath(pdf.id))).toEqual(bytes);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "reviewer-pdf",
          entityId: pdf.id,
          action: "upload",
          before: null,
          after: { fileName: "MSTC Reviewer.pdf", fileSize: bytes.byteLength },
        }),
      ]);
    });

    it("can be an Owner's too", async () => {
      const pdf = await uploaded(pdfOfPages(1), { actor: OWNER });
      expect((await arm.staffActivity()).at(-1)).toMatchObject({
        actor: { email: OWNER.email },
        entityId: pdf.id,
        action: "upload",
      });
    });

    it("is listed newest first, before the sample data's Reviewer PDFs", async () => {
      const first = await uploaded(pdfOfPages(1), { fileName: "first.pdf" });
      later(1000);
      const second = await uploaded(pdfOfPages(1), { fileName: "second.pdf" });

      const list = await seam.listReviewerPdfsForAdmin(EDITOR);
      expect(list.slice(0, 2).map((pdf) => pdf.id)).toEqual([second.id, first.id]);
      // The sample data's, from before uploads: placed under their Topics, with no file.
      expect(list.slice(2).length).toBeGreaterThan(0);
      for (const pdf of list.slice(2)) {
        expect(pdf.upload).toBeNull();
        expect(pdf.placement).toEqual({
          examCode: expect.any(String),
          subjectCode: expect.any(String),
          topicName: expect.any(String),
        });
      }
    });

    it("is refused while the PDF hasn't finished uploading, recording nothing", async () => {
      const path = await arm.uploadReviewerPdf(pdfOfPages(1), { send: false });
      const before = await seam.listReviewerPdfsForAdmin(EDITOR);

      expect(await seam.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "THE PDF HASN’T FINISHED UPLOADING · UPLOAD IT AGAIN",
        },
      });
      expect(await seam.listReviewerPdfsForAdmin(EDITOR)).toEqual(before);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it.each([
      ["isn't an upload", "uploads/not-one"],
      ["is a Reviewer PDF's page", "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21/pages/1.webp"],
    ])("is refused at a path that %s", async (_, path) => {
      expect(await seam.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "UPLOAD THE PDF AGAIN" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("can't be recorded twice, and the second try leaves the first one's file alone", async () => {
      const bytes = pdfOfPages(1);
      const path = await arm.uploadReviewerPdf(bytes);
      const first = await seam.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" });
      if (!first.ok) throw new Error("expected the upload to be recorded");

      // The same request, sent again.
      expect(await seam.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).toMatchObject({
        ok: false,
        error: { formError: "UPLOAD THE PDF AGAIN" },
      });
      expect(await arm.reviewerPdfFile(originalPath(first.value.id))).toEqual(bytes);
      expect(await listed(first.value.id)).toEqual(first.value);
      expect((await arm.staffActivity()).map(({ action }) => action)).toEqual(["upload"]);
    });

    it("records nothing when its record can't be saved", async () => {
      const path = await arm.uploadReviewerPdf(pdfOfPages(1));
      const before = await seam.listReviewerPdfsForAdmin(EDITOR);
      const mend = await arm.breakStaffActivity();
      try {
        await expect(seam.recordReviewerPdf(EDITOR, { path, fileName: "a.pdf" })).rejects.toThrow();
      } finally {
        await mend();
      }
      expect(await seam.listReviewerPdfsForAdmin(EDITOR)).toEqual(before);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("keeps a long file name to 200 characters, and names a nameless one", async () => {
      const long = await uploaded(pdfOfPages(1), { fileName: `${"x".repeat(300)}.pdf` });
      expect(long.upload?.fileName).toBe("x".repeat(200));
      const nameless = await uploaded(pdfOfPages(1), { fileName: "   " });
      expect(nameless.upload?.fileName).toBe("Reviewer PDF");
    });

    it("is refused without a path", async () => {
      expect(await seam.recordReviewerPdf(EDITOR, { fileName: "a.pdf" } as never)).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });
  });

  describe("the job", () => {
    it("splits a 3-page PDF into 3 page images, and ends a Draft", async () => {
      const pdf = await uploaded(pdfOfPages(3));

      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("done");

      expect(await listed(pdf.id)).toMatchObject({
        status: "draft",
        upload: { pageCount: 3, pagesDone: 3, failure: null, heartbeatAt: START.toISOString() },
      });
      for (const page of [1, 2, 3]) {
        expect(await arm.reviewerPdfFile(pagePath(pdf.id, page))).not.toBeNull();
      }
      expect(await arm.reviewerPdfFile(pagePath(pdf.id, 4))).toBeNull();
      // The job is no Staff User's change.
      expect((await arm.staffActivity()).map((record) => record.action)).toEqual(["upload"]);
    });

    it("renders 25 pages a run, each run carrying on from the page after the last", async () => {
      expect(PAGES_PER_RUN).toBe(25);
      const pdf = await uploaded(pdfOfPages(60));
      const pages: number[] = [];

      expect(await seam.runReviewerPdfJob(pdf.id, watchedRenderer(pages))).toBe("more");
      expect(await listed(pdf.id)).toMatchObject({
        status: "processing",
        upload: { pageCount: 60, pagesDone: 25 },
      });
      expect(await runToTheEnd(pdf.id, watchedRenderer(pages))).toEqual(["more", "done"]);

      // Every page once, in order: none repeated, none skipped.
      expect(pages).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
      expect(await listed(pdf.id)).toMatchObject({
        status: "draft",
        upload: { pageCount: 60, pagesDone: 60 },
      });
      expect(await arm.reviewerPdfFile(pagePath(pdf.id, 60))).not.toBeNull();
    });

    it("resumes a run that died halfway at the page it died on, without repeating or skipping one", async () => {
      const pdf = await uploaded(pdfOfPages(40));
      const pages: number[] = [];

      await expect(
        seam.runReviewerPdfJob(pdf.id, watchedRenderer(pages, { dieAt: 10 })),
      ).rejects.toThrow("The function ran out of time.");
      expect(await listed(pdf.id)).toMatchObject({
        status: "processing",
        upload: { pagesDone: 9, failure: null },
      });
      expect(await arm.reviewerPdfFile(pagePath(pdf.id, 10))).toBeNull();

      // Pages 10 to 34, then 35 to 40.
      expect(await runToTheEnd(pdf.id, watchedRenderer(pages))).toEqual(["more", "done"]);
      expect(pages).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
      expect(await listed(pdf.id)).toMatchObject({ status: "draft", upload: { pagesDone: 40 } });
    });

    it("fails a password-protected PDF with its fix, and renders nothing", async () => {
      const pdf = await uploaded(reviewerPdfFixture("password"));

      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("failed");

      expect(await listed(pdf.id)).toMatchObject({
        status: "failed",
        upload: { failure: "password", pageCount: null, pagesDone: 0 },
      });
      expect(await arm.reviewerPdfFile(pagePath(pdf.id, 1))).toBeNull();
    });

    it("fails a corrupt PDF as unreadable", async () => {
      const pdf = await uploaded(reviewerPdfFixture("corrupt"));
      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("failed");
      expect(await listed(pdf.id)).toMatchObject({
        status: "failed",
        upload: { failure: "corrupt" },
      });
    });

    it("fails a PDF over 200 MB without reading it", async () => {
      const pdf = await uploaded(pdfOfPages(2));
      await arm.setReviewerPdfUpload(pdf.id, { fileSize: MAX_PDF_BYTES + 1 });
      const opened = vi.fn();

      expect(await seam.runReviewerPdfJob(pdf.id, { open: opened })).toBe("failed");

      expect(opened).not.toHaveBeenCalled();
      expect(await listed(pdf.id)).toMatchObject({
        status: "failed",
        upload: { failure: "too-big" },
      });
    });

    it("fails one whose original is gone as unreadable", async () => {
      const pdf = await uploaded(pdfOfPages(2));
      await arm.reviewerPdfFiles.remove(pdf.id, 0);

      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("failed");
      expect(await listed(pdf.id)).toMatchObject({ upload: { failure: "corrupt" } });
    });

    it("fails one whose file no longer has the pages it counted", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      await arm.setReviewerPdfUpload(pdf.id, { pageCount: 5 });

      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("failed");
      expect(await listed(pdf.id)).toMatchObject({ upload: { failure: "corrupt", pagesDone: 0 } });
    });

    it("fails a page pdf.js can't draw with the PDF's problem", async () => {
      const { PdfProblemError } = await import("@/services/page-images.types");
      const pdf = await uploaded(pdfOfPages(5));
      const breaking: PdfRenderer = {
        async open(bytes) {
          const opened = await renderer.open(bytes);
          if (!opened.ok) return opened;
          return {
            ok: true,
            pdf: {
              ...opened.pdf,
              async renderPage(page) {
                if (page === 3) throw new PdfProblemError("corrupt");
                return opened.pdf.renderPage(page);
              },
            },
          };
        },
      };

      expect(await seam.runReviewerPdfJob(pdf.id, breaking)).toBe("failed");
      expect(await listed(pdf.id)).toMatchObject({
        status: "failed",
        upload: { failure: "corrupt", pagesDone: 2 },
      });
    });

    it("does nothing for a Draft, a failed one, a deleted one or one that was never uploaded", async () => {
      const draft = await uploaded(pdfOfPages(1));
      await seam.runReviewerPdfJob(draft.id, renderer);
      const failed = await uploaded(reviewerPdfFixture("corrupt"));
      await seam.runReviewerPdfJob(failed.id, renderer);
      const sampleOne = (await seam.listReviewerPdfsForAdmin(EDITOR)).find((pdf) => !pdf.upload);
      if (!sampleOne) throw new Error("expected the sample data's Reviewer PDFs");
      const opened = vi.fn();

      for (const id of [draft.id, failed.id, sampleOne.id, crypto.randomUUID(), "not-an-id"]) {
        expect(await seam.runReviewerPdfJob(id, { open: opened })).toBe("stopped");
      }
      expect(opened).not.toHaveBeenCalled();
    });

    it("stops a run in flight when its Reviewer PDF is deleted, leaving no page behind", async () => {
      const pdf = await uploaded(pdfOfPages(5));
      const deleting: PdfRenderer = {
        async open(bytes) {
          const opened = await renderer.open(bytes);
          if (!opened.ok) return opened;
          return {
            ok: true,
            pdf: {
              ...opened.pdf,
              async renderPage(page) {
                // An Editor deletes it while page 2 renders.
                if (page === 2) await seam.deleteReviewerPdf(EDITOR, pdf.id);
                return opened.pdf.renderPage(page);
              },
            },
          };
        },
      };

      expect(await seam.runReviewerPdfJob(pdf.id, deleting)).toBe("stopped");

      expect(await listed(pdf.id)).toBeUndefined();
      for (const path of [originalPath(pdf.id), pagePath(pdf.id, 1), pagePath(pdf.id, 2)]) {
        expect(await arm.reviewerPdfFile(path)).toBeNull();
      }
    });

    it("stops a second run on the same pages, so no page is done twice", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      // Another run finishes page 1 while this one renders it.
      const racing: PdfRenderer = {
        async open(bytes) {
          const opened = await renderer.open(bytes);
          if (!opened.ok) return opened;
          let raced = false;
          return {
            ok: true,
            pdf: {
              ...opened.pdf,
              async renderPage(page) {
                if (!raced) {
                  raced = true;
                  await seam.runReviewerPdfJob(pdf.id, renderer);
                }
                return opened.pdf.renderPage(page);
              },
            },
          };
        },
      };

      expect(await seam.runReviewerPdfJob(pdf.id, racing)).toBe("stopped");
      expect(await listed(pdf.id)).toMatchObject({ status: "draft", upload: { pagesDone: 3 } });
    });
  });

  describe("the cron", () => {
    it("restarts a job whose heartbeat has gone stale, counting the restart", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      later(STALE_AFTER_MS);

      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({
        restarted: [pdf.id],
        failed: [],
      });

      expect(await listed(pdf.id)).toMatchObject({
        status: "processing",
        upload: { restarts: 1, heartbeatAt: new Date(Date.now()).toISOString() },
      });
      // Restarted just now, it's fresh again.
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
      // And the restarted run carries on.
      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("done");
    });

    it("leaves a job alone while its heartbeat is fresh", async () => {
      await uploaded(pdfOfPages(3));
      later(STALE_AFTER_MS - 1);
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
    });

    it("keeps a job beating while its runs go on", async () => {
      const pdf = await uploaded(pdfOfPages(60));
      later(STALE_AFTER_MS - 1);
      await seam.runReviewerPdfJob(pdf.id, renderer);
      later(STALE_AFTER_MS - 1);
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
    });

    it("beats as a run starts, before it reads the PDF", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      later(STALE_AFTER_MS - 1);

      await expect(
        seam.runReviewerPdfJob(pdf.id, watchedRenderer([], { dieAt: 1 })),
      ).rejects.toThrow("The function ran out of time.");

      expect(await listed(pdf.id)).toMatchObject({
        upload: { pagesDone: 0, heartbeatAt: new Date(Date.now()).toISOString() },
      });
      later(STALE_AFTER_MS - 1);
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
    });

    it("starts the restart count again once a page is done, so a long PDF's stops never add up", async () => {
      const pdf = await uploaded(pdfOfPages(60));
      for (let restart = 1; restart <= MAX_RESTARTS; restart++) {
        later(STALE_AFTER_MS);
        await seam.restartStaleReviewerPdfJobs();
      }
      expect(await listed(pdf.id)).toMatchObject({ upload: { restarts: MAX_RESTARTS } });

      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("more");
      expect(await listed(pdf.id)).toMatchObject({ upload: { restarts: 0, pagesDone: 25 } });
      later(STALE_AFTER_MS);
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({
        restarted: [pdf.id],
        failed: [],
      });
    });

    it("fails a job with too many restarts in a row, with its fix", async () => {
      expect(MAX_RESTARTS).toBe(3);
      const pdf = await uploaded(pdfOfPages(3));
      for (let restart = 1; restart <= MAX_RESTARTS; restart++) {
        later(STALE_AFTER_MS);
        expect(await seam.restartStaleReviewerPdfJobs()).toEqual({
          restarted: [pdf.id],
          failed: [],
        });
      }
      later(STALE_AFTER_MS);

      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({
        restarted: [],
        failed: [pdf.id],
      });
      expect(await listed(pdf.id)).toMatchObject({
        status: "failed",
        upload: { failure: "too-many-restarts", restarts: MAX_RESTARTS },
      });
      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("stopped");
    });

    it("never restarts a Draft or a failed one", async () => {
      const draft = await uploaded(pdfOfPages(1));
      await seam.runReviewerPdfJob(draft.id, renderer);
      const failed = await uploaded(reviewerPdfFixture("password"));
      await seam.runReviewerPdfJob(failed.id, renderer);
      later(STALE_AFTER_MS * 10);

      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
    });

    it("restarts a job that never beat, as when its first run never started", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      await arm.setReviewerPdfUpload(pdf.id, { heartbeatAt: null });
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({
        restarted: [pdf.id],
        failed: [],
      });
    });
  });

  describe("deleting", () => {
    it("removes a Draft with its original and every page image, in Staff Activity", async () => {
      const pdf = await uploaded(pdfOfPages(3));
      await seam.runReviewerPdfJob(pdf.id, renderer);

      const result = await seam.deleteReviewerPdf(EDITOR, pdf.id);

      if (!result.ok) throw new Error(JSON.stringify(result.error));
      expect(result.value).toMatchObject({ id: pdf.id, status: "draft" });
      expect(result.tags).toEqual([]);
      expect(await listed(pdf.id)).toBeUndefined();
      for (const path of [originalPath(pdf.id), ...[1, 2, 3].map((n) => pagePath(pdf.id, n))]) {
        expect(await arm.reviewerPdfFile(path)).toBeNull();
      }
      expect((await arm.staffActivity()).at(-1)).toEqual(
        expect.objectContaining({
          entity: "reviewer-pdf",
          entityId: pdf.id,
          action: "delete",
          before: { fileName: "MSTC Reviewer.pdf", status: "draft", pageCount: 3, placement: null },
          after: null,
        }),
      );
      // Its job is gone too: no run or restart finds it.
      expect(await seam.runReviewerPdfJob(pdf.id, renderer)).toBe("stopped");
    });

    it("removes one still Processing, and a failed one, as an Owner too", async () => {
      const processing = await uploaded(pdfOfPages(3));
      const failed = await uploaded(reviewerPdfFixture("corrupt"));
      await seam.runReviewerPdfJob(failed.id, renderer);

      expect((await seam.deleteReviewerPdf(EDITOR, processing.id)).ok).toBe(true);
      expect((await seam.deleteReviewerPdf(OWNER, failed.id)).ok).toBe(true);
      expect(await arm.reviewerPdfFile(originalPath(processing.id))).toBeNull();
      expect(await arm.reviewerPdfFile(originalPath(failed.id))).toBeNull();
      later(STALE_AFTER_MS);
      expect(await seam.restartStaleReviewerPdfJobs()).toEqual({ restarted: [], failed: [] });
    });

    it("refuses one that isn't there, recording nothing", async () => {
      expect(await seam.deleteReviewerPdf(EDITOR, crypto.randomUUID())).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.deleteReviewerPdf(EDITOR, "not-an-id")).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });
});

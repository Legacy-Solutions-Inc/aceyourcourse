import { describe, expect, it, vi } from "vitest";

import { hasFileSignature } from "@/lib/file-signature";
import { createFakeRenderer, FAKE_PAGE_IMAGE, fakeStamper } from "@/services/page-images.fake";

import { pdfOfPages, reviewerPdfFixture } from "../../test/reviewer-pdfs";

// The fake page renderer (ticket 12), which the seam tests, the sample data
// and the e2e run use in place of pdf.js: it reads a PDF's page count from its
// page objects, and "renders" each page as the same small WebP.

const renderer = createFakeRenderer();

describe("the fake page renderer", () => {
  it("opens a PDF with its page count and renders each page as a WebP image", async () => {
    const opened = await renderer.open(pdfOfPages(4));
    if (!opened.ok) throw new Error("expected the PDF to open");
    expect(opened.pdf.pageCount).toBe(4);
    for (const page of [1, 4]) {
      expect(hasFileSignature(await opened.pdf.renderPage(page), "image/webp")).toBe(true);
    }
    await opened.pdf.close();
  });

  it("refuses a page the PDF doesn't have", async () => {
    const opened = await renderer.open(pdfOfPages(2));
    if (!opened.ok) throw new Error("expected the PDF to open");
    await expect(opened.pdf.renderPage(0)).rejects.toThrow(RangeError);
    await expect(opened.pdf.renderPage(3)).rejects.toThrow(RangeError);
  });

  it("reads the fixtures as pdf.js does", async () => {
    const three = await renderer.open(reviewerPdfFixture("three-pages"));
    expect(three.ok && three.pdf.pageCount).toBe(3);
    expect(await renderer.open(reviewerPdfFixture("password"))).toEqual({
      ok: false,
      problem: "password",
    });
    expect(await renderer.open(reviewerPdfFixture("corrupt"))).toEqual({
      ok: false,
      problem: "corrupt",
    });
  });

  it("finds a password-protected PDF, and a file that isn't a PDF or has no pages", async () => {
    expect(await renderer.open(pdfOfPages(3, { encrypted: true }))).toEqual({
      ok: false,
      problem: "password",
    });
    expect(await renderer.open(new TextEncoder().encode("not a PDF"))).toEqual({
      ok: false,
      problem: "corrupt",
    });
    expect(await renderer.open(pdfOfPages(0))).toEqual({ ok: false, problem: "corrupt" });
  });

  it("takes its time over each page when asked, as the sample data's does", async () => {
    vi.useFakeTimers();
    try {
      const slow = createFakeRenderer({ msPerPage: 500 });
      const opened = await slow.open(pdfOfPages(1));
      if (!opened.ok) throw new Error("expected the PDF to open");
      let done = false;
      const rendering = opened.pdf.renderPage(1).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rendering;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the fake stamper", () => {
  it("gives the page's bytes, then whose stamp it carries", async () => {
    const stamped = await fakeStamper.stamp(FAKE_PAGE_IMAGE, {
      email: "tester@example.com",
      memberId: "3F1A5C2E",
    });
    expect(stamped.slice(0, FAKE_PAGE_IMAGE.byteLength)).toEqual(FAKE_PAGE_IMAGE);
    expect(new TextDecoder().decode(stamped.slice(FAKE_PAGE_IMAGE.byteLength))).toBe(
      " STAMPED tester@example.com · 3F1A5C2E",
    );
  });
});

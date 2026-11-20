// @vitest-environment node
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import { hasFileSignature } from "@/lib/file-signature";
import { PAGE_WIDTH } from "@/lib/reviewer-pdfs/job";
import { pdfjsRenderer } from "@/services/page-images.pdfjs";
import { PdfProblemError } from "@/services/page-images.types";

import { reviewerPdfFixture } from "../../test/reviewer-pdfs";

// The real page renderer (ticket 12): pdf.js on a server-side canvas, on the
// tiny fixture PDFs (test/fixtures/reviewer-pdfs). Node, not jsdom: it's how
// the server runs it.

describe("the pdf.js page renderer", () => {
  it("renders the 3-page fixture as 3 WebP page images 1600 px wide", async () => {
    const opened = await pdfjsRenderer.open(reviewerPdfFixture("three-pages"));
    if (!opened.ok) throw new Error(`expected the PDF to open, got ${opened.problem}`);
    try {
      expect(opened.pdf.pageCount).toBe(3);
      const images = [];
      for (const page of [1, 2, 3]) images.push(await opened.pdf.renderPage(page));
      for (const image of images) {
        expect(hasFileSignature(image, "image/webp")).toBe(true);
        const picture = await loadImage(Buffer.from(image));
        expect(PAGE_WIDTH).toBe(1600);
        expect(picture.width).toBe(PAGE_WIDTH);
        // A US Letter page, 8.5 × 11 in.
        expect(picture.height).toBe(Math.round((PAGE_WIDTH * 11) / 8.5));
      }
      // Each page is its own picture: "Page 1", "Page 2" and "Page 3".
      expect(new Set(images.map((image) => Buffer.from(image).toString("base64"))).size).toBe(3);
    } finally {
      await opened.pdf.close();
    }
  });

  it("draws the page's text and colours, on a white page", async () => {
    const opened = await pdfjsRenderer.open(reviewerPdfFixture("three-pages"));
    if (!opened.ok) throw new Error("expected the PDF to open");
    try {
      const picture = await loadImage(Buffer.from(await opened.pdf.renderPage(1)));
      const canvas = createCanvas(picture.width, picture.height);
      const context = canvas.getContext("2d");
      context.drawImage(picture, 0, 0);
      const at = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
      // The margin is white; the fixture's pale blue box fills the middle.
      const near = (actual: number[], expected: number[]) =>
        actual.every((value, index) => Math.abs(value - (expected[index] ?? 0)) <= 8);
      expect(near(at(20, 20), [255, 255, 255])).toBe(true);
      expect(near(at(400, 300), [217, 230, 255])).toBe(true);
      // Somewhere in the band of text, a dark glyph.
      const row = Math.round(picture.height * (1 - 400 / 792)) - 20;
      const dark = Array.from({ length: 800 }, (_, i) => at(500 + i, row)).some((pixel) =>
        pixel.every((value) => value < 80),
      );
      expect(dark).toBe(true);
    } finally {
      await opened.pdf.close();
    }
  });

  it("fails the password-protected fixture as needing a password", async () => {
    expect(await pdfjsRenderer.open(reviewerPdfFixture("password"))).toEqual({
      ok: false,
      problem: "password",
    });
  });

  it("fails the corrupt fixture as unreadable", async () => {
    expect(await pdfjsRenderer.open(reviewerPdfFixture("corrupt"))).toEqual({
      ok: false,
      problem: "corrupt",
    });
    expect(await pdfjsRenderer.open(new Uint8Array(0))).toEqual({
      ok: false,
      problem: "corrupt",
    });
  });

  it("refuses a page the PDF doesn't have", async () => {
    const opened = await pdfjsRenderer.open(reviewerPdfFixture("three-pages"));
    if (!opened.ok) throw new Error("expected the PDF to open");
    try {
      await expect(opened.pdf.renderPage(4)).rejects.toThrow(RangeError);
      await expect(opened.pdf.renderPage(0)).rejects.toThrow(RangeError);
    } finally {
      await opened.pdf.close();
    }
  });

  it("names a page pdf.js can't draw as a problem with the PDF", () => {
    expect(new PdfProblemError("corrupt").problem).toBe("corrupt");
  });
});

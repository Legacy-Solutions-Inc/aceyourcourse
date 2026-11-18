import { describe, expect, it } from "vitest";

import { MAX_PDF_BYTES } from "./job";
import {
  EMPTY_FILE,
  fileSizeLabel,
  isPdfFile,
  NOT_A_PDF,
  PDF_TOO_BIG,
  pdfFileProblem,
} from "./pdf-file";

// What the browser checks before it uploads a Reviewer PDF (ticket 12).

describe("pdfFileProblem", () => {
  it("takes a PDF of up to 200 MB", () => {
    expect(pdfFileProblem({ name: "MSTC.pdf", type: "application/pdf", size: 1 })).toBeNull();
    expect(
      pdfFileProblem({ name: "MSTC.pdf", type: "application/pdf", size: MAX_PDF_BYTES }),
    ).toBeNull();
  });

  it("refuses a file that isn't a PDF", () => {
    expect(pdfFileProblem({ name: "photo.png", type: "image/png", size: 10 })).toBe(NOT_A_PDF);
    expect(pdfFileProblem({ name: "notes.pdf.zip", type: "", size: 10 })).toBe(NOT_A_PDF);
  });

  it("refuses a PDF over 200 MB, and an empty one", () => {
    expect(
      pdfFileProblem({ name: "big.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }),
    ).toBe(PDF_TOO_BIG);
    expect(pdfFileProblem({ name: "empty.pdf", type: "application/pdf", size: 0 })).toBe(
      EMPTY_FILE,
    );
  });
});

describe("isPdfFile", () => {
  it("knows a PDF by its type, or by its name when the browser gives no type it knows", () => {
    expect(isPdfFile({ name: "a", type: "application/pdf" })).toBe(true);
    expect(isPdfFile({ name: "a", type: "application/x-pdf" })).toBe(true);
    expect(isPdfFile({ name: "Reviewer.PDF", type: "" })).toBe(true);
    expect(isPdfFile({ name: "reviewer.pdf", type: "application/octet-stream" })).toBe(true);
    expect(isPdfFile({ name: "reviewer.pdf", type: "text/plain" })).toBe(false);
  });
});

describe("fileSizeLabel", () => {
  it("gives megabytes to one place, and kilobytes under 1 MB", () => {
    expect(fileSizeLabel(14.24 * 1024 * 1024)).toBe("14.2 MB");
    expect(fileSizeLabel(MAX_PDF_BYTES)).toBe("200 MB");
    expect(fileSizeLabel(1024 * 1024)).toBe("1 MB");
    expect(fileSizeLabel(312 * 1024)).toBe("312 KB");
    expect(fileSizeLabel(100)).toBe("1 KB");
  });
});

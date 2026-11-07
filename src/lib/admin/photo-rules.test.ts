import { describe, expect, it } from "vitest";

import {
  failedPhoto,
  movePhoto,
  pendingPhoto,
  photoCaption,
  photoFileRefusal,
  photoSizeWarning,
  photoState,
  photoUploadBlocker,
  uploadKeyOf,
} from "./photo-rules";

// The photo strip's rules (spec, Phase 2 → Products: Photos; BUILD-MAP §3.3):
// JPEG, PNG or WebP up to 10 MB, refused before upload with the file named; a
// warning, not a block, below 1000 × 1000 or when not square.
const MB = 1024 * 1024;

describe("photoFileRefusal", () => {
  it.each([
    ["image/jpeg", "cover.jpg"],
    ["image/png", "cover.png"],
    ["image/webp", "cover.webp"],
  ])("accepts a %s", (type, name) => {
    expect(photoFileRefusal({ name, type, size: 2 * MB })).toBeNull();
  });

  it("accepts a file of exactly 10 MB", () => {
    expect(photoFileRefusal({ name: "big.jpg", type: "image/jpeg", size: 10 * MB })).toBeNull();
  });

  it.each([
    ["image/gif", "spin.gif"],
    ["image/svg+xml", "logo.svg"],
    ["", "notes"],
    ["application/pdf", "scan.pdf"],
  ])("refuses a %s, naming the file", (type, name) => {
    expect(photoFileRefusal({ name, type, size: MB })).toBe(
      `“${name}” isn’t a JPEG, PNG or WebP image.`,
    );
  });

  it("refuses a file over 10 MB, naming it", () => {
    expect(photoFileRefusal({ name: "huge.png", type: "image/png", size: 12 * MB })).toBe(
      "“huge.png” is over 10 MB.",
    );
  });

  it("refuses an empty file, naming it", () => {
    expect(photoFileRefusal({ name: "empty.png", type: "image/png", size: 0 })).toBe(
      "“empty.png” is empty.",
    );
  });
});

describe("photoSizeWarning", () => {
  it("has nothing to say about a square photo of at least 1000 × 1000", () => {
    expect(photoSizeWarning({ width: 1000, height: 1000 })).toBeNull();
    expect(photoSizeWarning({ width: 2400, height: 2400 })).toBeNull();
  });

  it("warns below 1000 × 1000", () => {
    expect(photoSizeWarning({ width: 900, height: 900 })).toBe("900 × 900 · BELOW 1000 × 1000");
  });

  it("warns when it isn't square", () => {
    expect(photoSizeWarning({ width: 1600, height: 1200 })).toBe("1600 × 1200 · NOT SQUARE");
  });

  it("warns of both", () => {
    expect(photoSizeWarning({ width: 1200, height: 800 })).toBe(
      "1200 × 800 · BELOW 1000 × 1000 · NOT SQUARE",
    );
  });
});

describe("photoCaption", () => {
  it("counts the photos, and says they can be reordered", () => {
    expect(photoCaption(8)).toBe("8 photos · drag to reorder");
    expect(photoCaption(1)).toBe("1 photo · drag to reorder");
  });

  it("says what works best when there are none", () => {
    expect(photoCaption(0)).toBe("Add photos. Square images work best, at least 1000 × 1000.");
  });
});

describe("movePhoto", () => {
  it("moves a photo to another place, the others keeping their order", () => {
    expect(movePhoto(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(movePhoto(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(movePhoto(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });

  it("leaves the order as it is for a move off either end, or nowhere", () => {
    expect(movePhoto(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(movePhoto(["a", "b"], 1, 2)).toEqual(["a", "b"]);
    expect(movePhoto(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(movePhoto(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("photoUploadBlocker", () => {
  const SAVED = "/products/ce-formula-flash-cards/1.webp";
  const UPLOADED = "uploads/0b6f";

  it("lets saved photos and finished uploads be saved", () => {
    expect(photoUploadBlocker([SAVED, UPLOADED])).toBeNull();
    expect(photoUploadBlocker([])).toBeNull();
  });

  it("waits for an upload on its way, even beside a failed one", () => {
    expect(photoUploadBlocker([SAVED, pendingPhoto("1")])).toBe("Wait for uploads to finish.");
    expect(photoUploadBlocker([failedPhoto("2"), pendingPhoto("1")])).toBe(
      "Wait for uploads to finish.",
    );
  });

  it("asks for a failed upload to be tried again or removed", () => {
    expect(photoUploadBlocker([UPLOADED, failedPhoto("2")])).toBe(
      "An upload failed. Try it again, or remove it.",
    );
  });
});

describe("uploadKeyOf", () => {
  it("finds the upload a pending or failed photo stands for", () => {
    expect(uploadKeyOf(pendingPhoto("7"))).toBe("7");
    expect(uploadKeyOf(failedPhoto("7"))).toBe("7");
  });

  it("is null for a saved photo or a finished upload", () => {
    expect(uploadKeyOf("/products/a/1.webp")).toBeNull();
    expect(uploadKeyOf("uploads/0b6f")).toBeNull();
  });
});

describe("photoState", () => {
  it("tells an upload on its way, a failed one, and a photo that can be saved apart", () => {
    expect(photoState(pendingPhoto("1"))).toBe("pending");
    expect(photoState(failedPhoto("1"))).toBe("failed");
    expect(photoState("uploads/0b6f")).toBe("ready");
    expect(photoState("/products/a/1.webp")).toBe("ready");
  });
});

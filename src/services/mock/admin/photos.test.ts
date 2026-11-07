import { beforeEach, describe, expect, it } from "vitest";

import { getSampleStore, resetSampleStore, withStandInStore } from "@/services/mock/sample-store";
import type { UploadLookup } from "@/services/uploads.types";

import { uploadSamplePhoto } from "../../../../test/sample-photo";
import { resolveProductPhotos, uploadAt } from "./photos";

// What a save finds at an upload's path. The sample arm looks in its own
// uploads; the Admin's database arm runs the same area code over a store
// that carries Storage's lookup instead (ticket 17).

const STORAGE_PATH = "products/prd-001/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.png";
const STORAGE_URL = `http://127.0.0.1:54321/storage/v1/object/public/catalogue/${STORAGE_PATH}`;

/** Storage's lookup, as lookupUploads gives it, for one uploaded and one unsent path. */
const storageLookup: UploadLookup = (path, purpose) => {
  if (purpose !== "product-photo") return null;
  if (path === STORAGE_PATH) return { publicUrl: STORAGE_URL };
  return path === "products/new/unsent.png" ? "waiting" : null;
};

const withStorage = <T>(work: () => T) =>
  withStandInStore({ ...getSampleStore(), uploadAt: storageLookup }, async () => work());

describe("uploadAt", () => {
  beforeEach(() => {
    resetSampleStore();
  });

  it("finds the sample uploads when the store has no lookup of its own", async () => {
    const upload = await uploadSamplePhoto();

    expect(uploadAt(upload.path, "product-photo")).toEqual({ publicUrl: upload.publicUrl });
    expect(uploadAt(STORAGE_PATH, "product-photo")).toBeNull();
  });

  it("uses the store's own lookup when it has one, and only that", async () => {
    const upload = await uploadSamplePhoto();

    expect(await withStorage(() => uploadAt(STORAGE_PATH, "product-photo"))).toEqual({
      publicUrl: STORAGE_URL,
    });
    expect(await withStorage(() => uploadAt(upload.path, "product-photo"))).toBeNull();
  });

  it("gives a save the Storage photo's public URL", async () => {
    const resolved = await withStorage(() =>
      resolveProductPhotos([STORAGE_PATH], [], "CE Posters"),
    );

    expect(resolved).toEqual({
      ok: true,
      photos: [{ src: STORAGE_URL, alt: "CE Posters, photo 1 of 1" }],
    });
  });

  it("refuses a save while a Storage upload hasn't arrived", async () => {
    const resolved = await withStorage(() =>
      resolveProductPhotos(["products/new/unsent.png"], [], "CE Posters"),
    );

    expect(resolved).toMatchObject({ ok: false, error: { kind: "invalid", fieldErrors: {} } });
  });
});

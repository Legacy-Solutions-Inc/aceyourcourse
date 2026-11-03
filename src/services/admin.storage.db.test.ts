import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import { seoFormValues } from "@/lib/admin/exam-page-form";
import { productFormValues } from "@/lib/admin/product-form";
import { openTestDatabase } from "@/lib/db/test-database";
import { getStorage, isStorageConfigured } from "@/lib/supabase/admin";
import { databaseArm as seam } from "@/services/admin.db";
import type { ProductForm } from "@/services/admin.schema";

import { DATABASE_ARM } from "../../test/admin-database";
import { sampleActor } from "../../test/admin-inputs";
import { describeWithStorage, openTestStorage } from "../../test/storage-database";

// The Admin's database arm with Storage (ticket 17): once a save commits, the
// files of the images it stopped using are deleted from the bucket, a removed
// photo, a deleted Product's photos and a replaced share image, and a delete
// Storage refuses is logged without failing the save. Runs in the database
// project when it has both TEST_DATABASE_URL and TEST_SUPABASE_SECRET_KEY
// (vitest.config.ts then gives the seams Storage); skips, saying why, without.

const database = await openTestDatabase();
const storage = await openTestStorage();
const seamsHaveStorage = isStorageConfigured
  ? {}
  : { skipReason: "The seams have no Storage: set TEST_SUPABASE_SECRET_KEY for pnpm test:db." };

const EDITOR = sampleActor("editor");

const bucket = () => getStorage().client.storage.from(CATALOGUE_BUCKET);
const inBucket = async (path: string) => (await bucket().exists(path)).data === true;

async function saveProduct(id: string, photos: (current: string[]) => string[]) {
  const opened = await seam.getProductForAdmin(EDITOR, id);
  if (!opened) throw new Error(`No Product ${id}`);
  const form: ProductForm = productFormValues(opened.product);
  return seam.updateProduct(EDITOR, id, { ...form, photos: photos(form.photos) }, opened.stamp);
}

async function saveShareImage(code: string, shareImage: string) {
  const opened = await seam.getExamPageForAdmin(EDITOR, code);
  if (!opened) throw new Error(`No Exam ${code}`);
  return seam.updateExamSeo(
    EDITOR,
    code,
    { ...seoFormValues(opened.page), shareImage },
    opened.stamps.seo,
  );
}

describeWithStorage(
  "Admin saves on the database: Storage clean-up",
  [database, storage, seamsHaveStorage],
  () => {
    beforeEach(async () => {
      await DATABASE_ARM.reset();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await DATABASE_ARM.reset();
    });

    it("deletes a photo's file once a save takes it off its Product", async () => {
      const upload = await DATABASE_ARM.uploadPhoto();
      expect(await saveProduct("prd-001", (srcs) => [upload.path, ...srcs])).toMatchObject({
        ok: true,
      });
      expect(await inBucket(upload.path)).toBe(true);

      const removed = await saveProduct("prd-001", (srcs) =>
        srcs.filter((src) => src !== upload.publicUrl),
      );

      expect(removed).toMatchObject({ ok: true });
      expect(await inBucket(upload.path)).toBe(false);
    });

    it("deletes every file of a deleted Product", async () => {
      const first = await DATABASE_ARM.uploadPhoto();
      const second = await DATABASE_ARM.uploadPhoto();
      expect(await saveProduct("prd-009", () => [first.path, second.path])).toMatchObject({
        ok: true,
      });

      expect(await seam.deleteProduct(EDITOR, "prd-009")).toMatchObject({ ok: true });
      expect(await inBucket(first.path)).toBe(false);
      expect(await inBucket(second.path)).toBe(false);
    });

    it("deletes a share image's file once a save replaces it", async () => {
      const first = await DATABASE_ARM.uploadPhoto({ purpose: "share-image" });
      expect(await saveShareImage("CE", first.path)).toMatchObject({ ok: true });
      const second = await DATABASE_ARM.uploadPhoto({ purpose: "share-image" });

      expect(await saveShareImage("CE", second.path)).toMatchObject({ ok: true });
      expect(await inBucket(first.path)).toBe(false);
      expect(await inBucket(second.path)).toBe(true);
    });

    it("keeps the save when Storage refuses the delete, and logs it", async () => {
      const upload = await DATABASE_ARM.uploadPhoto();
      await saveProduct("prd-001", (srcs) => [upload.path, ...srcs]);
      const { storage: files } = getStorage().client;
      const from = files.from.bind(files);
      vi.spyOn(files, "from").mockImplementation((id: string) => {
        const real = from(id);
        real.remove = async () => {
          throw new Error("Storage is down");
        };
        return real;
      });
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await saveProduct("prd-001", (srcs) =>
        srcs.filter((src) => src !== upload.publicUrl),
      );

      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.value.product.photos.map((p) => p.src)).not.toContain(
        upload.publicUrl,
      );
      expect(logged).toHaveBeenCalledWith(
        "Couldn't delete 1 image from Storage after a save; it stays in the bucket:",
        [upload.path],
        expect.any(Error),
      );
      vi.restoreAllMocks();
      expect(await inBucket(upload.path)).toBe(true);
      await bucket().remove([upload.path]);
    });
  },
);

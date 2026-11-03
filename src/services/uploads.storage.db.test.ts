import { afterAll, expect, it } from "vitest";

import { CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import type { StaffActor } from "@/services/admin.types";
import { MAX_UPLOAD_BYTES, type UploadContentType } from "@/services/uploads.types";

import { imageBytes } from "../../test/image-bytes";
import {
  describeWithStorage,
  openTestStorage,
  putFile,
  readPublicFile,
} from "../../test/storage-database";
import { createStorageArm } from "./uploads.storage";

// The upload seam's Storage arm against local Supabase (ticket 17): a file
// sent to a signed upload URL lands in the public bucket and serves at its
// public URL, and the bucket itself refuses a wrong type, a file over 10 MB
// and a second upload on the same token. Skips, saying why, without
// TEST_SUPABASE_SECRET_KEY.

const opened = await openTestStorage();
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

function storage() {
  if (!opened.storage) throw new Error("No test Storage: this suite should have been skipped.");
  return opened.storage;
}
const arm = createStorageArm(storage);

/** Every path these tests uploaded to, deleted afterwards. */
const made: string[] = [];

async function ticketFor(contentType: UploadContentType, size: number) {
  const result = await arm.createUpload(EDITOR, {
    purpose: "product-photo",
    owner: "prd-001",
    contentType,
    size,
  });
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.error)}`);
  made.push(result.value.path);
  return result.value;
}

const inBucket = async (path: string) =>
  (await storage().client.storage.from(CATALOGUE_BUCKET).exists(path)).data === true;

describeWithStorage("the upload seam on Storage", [opened], () => {
  afterAll(async () => {
    if (made.length) await storage().client.storage.from(CATALOGUE_BUCKET).remove(made);
  });

  it.each(["image/jpeg", "image/png", "image/webp"] as const)(
    "takes a %s sent to its signed upload URL, and serves it at its public URL",
    async (contentType) => {
      const bytes = imageBytes(contentType, 2048);
      const ticket = await ticketFor(contentType, bytes.byteLength);
      expect(
        ticket.publicUrl.startsWith(`${storage().supabaseUrl}/storage/v1/object/public/`),
      ).toBe(true);

      const sent = await putFile(ticket.uploadUrl, contentType, bytes);
      expect(sent.ok).toBe(true);
      expect(await readPublicFile(ticket.publicUrl)).toEqual({ contentType, bytes });
    },
  );

  it("refuses a GIF sent to a signed URL, storing nothing", async () => {
    const ticket = await ticketFor("image/png", 64);
    const sent = await putFile(ticket.uploadUrl, "image/gif", new Uint8Array(64));

    expect(sent.ok).toBe(false);
    expect(await inBucket(ticket.path)).toBe(false);
  });

  it("refuses a file over 10 MB sent to a signed URL, storing nothing", async () => {
    const ticket = await ticketFor("image/png", MAX_UPLOAD_BYTES);
    const sent = await putFile(
      ticket.uploadUrl,
      "image/png",
      imageBytes("image/png", 11 * 1024 * 1024),
    );

    expect(sent.ok).toBe(false);
    expect(await inBucket(ticket.path)).toBe(false);
  });

  it("refuses a second upload on the same signed URL, keeping the first file", async () => {
    const first = imageBytes("image/png", 128);
    const ticket = await ticketFor("image/png", first.byteLength);
    expect((await putFile(ticket.uploadUrl, "image/png", first)).ok).toBe(true);

    const again = await putFile(ticket.uploadUrl, "image/png", imageBytes("image/png", 256));

    expect(again.ok).toBe(false);
    expect((await readPublicFile(ticket.publicUrl))?.bytes).toEqual(first);
  });

  it("tells a save an upload is waiting until its file arrives, then gives its public URL", async () => {
    const bytes = imageBytes("image/webp", 512);
    const ticket = await ticketFor("image/webp", bytes.byteLength);

    expect((await arm.lookupUploads([ticket.path]))(ticket.path, "product-photo")).toBe("waiting");
    await putFile(ticket.uploadUrl, "image/webp", bytes);
    expect((await arm.lookupUploads([ticket.path]))(ticket.path, "product-photo")).toEqual({
      publicUrl: ticket.publicUrl,
    });
  });

  it("deletes the files of removed images, after which they no longer serve", async () => {
    const bytes = imageBytes("image/png", 64);
    const ticket = await ticketFor("image/png", bytes.byteLength);
    await putFile(ticket.uploadUrl, "image/png", bytes);

    await arm.removeImages([ticket.publicUrl, "/products/ultimate-ce-posters-2-0/1.webp"]);

    expect(await inBucket(ticket.path)).toBe(false);
    expect(await readPublicFile(ticket.publicUrl)).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import type { StaffActor } from "@/services/admin.types";
import { MAX_UPLOAD_BYTES, type UploadContentType } from "@/services/uploads.types";

import { imageBytes } from "../../test/image-bytes";
import { UPLOAD_ARMS } from "../../test/upload-arms";

// The upload seam (CONVENTIONS §3; spec, Phase 2 → Seams: Image upload),
// against every arm: any Staff User gets a one-time upload URL for a JPEG, PNG
// or WebP of up to 10 MB, and the file sent there is served at its public URL.
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

const PHOTO = { purpose: "product-photo", contentType: "image/png", size: 64 } as const;

describe.each(UPLOAD_ARMS)("the upload seam: $name", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  it.each(["image/jpeg", "image/png", "image/webp"] as const)(
    "gives an Editor a one-time upload URL for a %s, and serves the file sent there",
    async (contentType: UploadContentType) => {
      const result = await seam.createUpload(EDITOR, { ...PHOTO, contentType });
      if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.error)}`);
      const ticket = result.value;

      expect(result.tags).toEqual([]);
      expect(ticket.uploadUrl).not.toBe(ticket.publicUrl);
      expect(ticket.publicUrl.startsWith("/")).toBe(true);
      expect(ticket.path).not.toBe("");
      expect(await arm.read(ticket)).toBeNull();

      const bytes = imageBytes(contentType);
      expect(await arm.send(ticket, contentType, bytes)).toBe(true);
      expect(await arm.read(ticket)).toEqual({ contentType, bytes });
    },
  );

  it("gives each upload its own URL and path", async () => {
    const first = await seam.createUpload(EDITOR, PHOTO);
    const second = await seam.createUpload(EDITOR, PHOTO);
    if (!first.ok || !second.ok) throw new Error("refused");

    expect(second.value.uploadUrl).not.toBe(first.value.uploadUrl);
    expect(second.value.path).not.toBe(first.value.path);
  });

  it("accepts a file of exactly 10 MB", async () => {
    const result = await seam.createUpload(EDITOR, { ...PHOTO, size: MAX_UPLOAD_BYTES });
    expect(result.ok).toBe(true);
  });

  it.each([
    ["a GIF", { contentType: "image/gif" }, { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] }],
    [
      "an SVG",
      { contentType: "image/svg+xml" },
      { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] },
    ],
    ["a file over 10 MB", { size: MAX_UPLOAD_BYTES + 1 }, { size: ["KEEP EACH PHOTO TO 10 MB"] }],
    ["an empty file", { size: 0 }, { size: ["THE FILE IS EMPTY"] }],
    ["an unknown purpose", { purpose: "avatar" }, { purpose: ["UNKNOWN UPLOAD"] }],
  ])("refuses %s, with the field's message", async (_, change, fieldErrors) => {
    const result = await seam.createUpload(EDITOR, { ...PHOTO, ...change } as never);

    expect(result).toEqual({ ok: false, error: { kind: "invalid", fieldErrors } });
  });

  it("refuses someone signed out", async () => {
    const result = await seam.createUpload(null, PHOTO);

    expect(result).toEqual({
      ok: false,
      error: { kind: "forbidden", message: "SIGN IN TO UPLOAD PHOTOS" },
    });
  });
});

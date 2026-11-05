import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyAbout } from "@/lib/catalogue/about-content";
import type { StaffActor } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { createStorageArm, imagesRemoved, uploadPathsIn } from "./uploads.storage";

// The upload seam's Storage arm (ticket 17), over a stand-in for Supabase's
// Storage API: where each upload goes, what a save finds at a path, and the
// clean-up after a save. src/services/uploads.storage.db.test.ts runs the
// same arm against local Supabase, where the bucket enforces its rules.

const SUPABASE = "https://abcdefgh.supabase.co";
const PUBLIC = `${SUPABASE}/storage/v1/object/public/catalogue/`;
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.source;

type Answer<T> = Promise<{ data: T; error: null } | { data: null; error: Error }>;

/** A bucket standing in for Storage's: each call answers as given, and is recorded. */
function fakeBucket(
  answers: {
    sign?: (path: string) => Answer<{ signedUrl: string; token: string; path: string }>;
    exists?: (path: string) => Answer<boolean>;
    remove?: (paths: string[]) => Answer<unknown[]>;
  } = {},
) {
  const bucket = {
    createSignedUploadUrl: vi.fn(
      answers.sign ??
        (async (path: string) => ({
          data: {
            signedUrl: `${SUPABASE}/storage/v1/object/upload/sign/catalogue/${path}?token=t`,
            token: "t",
            path,
          },
          error: null,
        })),
    ),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `${PUBLIC}${path}` } })),
    exists: vi.fn(answers.exists ?? (async () => ({ data: true, error: null }))),
    remove: vi.fn(answers.remove ?? (async (paths: string[]) => ({ data: paths, error: null }))),
  };
  const from = vi.fn(() => bucket);
  const client = { storage: { from } } as unknown as SupabaseClient;
  return { bucket, from, arm: createStorageArm(() => ({ client, supabaseUrl: SUPABASE })) };
}

const PHOTO = { purpose: "product-photo", contentType: "image/png", size: 64 } as const;

describe("the Storage arm's createUpload", () => {
  it("files a Product photo under its Product, with a signed upload URL and its public URL", async () => {
    const { arm, bucket, from } = fakeBucket();
    const result = await arm.createUpload(EDITOR, { ...PHOTO, owner: "prd-001" });
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    const { path, uploadUrl, publicUrl } = result.value;
    expect(path).toMatch(new RegExp(`^products/prd-001/${UUID}\\.png$`));
    expect(from).toHaveBeenCalledWith("catalogue");
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(path);
    expect(uploadUrl).toBe(`${SUPABASE}/storage/v1/object/upload/sign/catalogue/${path}?token=t`);
    expect(publicUrl).toBe(`${PUBLIC}${path}`);
    expect(result.tags).toEqual([]);
  });

  it.each([
    [{ ...PHOTO, contentType: "image/jpeg" }, `^products/new/${UUID}\\.jpg$`],
    [{ ...PHOTO, contentType: "image/webp" }, `^products/new/${UUID}\\.webp$`],
    [{ ...PHOTO, purpose: "share-image", owner: "CE" }, `^exam-pages/CE/share-${UUID}\\.png$`],
    [
      { ...PHOTO, purpose: "site-page-share-image", owner: "faq" },
      `^site-pages/faq/share-${UUID}\\.png$`,
    ],
    [{ ...PHOTO, purpose: "about-photo", owner: "team" }, `^site-pages/about/team-${UUID}\\.png$`],
    [
      { ...PHOTO, purpose: "about-photo", owner: "story-2", contentType: "image/jpeg" },
      `^site-pages/about/story-2-${UUID}\\.jpg$`,
    ],
  ] as const)("files %o at its own path", async (request, pattern) => {
    const { arm } = fakeBucket();
    const result = await arm.createUpload(EDITOR, request);

    expect(result.ok && result.value.path).toMatch(new RegExp(pattern));
  });

  it("gives each upload its own path", async () => {
    const { arm } = fakeBucket();
    const first = await arm.createUpload(EDITOR, PHOTO);
    const second = await arm.createUpload(EDITOR, PHOTO);

    expect(first.ok && second.ok && first.value.path !== second.value.path).toBe(true);
  });

  it.each([
    ["someone signed out", null, PHOTO, { kind: "forbidden", message: "SIGN IN TO UPLOAD PHOTOS" }],
    [
      "a GIF",
      EDITOR,
      { ...PHOTO, contentType: "image/gif" },
      { kind: "invalid", fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    ],
    [
      "a share image with no Exam",
      EDITOR,
      { ...PHOTO, purpose: "share-image" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
    [
      "a Site page share image with no Site page",
      EDITOR,
      { ...PHOTO, purpose: "site-page-share-image" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
    [
      "a Site page share image for a page that isn't a Site page",
      EDITOR,
      { ...PHOTO, purpose: "site-page-share-image", owner: "legal" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
    [
      "an About photo with no slot",
      EDITOR,
      { ...PHOTO, purpose: "about-photo" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
    [
      "an About photo for a slot About doesn't have",
      EDITOR,
      { ...PHOTO, purpose: "about-photo", owner: "story-4" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
    [
      "an About photo that's a GIF",
      EDITOR,
      { ...PHOTO, purpose: "about-photo", owner: "team", contentType: "image/gif" },
      { kind: "invalid", fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
    ],
    [
      "an About photo over 10 MB",
      EDITOR,
      { ...PHOTO, purpose: "about-photo", owner: "team", size: 11 * 1024 * 1024 },
      { kind: "invalid", fieldErrors: { size: ["KEEP EACH PHOTO TO 10 MB"] } },
    ],
    [
      "an owner that would climb out of its folder",
      EDITOR,
      { ...PHOTO, owner: "../settings" },
      { kind: "invalid", fieldErrors: { owner: ["UNKNOWN UPLOAD"] } },
    ],
  ])("refuses %s without asking Storage", async (_, actor, request, error) => {
    const { arm, bucket } = fakeBucket();

    expect(await arm.createUpload(actor, request as never)).toEqual({ ok: false, error });
    expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("fails when Storage won't sign the URL", async () => {
    const { arm } = fakeBucket({
      sign: async () => ({ data: null, error: new Error("Bucket not found") }),
    });

    await expect(arm.createUpload(EDITOR, PHOTO)).rejects.toThrow(
      "Storage couldn't make an upload URL: Bucket not found",
    );
  });

  it("fails clearly when the server has no secret key, before reaching Storage", async () => {
    const arm = createStorageArm(() => {
      throw new Error("Storage isn't configured on this server.");
    });

    await expect(arm.createUpload(EDITOR, PHOTO)).rejects.toThrow(
      "Storage isn't configured on this server.",
    );
  });
});

describe("what a save finds at an upload's path", () => {
  const sent = `products/prd-001/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.png`;
  const unsent = `products/new/5b0a2c9e-1d3f-4e5a-8b7c-6d5e4f3a2b1c.webp`;
  const share = `exam-pages/CE/share-7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.jpg`;
  const siteShare = `site-pages/about/share-2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b.png`;

  it("is the public URL of an About photo once it's in the bucket", async () => {
    const aboutPhoto = `site-pages/about/story-2-3f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b7c.jpg`;
    const { arm } = fakeBucket();
    const uploadAt = await arm.lookupUploads([aboutPhoto]);

    expect(uploadAt(aboutPhoto, "about-photo")).toEqual({ publicUrl: `${PUBLIC}${aboutPhoto}` });
    expect(uploadAt(aboutPhoto, "site-page-share-image")).toBeNull();
    expect(uploadAt(siteShare, "about-photo")).toBeNull();
  });

  it("is the public URL of a Site page's share image once it's in the bucket", async () => {
    const { arm } = fakeBucket();
    const uploadAt = await arm.lookupUploads([siteShare]);

    expect(uploadAt(siteShare, "site-page-share-image")).toEqual({
      publicUrl: `${PUBLIC}${siteShare}`,
    });
    expect(uploadAt(siteShare, "share-image")).toBeNull();
  });

  it("is the public URL once the file is in the bucket, and waiting until then", async () => {
    // As storage-js answers for a file that isn't there: false, with the 404 as its error.
    const { arm, bucket } = fakeBucket({
      exists: async (path) =>
        path === unsent
          ? ({ data: false, error: new Error("Object not found") } as never)
          : { data: true, error: null },
    });
    const uploadAt = await arm.lookupUploads([sent, unsent, share, "/products/a/1.webp"]);

    expect(bucket.exists.mock.calls.map(([path]) => path).sort()).toEqual(
      [sent, unsent, share].sort(),
    );
    expect(uploadAt(sent, "product-photo")).toEqual({ publicUrl: `${PUBLIC}${sent}` });
    expect(uploadAt(unsent, "product-photo")).toBe("waiting");
    expect(uploadAt(share, "share-image")).toEqual({ publicUrl: `${PUBLIC}${share}` });
  });

  it.each([
    ["a path for the other purpose", sent, "share-image"],
    ["a share image as a Product photo", share, "product-photo"],
    ["a seed photo's own file", "products/prd-001/1.webp", "product-photo"],
    ["a path on this site", "/products/ce-posters/1.webp", "product-photo"],
    [
      "a path the save didn't send",
      "products/new/9b0a2c9e-1d3f-4e5a-8b7c-6d5e4f3a2b1c.png",
      "product-photo",
    ],
  ] as const)("is null for %s", async (_, path, purpose) => {
    const { arm } = fakeBucket();
    const uploadAt = await arm.lookupUploads([sent, share]);

    expect(uploadAt(path, purpose)).toBeNull();
  });

  it("asks Storage nothing when the save sends no upload", async () => {
    const { arm, from } = fakeBucket();
    await arm.lookupUploads(["/products/ce-posters/1.webp"]);

    expect(from).not.toHaveBeenCalled();
  });

  it("fails when Storage can't say whether a file is there", async () => {
    const { arm } = fakeBucket({
      exists: async () => {
        throw new Error("connection reset");
      },
    });

    await expect(arm.lookupUploads([sent])).rejects.toThrow(
      "Storage couldn't check an upload: connection reset",
    );
  });
});

describe("uploadPathsIn", () => {
  it("finds the upload paths anywhere in a save's arguments, once each", () => {
    const photo = "products/prd-001/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.png";
    const share = "exam-pages/CE/share-7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f.jpg";

    expect(
      uploadPathsIn([
        EDITOR,
        "prd-001",
        { title: "x", photos: [photo, "/products/a/1.webp", photo], seo: { shareImage: share } },
        { savedAt: "2026-11-03T00:00:00.000Z" },
      ]),
    ).toEqual([photo, share]);
  });
});

describe("imagesRemoved", () => {
  const seed = (): CatalogueSeed => structuredClone(CATALOGUE_SEED);
  const productWithPhotos = (catalogue: CatalogueSeed) => {
    const product = catalogue.products.find((p) => p.photos.length >= 2);
    if (!product) throw new Error("No Product with two photos in the seed");
    return product;
  };

  it("is nothing when the save kept every image", () => {
    expect(imagesRemoved(seed(), seed())).toEqual([]);
  });

  it("is a photo the save took off its Product", () => {
    const before = seed();
    const after = seed();
    const [, second] = productWithPhotos(before).photos;
    productWithPhotos(after).photos.splice(1, 1);

    expect(imagesRemoved(before, after)).toEqual([second?.src]);
  });

  it("is every photo of a deleted Product", () => {
    const before = seed();
    const after = seed();
    const deleted = productWithPhotos(before);
    after.products = after.products.filter((product) => product.id !== deleted.id);

    expect(imagesRemoved(before, after)).toEqual(deleted.photos.map((photo) => photo.src));
  });

  it("is an Exam's share image the save replaced or cleared", () => {
    const before = seed();
    const [first, second] = before.examPages;
    if (!first || !second) throw new Error("The seed has fewer than two Exam pages");
    first.shareImage = `${PUBLIC}exam-pages/${first.examCode}/share-old.png`;
    second.shareImage = `${PUBLIC}exam-pages/${second.examCode}/share-old.png`;
    const after = structuredClone(before);
    const [replaced, cleared] = after.examPages;
    if (!replaced || !cleared) throw new Error("unreachable");
    replaced.shareImage = `${PUBLIC}exam-pages/${first.examCode}/share-new.png`;
    cleared.shareImage = null;

    expect(imagesRemoved(before, after)).toEqual([first.shareImage, second.shareImage]);
  });

  it("is an About photo the save replaced or put back to today's", () => {
    const before = seed();
    const about = emptyAbout();
    about.header.teamPhoto = { src: `${PUBLIC}site-pages/about/team-old.png`, alt: "The team" };
    about.story.photos[1] = { src: `${PUBLIC}site-pages/about/story-2-old.png`, alt: "A hug" };
    about.story.photos[2] = { src: `${PUBLIC}site-pages/about/story-3-kept.png`, alt: "Kept" };
    before.sitePages = [
      { page: "about", seoTitle: null, seoDescription: null, shareImage: null, about },
    ];
    const after = structuredClone(before);
    const saved = after.sitePages[0]?.about;
    if (!saved) throw new Error("unreachable");
    saved.header.teamPhoto = { src: `${PUBLIC}site-pages/about/team-new.png`, alt: "The team" };
    saved.story.photos[1] = null;

    expect(imagesRemoved(before, after)).toEqual([
      `${PUBLIC}site-pages/about/team-old.png`,
      `${PUBLIC}site-pages/about/story-2-old.png`,
    ]);
  });

  it("is a Site page's share image the save replaced or cleared", () => {
    const before = seed();
    before.sitePages = [
      {
        page: "faq",
        seoTitle: null,
        seoDescription: null,
        shareImage: `${PUBLIC}site-pages/faq/share-old.png`,
        about: null,
      },
      {
        page: "home",
        seoTitle: null,
        seoDescription: null,
        shareImage: `${PUBLIC}site-pages/home/share-old.png`,
        about: null,
      },
    ];
    const after = structuredClone(before);
    const [replaced, cleared] = after.sitePages;
    if (!replaced || !cleared) throw new Error("unreachable");
    replaced.shareImage = `${PUBLIC}site-pages/faq/share-new.png`;
    cleared.shareImage = null;

    expect(imagesRemoved(before, after)).toEqual(before.sitePages.map((page) => page.shareImage));
  });

  it("isn't a photo that moved to another place in the catalogue", () => {
    const before = seed();
    const after = seed();
    const product = productWithPhotos(after);
    product.photos.reverse();

    expect(imagesRemoved(before, after)).toEqual([]);
  });
});

describe("the clean-up after a save", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes the bucket's files among the removed images, and leaves the rest", async () => {
    const { arm, bucket } = fakeBucket();
    await arm.removeImages([
      `${PUBLIC}products/prd-001/a.webp`,
      "/products/ce-posters/1.webp",
      "http://127.0.0.1:54321/storage/v1/object/public/catalogue/products/prd-001/b.webp",
      `${PUBLIC}exam-pages/CE/share-c.png`,
    ]);

    expect(bucket.remove).toHaveBeenCalledWith([
      "products/prd-001/a.webp",
      "exam-pages/CE/share-c.png",
    ]);
  });

  it("asks Storage nothing when none of them is the bucket's", async () => {
    const { arm, from } = fakeBucket();
    await arm.removeImages(["/products/ce-posters/1.webp"]);

    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Storage refuses",
      async () => ({ data: null, error: new Error("Object not found") }) as const,
    ],
    [
      "Storage can't be reached",
      async () => {
        throw new Error("fetch failed");
      },
    ],
  ])("logs, and never throws, when %s", async (_, remove) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { arm } = fakeBucket({ remove });

    await expect(arm.removeImages([`${PUBLIC}products/prd-001/a.webp`])).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(
      "Couldn't delete 1 image from Storage after a save; it stays in the bucket:",
      ["products/prd-001/a.webp"],
      expect.any(Error),
    );
  });

  it("logs, and never throws, when the server has no secret key", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const arm = createStorageArm(() => {
      throw new Error("Storage isn't configured on this server.");
    });

    await expect(arm.removeImages([`${PUBLIC}a.webp`])).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyAbout } from "@/lib/catalogue/about-content";
import { MAX_PDF_BYTES } from "@/lib/reviewer-pdfs/job";
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
    download?: (path: string) => Answer<Blob>;
    upload?: (path: string, bytes: Uint8Array, options: unknown) => Answer<{ path: string }>;
    signMany?: (
      paths: string[],
      seconds: number,
    ) => Answer<{ path: string | null; signedUrl: string; error: string | null }[]>;
    info?: (path: string) => Answer<{ size?: number }>;
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
    download: vi.fn(
      answers.download ??
        // Node's Blob, as storage-js gives it; the test environment's lacks arrayBuffer().
        (async () => ({
          data: { arrayBuffer: async () => new Uint8Array([1, 2]).buffer } as Blob,
          error: null,
        })),
    ),
    upload: vi.fn(answers.upload ?? (async (path: string) => ({ data: { path }, error: null }))),
    info: vi.fn(answers.info ?? (async () => ({ data: { size: 1234 }, error: null }))),
    createSignedUrls: vi.fn(
      answers.signMany ??
        (async (paths: string[]) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: `${SUPABASE}/storage/v1/object/sign/content/${path}?token=t`,
            error: null,
          })),
          error: null,
        })),
    ),
  };
  const from = vi.fn(() => bucket);
  const client = { storage: { from } } as unknown as SupabaseClient;
  return {
    bucket,
    from,
    arm: createStorageArm(() => ({ client, supabaseUrl: SUPABASE }), undefined),
  };
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

describe("the Storage arm's private uploads (ticket 06)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["import-csv", "csv", "text/csv"],
    ["import-zip", "zip", "application/zip"],
  ] as const)(
    "files a %s in the private content bucket, with no public URL",
    async (purpose, extension, contentType) => {
      const { arm, bucket, from } = fakeBucket();
      const result = await arm.createContentUpload(EDITOR, { purpose, size: 64 });
      if (!result.ok) throw new Error(JSON.stringify(result.error));

      expect(from).toHaveBeenCalledWith("content");
      expect(result.value.path).toMatch(new RegExp(`^imports/${UUID}\\.${extension}$`));
      expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(result.value.path);
      expect(result.value).toEqual({
        uploadUrl: expect.stringContaining("token="),
        path: result.value.path,
        contentType,
      });
      expect(bucket.getPublicUrl).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["signed out", null, { purpose: "import-csv", size: 64 }, "forbidden"],
    ["a CSV over 10 MB", EDITOR, { purpose: "import-csv", size: 10 * 1024 * 1024 + 1 }, "invalid"],
    [
      "a zip over 200 MB",
      EDITOR,
      { purpose: "import-zip", size: 200 * 1024 * 1024 + 1 },
      "invalid",
    ],
    ["an unknown purpose", EDITOR, { purpose: "product-photo", size: 64 }, "invalid"],
  ] as const)("refuses %s, asking Storage nothing", async (_, actor, request, kind) => {
    const { arm, bucket } = fakeBucket();

    expect(await arm.createContentUpload(actor, request as never)).toMatchObject({
      ok: false,
      error: { kind },
    });
    expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  const csv = "imports/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.csv";

  it("reads back an import's file from the content bucket", async () => {
    const { arm, bucket, from } = fakeBucket();

    expect(await arm.contentFiles.readUpload(csv, "import-csv")).toEqual(new Uint8Array([1, 2]));
    expect(from).toHaveBeenCalledWith("content");
    expect(bucket.download).toHaveBeenCalledWith(csv);
  });

  it.each([
    ["a CSV read as the zip", csv, "import-zip"],
    ["a card image", "decks/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e/a.png", "import-csv"],
    ["a path that climbs out", "imports/../decks/x.csv", "import-csv"],
    [
      "a catalogue photo",
      "products/prd-001/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.png",
      "import-csv",
    ],
  ] as const)("reads nothing for %s", async (_, path, purpose) => {
    const { arm, from } = fakeBucket();

    expect(await arm.contentFiles.readUpload(path, purpose)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("reads nothing while the file hasn't arrived", async () => {
    const { arm, bucket } = fakeBucket({
      exists: async () => ({ data: false, error: new Error("Object not found") }) as never,
    });

    expect(await arm.contentFiles.readUpload(csv, "import-csv")).toBeNull();
    expect(bucket.download).not.toHaveBeenCalled();
  });

  it("fails when Storage can't read the file", async () => {
    const { arm } = fakeBucket({
      download: async () => ({ data: null, error: new Error("timeout") }),
    });

    await expect(arm.contentFiles.readUpload(csv, "import-csv")).rejects.toThrow(
      "Storage couldn't read an upload: timeout",
    );
  });

  it("stores a card image in the content bucket, never over another file", async () => {
    const { arm, bucket } = fakeBucket();
    const bytes = new Uint8Array([0x89, 0x50]);

    await arm.contentFiles.put("decks/d/i.png", bytes, "image/png");

    expect(bucket.upload).toHaveBeenCalledWith("decks/d/i.png", bytes, {
      contentType: "image/png",
      upsert: false,
    });
  });

  it("fails when Storage won't store a card image", async () => {
    const { arm } = fakeBucket({
      upload: async () => ({ data: null, error: new Error("too big") }),
    });

    await expect(
      arm.contentFiles.put("decks/d/i.png", new Uint8Array([1]), "image/png"),
    ).rejects.toThrow("Storage couldn't store a card image: too big");
  });

  it("deletes files from the content bucket, logging and never throwing when it can't", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { arm, bucket } = fakeBucket({
      remove: async () => ({ data: null, error: new Error("nope") }),
    });

    await expect(arm.contentFiles.remove([csv, "decks/d/i.png"])).resolves.toBeUndefined();
    expect(bucket.remove).toHaveBeenCalledWith([csv, "decks/d/i.png"]);
    expect(logged).toHaveBeenCalled();
  });

  it("files a card's back image in the private content bucket, by its type (ticket 07)", async () => {
    const { arm, bucket, from } = fakeBucket();
    const result = await arm.createContentUpload(EDITOR, {
      purpose: "card-image",
      contentType: "image/webp",
      size: 64,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));

    expect(from).toHaveBeenCalledWith("content");
    expect(result.value.path).toMatch(new RegExp(`^card-images/${UUID}\\.webp$`));
    expect(result.value.contentType).toBe("image/webp");
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(result.value.path);
    expect(bucket.getPublicUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["a GIF", { contentType: "image/gif", size: 64 }],
    ["an image over 5 MB", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }],
  ])("refuses a card image that's %s, asking Storage nothing", async (_, file) => {
    const { arm, bucket } = fakeBucket();

    expect(
      await arm.createContentUpload(EDITOR, { purpose: "card-image", ...file } as never),
    ).toMatchObject({ ok: false, error: { kind: "invalid" } });
    expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  const image = "card-images/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e.png";

  it("reads back a card image's upload, and only as a card image", async () => {
    const { arm, bucket } = fakeBucket();

    expect(await arm.contentFiles.readUpload(image, "card-image")).toEqual(new Uint8Array([1, 2]));
    expect(bucket.download).toHaveBeenCalledWith(image);
    expect(await arm.contentFiles.readUpload(image, "import-csv")).toBeNull();
    expect(await arm.contentFiles.readUpload(csv, "card-image")).toBeNull();
  });

  const stored =
    "decks/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e/1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e.png";
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  it("reads a stored card image with its type, for Staff (ticket 07)", async () => {
    const { arm, bucket } = fakeBucket({
      download: async () => ({
        data: { arrayBuffer: async () => PNG.buffer } as Blob,
        error: null,
      }),
    });

    expect(await arm.contentFiles.read(stored)).toEqual({ contentType: "image/png", bytes: PNG });
    expect(bucket.download).toHaveBeenCalledWith(stored);
  });

  it("reads a stored quiz figure with its type, for Staff (ticket 09)", async () => {
    const figure =
      "quizzes/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e/1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e.png";
    const { arm, bucket } = fakeBucket({
      download: async () => ({
        data: { arrayBuffer: async () => PNG.buffer } as Blob,
        error: null,
      }),
    });

    expect(await arm.contentFiles.read(figure)).toEqual({ contentType: "image/png", bytes: PNG });
    expect(bucket.download).toHaveBeenCalledWith(figure);
  });

  it.each([
    ["an import's upload", csv],
    ["a card image's upload", image],
    ["a path that climbs out", "decks/../imports/x.png"],
    ["a quiz path that climbs out", "quizzes/../imports/x.png"],
    ["another folder", "products/0d6c1e0a-6f0e-4f43-9b8a-1f2a3b4c5d6e/a.png"],
  ])("reads no card image at %s", async (_, path) => {
    const { arm, from } = fakeBucket();

    expect(await arm.contentFiles.read(path)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("reads no card image that isn't there, or isn't really an image", async () => {
    const missing = fakeBucket({
      exists: async () => ({ data: false, error: new Error("Object not found") }) as never,
    });
    expect(await missing.arm.contentFiles.read(stored)).toBeNull();

    const fake = fakeBucket();
    expect(await fake.arm.contentFiles.read(stored)).toBeNull();
  });

  it("asks Storage nothing when there's nothing to delete", async () => {
    const { arm, from } = fakeBucket();
    await arm.contentFiles.remove([]);

    expect(from).not.toHaveBeenCalled();
  });
});

describe("the Storage arm's signed card image URLs (ticket 08)", () => {
  const first =
    "decks/0b8f4b8e-6a2f-4b1e-9d3c-5e7f9a1b2c3d/1c9e2f4a-7b3d-4e5f-8a6b-9c0d1e2f3a4b.png";
  const second =
    "decks/0b8f4b8e-6a2f-4b1e-9d3c-5e7f9a1b2c3d/2d0f3a5b-8c4e-4f6a-9b7c-0d1e2f3a4b5c.webp";

  it("signs each card image once, from the private bucket, for the time asked", async () => {
    const { arm, bucket, from } = fakeBucket();

    expect(await arm.contentFiles.signedUrls([first, second, first], 600)).toEqual({
      [first]: `${SUPABASE}/storage/v1/object/sign/content/${first}?token=t`,
      [second]: `${SUPABASE}/storage/v1/object/sign/content/${second}?token=t`,
    });
    expect(from).toHaveBeenCalledWith("content");
    expect(bucket.createSignedUrls).toHaveBeenCalledWith([first, second], 600);
  });

  it("signs a quiz figure, as the quiz will ask (ticket 11)", async () => {
    const figure =
      "quizzes/0b8f4b8e-6a2f-4b1e-9d3c-5e7f9a1b2c3d/3e1a4b6c-9d5f-4a7b-8c8d-1e2f3a4b5c6d.jpg";
    const { arm, bucket } = fakeBucket();

    expect(await arm.contentFiles.signedUrls([figure], 600)).toEqual({
      [figure]: `${SUPABASE}/storage/v1/object/sign/content/${figure}?token=t`,
    });
    expect(bucket.createSignedUrls).toHaveBeenCalledWith([figure], 600);
  });

  it("signs nothing that isn't a card image, asking Storage nothing", async () => {
    const { arm, from } = fakeBucket();

    expect(
      await arm.contentFiles.signedUrls(["imports/x.csv", "decks/../imports/x.png"], 600),
    ).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it("gives no URL for a file that's gone", async () => {
    const { arm } = fakeBucket({
      signMany: async () => ({
        data: [
          { path: first, signedUrl: "https://example.test/first", error: null },
          { path: second, signedUrl: "", error: "Either the object does not exist" },
        ],
        error: null,
      }),
    });

    expect(await arm.contentFiles.signedUrls([first, second], 600)).toEqual({
      [first]: "https://example.test/first",
    });
  });

  it("throws when Storage can't sign them", async () => {
    const { arm } = fakeBucket({
      signMany: async () => ({ data: null, error: new Error("down") }) as never,
    });
    await expect(arm.contentFiles.signedUrls([first], 600)).rejects.toThrow(
      "Storage couldn't sign card images: down",
    );
  });
});

describe("the Storage arm's Reviewer PDFs (ticket 12)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ID = "0b9f4a5e-8d3c-4f1a-9e2b-7c6d5e4f3a21";
  const ORIGINAL = `${ID}/original.pdf`;

  it("gives a resumable upload into the private Reviewer PDFs bucket, on a one-time token", async () => {
    const { arm, bucket, from } = fakeBucket();

    const result = await arm.createReviewerPdfUpload(EDITOR, {
      contentType: "application/pdf",
      size: MAX_PDF_BYTES,
    });

    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const path = bucket.createSignedUploadUrl.mock.calls[0]?.[0];
    expect(from).toHaveBeenCalledWith("reviewer-pdfs");
    expect(path).toMatch(new RegExp(`^${UUID}/original\\.pdf$`));
    expect(result.value).toEqual({
      method: "tus",
      endpoint: `${SUPABASE}/storage/v1/upload/resumable/sign`,
      headers: { "x-signature": "t" },
      metadata: {
        bucketName: "reviewer-pdfs",
        objectName: path,
        contentType: "application/pdf",
        cacheControl: "3600",
      },
      path,
    });
    // No public URL, ever.
    expect(bucket.getPublicUrl).not.toHaveBeenCalled();
  });

  it("sends the project's publishable key with the token, as Supabase's clients do", async () => {
    const { bucket } = fakeBucket();
    const client = { storage: { from: () => bucket } } as unknown as SupabaseClient;
    const arm = createStorageArm(() => ({ client, supabaseUrl: SUPABASE }), "sb_publishable_x");

    const result = await arm.createReviewerPdfUpload(EDITOR, {
      contentType: "application/pdf",
      size: 10,
    });
    expect(result.ok && result.value.method === "tus" && result.value.headers).toEqual({
      "x-signature": "t",
      apikey: "sb_publishable_x",
    });
  });

  it.each([
    ["signed out", null, { contentType: "application/pdf", size: 10 }, "forbidden"],
    ["not a PDF", EDITOR, { contentType: "image/png", size: 10 }, "invalid"],
    ["over 200 MB", EDITOR, { contentType: "application/pdf", size: MAX_PDF_BYTES + 1 }, "invalid"],
  ] as const)("refuses an upload %s, before asking Storage", async (_, actor, request, kind) => {
    const { arm, from } = fakeBucket();
    expect(await arm.createReviewerPdfUpload(actor, request as never)).toMatchObject({
      ok: false,
      error: { kind },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("fails when Storage won't sign the upload", async () => {
    const { arm } = fakeBucket({ sign: async () => ({ data: null, error: new Error("down") }) });
    await expect(
      arm.createReviewerPdfUpload(EDITOR, { contentType: "application/pdf", size: 10 }),
    ).rejects.toThrow("Storage couldn't make an upload URL: down");
  });

  it("claims an uploaded original with its size as stored, from its path", async () => {
    const { arm, bucket } = fakeBucket({
      info: async () => ({ data: { size: 5555 }, error: null }),
    });

    expect(await arm.reviewerPdfFiles.claimUpload(ORIGINAL)).toEqual({ id: ID, size: 5555 });
    expect(bucket.exists).toHaveBeenCalledWith(ORIGINAL);
    expect(bucket.info).toHaveBeenCalledWith(ORIGINAL);
  });

  it("waits for an original that hasn't arrived, and claims nothing else", async () => {
    const { arm, from } = fakeBucket({ exists: async () => ({ data: false, error: null }) });
    expect(await arm.reviewerPdfFiles.claimUpload(ORIGINAL)).toBe("waiting");
    expect(from).toHaveBeenCalledTimes(1);

    from.mockClear();
    expect(await arm.reviewerPdfFiles.claimUpload(`${ID}/pages/1.webp`)).toBeNull();
    expect(await arm.reviewerPdfFiles.claimUpload(`card-images/${ID}.png`)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("fails when Storage can't say whether the original is there, or how big it is", async () => {
    const down = fakeBucket({
      exists: async () => {
        throw new Error("down");
      },
    });
    await expect(down.arm.reviewerPdfFiles.claimUpload(ORIGINAL)).rejects.toThrow(
      "Storage couldn't check an upload: down",
    );
    const noInfo = fakeBucket({ info: async () => ({ data: null, error: new Error("gone") }) });
    await expect(noInfo.arm.reviewerPdfFiles.claimUpload(ORIGINAL)).rejects.toThrow(
      "Storage couldn't read an upload's size: gone",
    );
    const noSize = fakeBucket({ info: async () => ({ data: {}, error: null }) });
    await expect(noSize.arm.reviewerPdfFiles.claimUpload(ORIGINAL)).rejects.toThrow(
      "Storage couldn't read an upload's size",
    );
  });

  it("reads an original back, and nothing for one that's gone", async () => {
    const { arm, bucket } = fakeBucket();
    expect(await arm.reviewerPdfFiles.readOriginal(ID)).toEqual(new Uint8Array([1, 2]));
    expect(bucket.download).toHaveBeenCalledWith(ORIGINAL);

    const gone = fakeBucket({ exists: async () => ({ data: false, error: null }) });
    expect(await gone.arm.reviewerPdfFiles.readOriginal(ID)).toBeNull();
    expect(gone.bucket.download).not.toHaveBeenCalled();
  });

  it("fails when Storage can't read an original", async () => {
    const { arm } = fakeBucket({
      download: async () => ({ data: null, error: new Error("down") }),
    });
    await expect(arm.reviewerPdfFiles.readOriginal(ID)).rejects.toThrow(
      "Storage couldn't read a Reviewer PDF: down",
    );
    const unsure = fakeBucket({
      exists: async () => {
        throw new Error("down");
      },
    });
    await expect(unsure.arm.reviewerPdfFiles.readOriginal(ID)).rejects.toThrow(
      "Storage couldn't check a Reviewer PDF: down",
    );
  });

  it("stores a page image as WebP, over one stored before", async () => {
    const { arm, bucket } = fakeBucket();
    const image = new Uint8Array([9]);
    await arm.reviewerPdfFiles.putPage(ID, 7, image);
    expect(bucket.upload).toHaveBeenCalledWith(`${ID}/pages/7.webp`, image, {
      contentType: "image/webp",
      upsert: true,
    });

    const down = fakeBucket({ upload: async () => ({ data: null, error: new Error("full") }) });
    await expect(down.arm.reviewerPdfFiles.putPage(ID, 7, image)).rejects.toThrow(
      "Storage couldn't store a page image: full",
    );
  });

  it("deletes the original and every page, a thousand at a time", async () => {
    const { arm, bucket } = fakeBucket();
    await arm.reviewerPdfFiles.remove(ID, 1500);

    const removed = bucket.remove.mock.calls.map(([paths]) => paths);
    expect(removed.map((paths) => paths.length)).toEqual([1000, 501]);
    expect(removed.flat()).toEqual([
      ORIGINAL,
      ...Array.from({ length: 1500 }, (_, i) => `${ID}/pages/${i + 1}.webp`),
    ]);
  });

  it("logs, and never throws, when it can't delete them", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { arm } = fakeBucket({ remove: async () => ({ data: null, error: new Error("down") }) });
    await expect(arm.reviewerPdfFiles.remove(ID, 2)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "Couldn't delete a Reviewer PDF's files; they stay in the bucket:",
      ID,
      expect.any(Error),
    );

    const noStorage = createStorageArm(() => {
      throw new Error("Storage isn't configured on this server.");
    });
    await expect(noStorage.reviewerPdfFiles.remove(ID, 2)).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import {
  bucketObjectPath,
  bucketPublicUrl,
  isBucketImageUrl,
  storageImagePatterns,
} from "./catalogue-bucket";

// The Storage bucket's public URLs (ticket 17): where the Website loads a
// photo from, which photos are the bucket's, and the next/image allow-list.
const LOCAL = "http://127.0.0.1:54321";
const HOSTED = "https://abcdefgh.supabase.co";

describe("bucketPublicUrl", () => {
  it.each([
    [LOCAL, "http://127.0.0.1:54321/storage/v1/object/public/catalogue/"],
    [`${HOSTED}/`, "https://abcdefgh.supabase.co/storage/v1/object/public/catalogue/"],
  ])("is the bucket's public folder on %s", (url, expected) => {
    expect(bucketPublicUrl(url)).toBe(expected);
  });
});

describe("isBucketImageUrl", () => {
  it.each([
    `${LOCAL}/storage/v1/object/public/catalogue/products/prd-001/1.webp`,
    `${HOSTED}/storage/v1/object/public/catalogue/exam-pages/CE/share-1.png`,
  ])("accepts a file in the bucket: %s", (url) => {
    expect(isBucketImageUrl(url)).toBe(true);
  });

  it.each([
    ["a path on this site", "/products/ce-posters/1.webp"],
    ["Shopee's CDN", "https://down-ph.img.susercontent.com/file/abc.webp"],
    ["another bucket", `${HOSTED}/storage/v1/object/public/avatars/a.png`],
    ["the bucket itself", `${HOSTED}/storage/v1/object/public/catalogue/`],
    ["a signed upload URL", `${HOSTED}/storage/v1/object/upload/sign/catalogue/a.png?token=x`],
    ["a climb out of the bucket", `${HOSTED}/storage/v1/object/public/catalogue/%2E%2E/x.png`],
    ["another scheme", "ftp://abcdefgh.supabase.co/storage/v1/object/public/catalogue/a.png"],
    ["not a URL", "catalogue/a.png"],
  ])("refuses %s", (_, url) => {
    expect(isBucketImageUrl(url)).toBe(false);
  });
});

describe("bucketObjectPath", () => {
  it("is the object's path in the bucket, for a file on this Supabase", () => {
    expect(
      bucketObjectPath(
        `${HOSTED}/storage/v1/object/public/catalogue/products/prd-001/a.webp`,
        HOSTED,
      ),
    ).toBe("products/prd-001/a.webp");
  });

  it.each([
    ["a path on this site", "/products/ce-posters/1.webp"],
    ["another Supabase's bucket", `${LOCAL}/storage/v1/object/public/catalogue/products/a.webp`],
    ["the bucket itself", `${HOSTED}/storage/v1/object/public/catalogue/`],
  ])("is null for %s, which isn't this bucket's to delete", (_, src) => {
    expect(bucketObjectPath(src, HOSTED)).toBeNull();
  });
});

describe("storageImagePatterns", () => {
  it.each([
    [LOCAL, { protocol: "http", hostname: "127.0.0.1", port: "54321" }],
    [HOSTED, { protocol: "https", hostname: "abcdefgh.supabase.co", port: "" }],
  ])("lets next/image load the public files on %s", (url, host) => {
    expect(storageImagePatterns(url)).toEqual([
      { ...host, pathname: "/storage/v1/object/public/**" },
    ]);
  });

  it.each([undefined, "", "not a url"])("allows nothing without a Supabase URL (%s)", (url) => {
    expect(storageImagePatterns(url)).toEqual([]);
  });
});

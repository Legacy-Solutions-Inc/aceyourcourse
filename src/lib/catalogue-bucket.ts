// The Storage bucket that holds Product photos and Exam share images (ticket
// 17; supabase/migrations/…_catalogue_bucket.sql). It's public, so the Website
// loads each file at its public URL, through next/image. Pure, and safe in the
// browser: the catalogue schema uses it to accept the bucket's files as
// self-hosted, and next.config.ts to allow them in next/image.

export const CATALOGUE_BUCKET = "catalogue";

/** Where Supabase serves a public bucket's files, under its URL. */
const PUBLIC_OBJECTS = "/storage/v1/object/public/";
const BUCKET_FOLDER = `${PUBLIC_OBJECTS}${CATALOGUE_BUCKET}/`;

function parse(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** The bucket's public folder on a Supabase: a file's public URL is this, then its path. */
export function bucketPublicUrl(supabaseUrl: string): string {
  const url = parse(supabaseUrl);
  if (!url) throw new Error("The Supabase URL isn't a URL.");
  return `${url.origin}${BUCKET_FOLDER}`;
}

/**
 * Whether a URL is a file in the bucket, on any Supabase. The catalogue schema
 * takes these as self-hosted photos: only the upload seam and the seed put
 * them there, so the host isn't checked here.
 */
export function isBucketImageUrl(value: string): boolean {
  const url = parse(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return false;
  // URL resolves "..", so a climb out of the bucket no longer starts with it.
  if (!url.pathname.startsWith(BUCKET_FOLDER)) return false;
  const path = url.pathname.slice(BUCKET_FOLDER.length);
  return path !== "" && !decodeURIComponent(path).split("/").includes("..");
}

/**
 * The path in the bucket of a photo's src, when it's a file in this Supabase's
 * bucket; null for anything else (a photo in public/, say), which isn't the
 * bucket's to delete.
 */
export function bucketObjectPath(src: string, supabaseUrl: string): string | null {
  const folder = bucketPublicUrl(supabaseUrl);
  if (!src.startsWith(folder) || !isBucketImageUrl(src)) return null;
  return decodeURIComponent(src.slice(folder.length));
}

/** One of next/image's `images.remotePatterns`. */
export interface StorageImagePattern {
  protocol: "http" | "https";
  hostname: string;
  port: string;
  pathname: string;
}

/**
 * next/image's allow-list for Supabase's public files, from
 * NEXT_PUBLIC_SUPABASE_URL: the hosted project in production, local Supabase
 * (127.0.0.1:54321) in development. Nothing without one.
 */
export function storageImagePatterns(supabaseUrl: string | undefined): StorageImagePattern[] {
  const url = parse(supabaseUrl);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return [];
  return [
    {
      protocol: url.protocol === "https:" ? "https" : "http",
      hostname: url.hostname,
      port: url.port,
      pathname: `${PUBLIC_OBJECTS}**`,
    },
  ];
}

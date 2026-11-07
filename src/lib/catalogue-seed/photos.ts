import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { UploadContentType } from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// The seed's photos (ticket 17). The Phase 1 photos live in public/products/,
// where the sample data and the tests keep using them; `pnpm catalogue:seed`
// uploads each one into the Storage bucket, under its Product, and loads the
// Product with the bucket URLs. The command runs outside Next, so this makes
// its own secret-key client from the values it's given (src/lib/supabase/
// admin.ts is the server's).
// ─────────────────────────────────────────────────────────────────────────────

/** Storage refused a seed photo. Its message names the file, never a key. */
export class PhotoUploadError extends Error {}

/** Where the seed's photos come from, and where they go. */
export interface SeedPhotos {
  /** A seed photo's file, by its src ("/products/…"), or null when public/ has none. */
  read(src: string): Promise<Uint8Array | null>;
  /** Uploads a file into the bucket at `path`, replacing any there, and gives its public URL. */
  upload(path: string, bytes: Uint8Array, contentType: UploadContentType): Promise<string>;
}

const CONTENT_TYPES: Record<string, UploadContentType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** One seed photo, and where it goes in the bucket. */
export interface PlannedPhoto {
  productId: string;
  /** Its place among the Product's photos. */
  index: number;
  src: string;
  /** products/{productId}/{file}: the same each load, so a load replaces the last one's files. */
  path: string;
  /** Null when the file isn't a JPEG, PNG or WebP, which the bucket would refuse. */
  contentType: UploadContentType | null;
}

/** Pure: every Product photo in the seed, and where it goes in the bucket. */
export function seedPhotoPlan(seed: CatalogueSeed): PlannedPhoto[] {
  return seed.products.flatMap((product) =>
    product.photos.map(({ src }, index) => {
      const file = path.posix.basename(src);
      return {
        productId: product.id,
        index,
        src,
        path: `products/${product.id}/${file}`,
        contentType: CONTENT_TYPES[path.posix.extname(file).toLowerCase()] ?? null,
      };
    }),
  );
}

/**
 * The seed's photos as the command uses them: read from `publicDir`, uploaded
 * to the bucket on this Supabase with its secret key, which is never printed.
 */
export function storageSeedPhotos({
  supabaseUrl,
  secretKey,
  publicDir,
}: {
  supabaseUrl: string;
  secretKey: string;
  publicDir: string;
}): SeedPhotos {
  const bucket = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).storage.from(CATALOGUE_BUCKET);
  const root = path.resolve(publicDir);

  return {
    async read(src) {
      const file = path.resolve(root, `.${src}`);
      if (!file.startsWith(`${root}${path.sep}`)) return null;
      try {
        return await readFile(file);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }
    },
    async upload(objectPath, bytes, contentType) {
      const { error } = await bucket.upload(objectPath, bytes, { contentType, upsert: true });
      if (error) throw new PhotoUploadError(`Storage refused ${objectPath}: ${error.message}.`);
      return bucket.getPublicUrl(objectPath).data.publicUrl;
    },
  };
}

import { readFile } from "node:fs/promises";

import { drizzle } from "drizzle-orm/postgres-js";
import { expect, it } from "vitest";

import { bucketPublicUrl } from "@/lib/catalogue-bucket";
import type { Database } from "@/lib/db/connect";
import { LOCAL_SUPABASE_URL } from "@/lib/db/local-database";
import * as schema from "@/lib/db/schema";
import { openTestDatabase } from "@/lib/db/test-database";
import { readCatalogue } from "@/services/catalogue.db";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import {
  describeWithStorage,
  openTestStorage,
  readPublicFile,
} from "../../../test/storage-database";
import { seedPhotoPlan, storageSeedPhotos } from "./photos";
import { seedCatalogue } from "./seed";

// `pnpm catalogue:seed` with its photos (ticket 17), against local Supabase:
// every seed photo goes into the bucket under its Product, the Products load
// with the bucket URLs, and a load runs again over its own files, as every
// `pnpm db:reset` does. A missing photo file stops the load before anything
// is written. Skips, saying why, without TEST_DATABASE_URL or
// TEST_SUPABASE_SECRET_KEY.

const database = await openTestDatabase();
const storage = await openTestStorage();
const testDb: Database | undefined = database.sql ? drizzle(database.sql, { schema }) : undefined;

function db(): Database {
  if (!testDb) throw new Error("No test database: this suite should have been skipped.");
  return testDb;
}

const supabaseUrl = () => process.env.TEST_SUPABASE_URL ?? LOCAL_SUPABASE_URL;
const photos = () =>
  storageSeedPhotos({
    supabaseUrl: supabaseUrl(),
    secretKey: process.env.TEST_SUPABASE_SECRET_KEY ?? "",
    publicDir: "public",
  });
const products = async () => (await readCatalogue(db(), ["products"])).products;

describeWithStorage("catalogue:seed with its photos in Storage", [database, storage], () => {
  it("uploads every seed photo under its Product, and loads the Products with their bucket URLs", async () => {
    const plan = seedPhotoPlan(CATALOGUE_SEED);
    expect(await seedCatalogue(db(), CATALOGUE_SEED, { photos: photos() })).toMatchObject({
      ok: true,
      uploadedPhotos: plan.length,
    });

    const loaded = (await products()).flatMap((product) =>
      product.photos.map((photo, index) => ({ productId: product.id, index, src: photo.src })),
    );
    const folder = bucketPublicUrl(supabaseUrl());
    expect(loaded).toEqual(
      plan.map(({ productId, index, path }) => ({ productId, index, src: `${folder}${path}` })),
    );
    for (const { src, path } of plan) {
      const served = await readPublicFile(`${folder}${path}`);
      expect(served?.bytes, src).toEqual(new Uint8Array(await readFile(`public${src}`)));
    }
  });

  it("loads again over its own files, as every db:reset does", async () => {
    await seedCatalogue(db(), CATALOGUE_SEED, { photos: photos() });
    expect(await seedCatalogue(db(), CATALOGUE_SEED, { photos: photos() })).toMatchObject({
      ok: true,
    });
  });

  it("stops before anything is written when a seed photo's file is missing", async () => {
    await seedCatalogue(db(), CATALOGUE_SEED, { photos: photos() });
    const before = await products();
    const seed = structuredClone(CATALOGUE_SEED);
    const product = seed.products.find((p) => p.photos.length > 0);
    const photo = product?.photos[0];
    if (!photo) throw new Error("The seed has no photos");
    photo.src = "/products/no-such-product/1.webp";

    expect(await seedCatalogue(db(), seed, { photos: photos() })).toEqual({
      ok: false,
      reason: "photos",
      problems: ["/products/no-such-product/1.webp: no such file in public/"],
    });
    expect(await products()).toEqual(before);
  });
});

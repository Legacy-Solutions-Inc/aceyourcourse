import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/connect";
import * as schema from "@/lib/db/schema";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

import { type SeedPhotos, seedPhotoPlan } from "./photos";
import { formatSampleStaff, formatSeedCounts, seedCatalogue, seedCounts } from "./seed";

// The parts of `pnpm catalogue:seed` that need no database. Writing, the one
// transaction and --production's refusal are checked against Postgres in
// seed.db.test.ts.

/** A database that fails the test if anything touches it. */
const untouchable = new Proxy({} as Database, {
  get(_target, property) {
    throw new Error(`the database was touched (${String(property)})`);
  },
});

describe("catalogue seed: counts", () => {
  it("names the sample staff a local load adds, for Sign in as", () => {
    expect(formatSampleStaff({ staff: 2, invites: 2 })).toBe(
      '2 sample Staff Users and 2 Invites, for "Sign in as"',
    );
    expect(formatSampleStaff({ staff: 1, invites: 1 })).toBe(
      '1 sample Staff User and 1 Invite, for "Sign in as"',
    );
  });

  it("counts the seed's Exams, Subjects, Products by state, Reviews and FAQs", () => {
    expect(seedCounts(CATALOGUE_SEED)).toEqual({
      exams: CATALOGUE_SEED.exams.length,
      subjects: CATALOGUE_SEED.exams.flatMap((exam) => exam.subjects).length,
      liveProducts: 8,
      comingSoonProducts: 7,
      reviews: 16,
      faqs: 18,
    });
  });

  it("prints one line per kind of record", () => {
    expect(
      formatSeedCounts({
        exams: 11,
        subjects: 40,
        liveProducts: 8,
        comingSoonProducts: 7,
        reviews: 16,
        faqs: 18,
      }),
    ).toEqual([
      "11 Exams, 40 Subjects",
      "15 Products (8 Live, 7 Coming Soon)",
      "16 Reviews",
      "18 FAQs",
    ]);
  });

  it("says one of each in the singular", () => {
    expect(
      formatSeedCounts({
        exams: 1,
        subjects: 1,
        liveProducts: 1,
        comingSoonProducts: 0,
        reviews: 1,
        faqs: 1,
      }),
    ).toEqual(["1 Exam, 1 Subject", "1 Product (1 Live, 0 Coming Soon)", "1 Review", "1 FAQ"]);
  });
});

describe("catalogue seed: validation first", () => {
  it("refuses a Coming Soon Product with a price before touching the database", async () => {
    const seed = structuredClone(CATALOGUE_SEED);
    const soon = seed.products.find((p) => p.slug === "ce-solving-notebook");
    if (!soon) throw new Error("the seed has no ce-solving-notebook");
    soon.priceFrom = 50000;

    const index = seed.products.indexOf(soon);
    expect(await seedCatalogue(untouchable, seed)).toEqual({
      ok: false,
      reason: "invalid",
      errors: [`products.${index}.priceFrom: a Coming Soon Product has no price`],
    });
  });

  it("refuses something that isn't a seed at all, in production too", async () => {
    const outcome = await seedCatalogue(untouchable, { exams: "nope" }, { production: true });
    expect(outcome).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("catalogue seed: photos into Storage (ticket 17)", () => {
  const BUCKET = "http://127.0.0.1:54321/storage/v1/object/public/catalogue/";
  const photoSrcs = CATALOGUE_SEED.products.flatMap((product) => product.photos.map((p) => p.src));

  /** Seed photos read from a stand-in for public/, uploaded to a stand-in bucket. */
  function fakePhotos(missing: readonly string[] = []) {
    const uploaded: { path: string; bytes: Uint8Array; contentType: string }[] = [];
    const photos: SeedPhotos = {
      read: vi.fn(async (src: string) =>
        missing.includes(src) ? null : new TextEncoder().encode(`file ${src}`),
      ),
      upload: vi.fn(async (path: string, bytes: Uint8Array, contentType: string) => {
        uploaded.push({ path, bytes, contentType });
        return `${BUCKET}${path}`;
      }),
    };
    return { photos, uploaded };
  }

  /** A database that accepts the load, keeping each table's inserted rows. */
  function recordingDatabase() {
    const inserted = new Map<unknown, unknown[]>();
    const tx = {
      select: () => ({ from: () => ({ limit: async () => [] }) }),
      delete: async () => {},
      insert: (table: unknown) => ({
        values: (rows: unknown[]) => {
          inserted.set(table, rows);
          return Object.assign(Promise.resolve(), { onConflictDoUpdate: async () => {} });
        },
      }),
    };
    const db = { transaction: async (work: (t: typeof tx) => unknown) => work(tx) };
    return { db: db as unknown as Database, inserted };
  }

  it("plans each Product photo into its Product's folder, by its file's name and type", () => {
    const plan = seedPhotoPlan(CATALOGUE_SEED);
    const product = CATALOGUE_SEED.products.find((p) => p.photos.length > 1);
    if (!product) throw new Error("No Product with photos");

    expect(plan).toHaveLength(photoSrcs.length);
    expect(plan.filter((photo) => photo.productId === product.id)).toEqual(
      product.photos.map((photo, index) => ({
        productId: product.id,
        index,
        src: photo.src,
        path: `products/${product.id}/${photo.src.split("/").at(-1)}`,
        contentType: "image/webp",
      })),
    );
  });

  it("uploads every seed photo, and loads each Product with its photos' bucket URLs", async () => {
    const { photos, uploaded } = fakePhotos();
    const { db, inserted } = recordingDatabase();

    expect(await seedCatalogue(db, CATALOGUE_SEED, { photos })).toMatchObject({
      ok: true,
      uploadedPhotos: photoSrcs.length,
    });
    expect(uploaded.map(({ path, contentType }) => ({ path, contentType }))).toEqual(
      seedPhotoPlan(CATALOGUE_SEED).map(({ path, contentType }) => ({ path, contentType })),
    );
    expect(uploaded[0]?.bytes).toEqual(new TextEncoder().encode(`file ${photoSrcs[0]}`));
    const rows = inserted.get(schema.productPhotos) as { src: string }[];
    expect(rows.map((row) => row.src)).toEqual(
      seedPhotoPlan(CATALOGUE_SEED).map(({ path }) => `${BUCKET}${path}`),
    );
  });

  it("aborts before any write or upload when a seed photo's file is missing", async () => {
    const [gone] = photoSrcs;
    if (!gone) throw new Error("The seed has no photos");
    const { photos } = fakePhotos([gone]);

    expect(await seedCatalogue(untouchable, CATALOGUE_SEED, { photos })).toEqual({
      ok: false,
      reason: "photos",
      problems: [`${gone}: no such file in public/`],
    });
    expect(photos.upload).not.toHaveBeenCalled();
  });

  it("aborts before any write when a seed photo isn't a JPEG, PNG or WebP", async () => {
    const seed = structuredClone(CATALOGUE_SEED);
    const photo = seed.products.flatMap((product) => product.photos)[0];
    if (!photo) throw new Error("The seed has no photos");
    photo.src = "/products/ce-posters/cover.gif";
    const { photos } = fakePhotos();

    expect(await seedCatalogue(untouchable, seed, { photos })).toEqual({
      ok: false,
      reason: "photos",
      problems: ["/products/ce-posters/cover.gif: not a JPEG, PNG or WebP"],
    });
    expect(photos.read).not.toHaveBeenCalled();
  });

  it("leaves the photos at their public/ paths without Storage, as the database tests load them", async () => {
    const { db, inserted } = recordingDatabase();

    expect(await seedCatalogue(db, CATALOGUE_SEED)).toMatchObject({
      ok: true,
      uploadedPhotos: null,
    });
    expect((inserted.get(schema.productPhotos) as { src: string }[]).map((r) => r.src)).toEqual(
      photoSrcs,
    );
  });
});

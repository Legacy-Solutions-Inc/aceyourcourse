import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase } from "./test-database";

// The catalogue bucket's migration (ticket 17; supabase/migrations/
// …_catalogue_bucket.sql): a public bucket that enforces the upload rules
// itself, JPEG, PNG or WebP up to 10 MB, and that the browser roles can't
// write to, list or delete from: no storage.objects policy lets them in, so
// only the server's signed upload URLs reach it.

const database = await openTestDatabase();

describeWithDatabase("the catalogue bucket", database, (db) => {
  it("is public, with a 10 MB limit and the three image types", async () => {
    const rows = await db()<
      {
        public: boolean;
        fileSizeLimit: string | number | null;
        allowedMimeTypes: string[] | null;
      }[]
    >`
      select public, file_size_limit as "fileSizeLimit", allowed_mime_types as "allowedMimeTypes"
      from storage.buckets where id = 'catalogue'`;

    expect(rows.map((row) => ({ ...row, fileSizeLimit: Number(row.fileSizeLimit) }))).toEqual([
      {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
    ]);
  });

  it("has no storage.objects policy for the browser roles", async () => {
    const policies = await db()<{ policy: string }[]>`
      select policyname as policy from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and roles && array['public', 'anon', 'authenticated']::name[]`;

    expect(policies).toEqual([]);
  });
});

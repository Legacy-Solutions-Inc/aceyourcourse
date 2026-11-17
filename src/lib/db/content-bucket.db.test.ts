import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase } from "./test-database";

// The content bucket's migration (Phase 3, ticket 06; supabase/migrations/
// …_content_bucket.sql): a PRIVATE bucket for card images and import files,
// so no file in it has a public URL, and the browser roles can't read, list,
// write or delete in it: no storage.objects policy lets them in, so only the
// server's signed URLs reach it.

const database = await openTestDatabase();

describeWithDatabase("the content bucket", database, (db) => {
  it("is private, with a 200 MB limit, the three image types, CSV and zip", async () => {
    const rows = await db()<
      {
        public: boolean;
        fileSizeLimit: string | number | null;
        allowedMimeTypes: string[] | null;
      }[]
    >`
      select public, file_size_limit as "fileSizeLimit", allowed_mime_types as "allowedMimeTypes"
      from storage.buckets where id = 'content'`;

    expect(rows.map((row) => ({ ...row, fileSizeLimit: Number(row.fileSizeLimit) }))).toEqual([
      {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "text/csv", "application/zip"],
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

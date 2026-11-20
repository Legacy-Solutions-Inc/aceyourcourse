import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase } from "./test-database";

// The Reviewer PDFs' bucket (Phase 3, ticket 12; supabase/migrations/
// …_reviewer_pdfs_bucket.sql): a PRIVATE bucket for each Editor's original PDF
// and its page images, so no file in it has a public URL, and the browser
// roles can't read, list, write or delete in it: no storage.objects policy
// lets them in, so only the server's signed upload tokens reach it.

const database = await openTestDatabase();

describeWithDatabase("the Reviewer PDFs' bucket", database, (db) => {
  it("is private, with a 200 MB limit, for PDFs and WebP page images", async () => {
    const rows = await db()<
      {
        public: boolean;
        fileSizeLimit: string | number | null;
        allowedMimeTypes: string[] | null;
      }[]
    >`
      select public, file_size_limit as "fileSizeLimit", allowed_mime_types as "allowedMimeTypes"
      from storage.buckets where id = 'reviewer-pdfs'`;

    expect(rows.map((row) => ({ ...row, fileSizeLimit: Number(row.fileSizeLimit) }))).toEqual([
      {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "image/webp"],
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

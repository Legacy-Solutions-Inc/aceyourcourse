-- The Reviewer PDFs' files (Phase 3, ticket 12; spec, Phase 3 planning
-- decisions → The Reviewer PDF job): each Editor's original PDF, and the page
-- images the job renders from it, at <id>/original.pdf and
-- <id>/pages/<page>.webp in it (src/lib/reviewer-pdfs/paths.ts). A
-- PRIVATE bucket: nothing in it has a public URL, and no Member is ever given
-- a signed one. Members only ever see a page stamped with their own email,
-- served by the Member App after an allowed read (ticket 14).
--
-- Storage enforces what may be put here: a PDF or a WebP page image, up to
-- 200 MB (an original's limit; a page image is far smaller). The project's
-- own global file size limit (Storage settings) must be at least as large.
-- The browser uploads an original straight here with a resumable (TUS)
-- upload, on a one-time signed upload token the server makes with the
-- secret key (src/services/uploads.storage.ts); the job reads and writes
-- with the secret key too. So storage.objects gets no policy for `anon` or
-- `authenticated`: the browser's own key can't read, list, write or delete a
-- file. src/lib/db/reviewer-pdfs-bucket.db.test.ts checks the bucket and the
-- absence of policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reviewer-pdfs',
  'reviewer-pdfs',
  false,
  209715200,
  array['application/pdf', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

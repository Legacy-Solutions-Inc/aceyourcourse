-- The Member App's private content (Phase 3, ticket 06; spec, Phase 3 planning
-- decisions → Card back images and quiz figures): card back images, and the
-- CSV and zip of images an Editor uploads for an import, which the server
-- reads and deletes once the import is saved. A PRIVATE bucket: nothing in it
-- has a public URL. Members only ever get short-lived signed URLs to a card's
-- image, after an allowed read (ticket 08).
--
-- Storage enforces what may be put here: a JPEG, PNG or WebP image, a CSV or
-- a zip, up to 200 MB (the zip's limit; the server holds a CSV to 10 MB and an
-- image to 5 MB). Uploads only go through one-time signed upload URLs, which
-- the server makes with the secret key (src/services/uploads.storage.ts), so
-- storage.objects gets no policy for `anon` or `authenticated`: the browser's
-- own key can't read, list, write or delete a file.
-- src/lib/db/content-bucket.db.test.ts checks the bucket and the absence of
-- policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content',
  'content',
  false,
  209715200,
  array['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/zip']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

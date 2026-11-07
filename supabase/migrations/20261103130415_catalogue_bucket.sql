-- Product photos and Exam share images (spec Phase 2: Seams, Image upload).
-- A public bucket: the Website loads each file at its public URL. Storage
-- itself enforces the upload rules: JPEG, PNG or WebP, up to 10 MB.
--
-- Uploads only go through one-time signed upload URLs, which the server makes
-- with the secret key (src/services/uploads.storage.ts), so storage.objects
-- gets no policy for `anon` or `authenticated`: the browser's own key can't
-- list, write or delete a file. src/lib/db/catalogue-bucket.db.test.ts checks
-- the limits and the absence of policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogue',
  'catalogue',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

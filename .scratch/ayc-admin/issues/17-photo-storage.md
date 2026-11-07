# 17 — Photo storage

**What to build:** Product photos and Exam share images are stored in a public Supabase Storage bucket.

- **The upload seam's Storage arm** hands the browser a one-time signed upload URL. The secret key is used only on the server.
- **The bucket** enforces the rules: JPEG, PNG or WebP, up to 10 MB.
- **The seed** uploads the Phase 1 photos into the bucket. The repo keeps its copies for the mock tests.
- **next/image** allows the Storage host.
- **Clean-up.** Photos removed from a Product, or from a deleted Product, are deleted from Storage after the save.

**Blocked by:** 15 — Admin writes on the database

**Status:** ready-for-agent

Spec: Implementation Decisions → Phase 2 (Seams: Image upload, Keys, Catalogue goes real, Products: photos). Conventions: §3 (upload seam). Skills: supabase (Storage).

- [ ] **The bucket migration** creates `catalogue`: public read, `file_size_limit` 10 MB, and `allowed_mime_types` image/jpeg, image/png and image/webp. There are no `storage.objects` policies for `anon` or `authenticated`.
- [ ] **The upload seam's Storage arm** (selected with the database):
  - creates a signed upload URL with the server-only secret-key client, in a new `src/lib/supabase/admin.ts` that imports `server-only`
  - uses the paths `products/{productId}/{uuid}.{ext}` and `exam-pages/{code}/share-{uuid}.{ext}`
  - returns the public URL

  The browser flow from ticket 06 is unchanged.

- [ ] **Storage clean-up.** After a save commits, the Storage objects of removed photos are deleted, along with those of a deleted Product and a replaced share image. A failed delete is logged and never fails the save.
- [ ] **The seed.** `catalogue:seed` uploads `public/products/<slug>/*.webp` and stores bucket paths. In production it uploads once, refusing as before if data exists. The local seed uploads the files on every `db:reset`.
- [ ] **Images.**
  - `next.config.ts` adds `images.remotePatterns` for the Supabase host's `/storage/v1/object/public/**`, covering both the hosted and the local `127.0.0.1:54321`.
  - The development CSP allows the local Storage origin for images.
  - The Website renders bucket photos with next/image.
- [ ] **Tests:**
  - the Storage arm against local Supabase: a signed URL upload succeeds; a wrong type or a file over 10 MB is refused by the bucket; a reused token is refused
  - e2e on the database: upload a fixture photo and see it on the Website
- [ ] **Sad paths:**
  - a missing `SUPABASE_SECRET_KEY` in live mode fails `createUpload` with a clear error
  - a seed photo file that is missing aborts the seed before any write
  - a Storage delete failure doesn't fail the save

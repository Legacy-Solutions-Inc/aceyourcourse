# 12 — Reviewer PDF upload and the processing job

**What to build:** an Editor uploads a Reviewer PDF of up to 200 MB and can leave the page. A background job splits it into page images in batches. The Admin shows its progress, and it ends as a Draft or as Failed with a reason and a fix.

- **Upload:** from the Admin's Reviewer PDFs screen, straight from the browser to a private Supabase Storage bucket with a resumable upload. It never goes through a Vercel request body. Files over 200 MB, or not PDFs, are refused before uploading.
- **The job:**
  - a job row in Postgres records the status (Processing, Draft, Failed), pages done and total, the reason, and a heartbeat
  - a Vercel function renders about 25 pages per run with pdf.js on a server canvas (permissive licences only; no AGPL MuPDF) at about 1600 px wide as WebP
  - it saves the pages to the private bucket, updates the job, and starts the next run
  - a Vercel Cron every minute restarts jobs whose heartbeat is stale, giving up after a set number of restarts
- **Failure reasons with fixes:**
  - password-protected: "Remove the password and upload again"
  - corrupt or unreadable
  - over 200 MB
  - too many restarts
- **The page-images interface:** the renderer and the storage sit behind a small interface with fakes, so the seam tests run without real PDFs. Real tests use tiny fixture PDFs.
- **The Admin list:** each upload with its status and progress ("Processing · 75 of 312 pages"), which refreshes by itself. Deleting removes the original and every page image.
- **Not in this ticket:** placing it under a Topic, previewing and publishing (ticket 13).

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "PDF processing" and "The Reviewer PDF job"; stories 114, 115; ADR 0012.

- [ ] An Editor uploads a PDF, leaves, comes back, and finds it a Draft with every page rendered.
- [ ] Progress shows while processing.
- [ ] Deleting removes the original and the pages.
- [ ] **Sad paths, each with a test:**
  - a password-protected fixture fails with its fix
  - a corrupt fixture fails
  - a non-PDF or over-limit file is refused before upload
  - a batch boundary resumes without duplicating or skipping pages
  - a stale heartbeat restarts the job
  - too many restarts fail it
  - the cron endpoint refuses callers without the cron secret
  - clean page images and the original are never reachable from a browser
  - Members can't post the actions

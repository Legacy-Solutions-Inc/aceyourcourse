# 12. Host on Vercel Pro and Supabase Pro, both in Singapore

Date: 2026-10-29

## Status

Accepted

## Decision

Production runs on **Vercel Pro**, with functions in the Singapore region
(`sin1`). The database, auth and storage run on **Supabase Pro** in Singapore
(`ap-southeast-1`), the region closest to the Philippines for both.

Long-running server work runs as Vercel background functions, with job status
stored in Postgres. Examples are splitting Reviewer PDFs into page images and
stamping watermarks.

## Considered options

- **Docker self-host** (VPS or Fly.io), which the template also supports.
  Rejected for now. It's cheaper and has no function time limits, but the team
  would run servers, TLS, scaling and deploys themselves. It would also lose
  the managed data cache with on-demand tag revalidation, and per-branch
  preview deploys. The standalone
  Docker build stays in the repo as an exit path.

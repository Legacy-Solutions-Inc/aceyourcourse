-- Access is checked on the server (spec Phase 2). Drizzle connects as
-- `postgres` and the Staff Guard decides who may do what, so the browser roles
-- must reach nothing: `anon` (the publishable key) and `authenticated` (a
-- signed-in session).
--
-- Supabase grants both roles every privilege on what `postgres` creates in
-- public. Take those defaults away, and anything already granted. Every table
-- also enables RLS with no policies; src/lib/db/deny-all.db.test.ts checks
-- every table in public for all three.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

# Drizzle + RLS — future tenancy postures (reference-only)

Load-on-demand companion to **drizzle-data**. **Reference-only:** this repo is
**single-tenant** today and the multi-tenancy track is blocked. Nothing here is
active guidance for the current round — it records the intended authz design so a
future tenancy pass starts from a decided position. Drizzle **0.45.2**.

## The two postures

**Posture A — seam-scoped, RLS as defense-in-depth (this repo's intended
posture, ADR 0005 + 0006).**

- The authorization boundary is enforced **in the service seam**: every query is
  scoped by the caller's active organization (`organization_id`).
- Postgres **RLS** (defined in `supabase/migrations/`) is the second line: even if
  a seam bug or a forged cookie slipped through, RLS denies cross-tenant rows.
- Drizzle issues ordinary scoped queries; RLS is authored/owned on the Supabase
  side. The seam scopes; RLS guarantees.

**Posture B — RLS-primary, policies defined in Drizzle.**

- Drizzle can define RLS itself: `pgPolicy(...)` (permissive/restrictive, per
  command, `using`/`withCheck`), `pgRole(...)`, enabling RLS on a table, and the
  `crudPolicy()` helper.
- The `drizzle-orm/supabase` import ships predefined roles (`anonRole`,
  `authenticatedRole`, `serviceRole`), existing-table refs (`authUsers`), and
  helpers (`authUid()`); `.link()` attaches policies to pre-existing tables.
- Drizzle Kit manages role migrations when `entities.roles` is set in
  `drizzle.config.ts`.

## Why A here

Supabase already owns auth and the RLS policies in `supabase/migrations/`
(ADR 0005). Keeping RLS authored on the Supabase side avoids two tools writing
the same policies, while the seam gives fast, typed, explicitly-scoped queries.
Adopting Posture B (authoring RLS in Drizzle) would be a deliberate future
decision, not a default.

## When the tenancy track unblocks

- Add `organization_id` to the schema and a scoping argument through the seam.
- Ensure the Drizzle table and the Supabase migration agree on shared object
  names (enums, columns) — the alignment rule in **drizzle-data**.
- Decide A vs B explicitly and record it in a new ADR.

## Source

- Drizzle RLS — https://orm.drizzle.team/docs/rls
- Drizzle + Supabase RLS helpers — https://orm.drizzle.team/docs/rls#using-with-supabase
- Repo decisions — `docs/adr/0005-multi-tenancy.md`, `docs/adr/0006-drizzle-data-layer.md`

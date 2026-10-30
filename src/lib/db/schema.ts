/**
 * Drizzle schema — the typed data layer behind the service seams
 * (docs/adr/0003, docs/adr/0006).
 *
 * Empty in Phase 1: the Website reads the Catalogue from its in-memory seed.
 * Phase 2 adds the catalogue tables here and generates the first migration with
 * `pnpm db:generate`. There is no tenancy (docs/adr/0008).
 */
export {};

import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the Customers service — the typed data layer behind the
 * service seam (docs/adr/0003, docs/adr/0006).
 *
 * This is SINGLE-TENANT by design: no `organization_id`. Multi-tenancy (org
 * scoping + RLS) is a separate, blocked track and lives only in
 * `supabase/migrations/` — do not add it here. Where they DO overlap, names are
 * kept identical to that migration (the `customer_status` enum and the
 * snake_case `created_at` column) so the two never diverge on shared ground.
 */

export const customerStatus = pgEnum("customer_status", ["active", "blocked", "pending"]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  status: customerStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A row as read from the `customers` table (`select` shape). */
export type CustomerRow = typeof customers.$inferSelect;
/** A row as written to the `customers` table (`insert` shape). */
export type NewCustomerRow = typeof customers.$inferInsert;

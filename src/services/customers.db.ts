import "server-only";

import { count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { customers, type CustomerRow } from "@/lib/db/schema";
import type { ListCustomersOptions } from "@/services/customers.mock";
import type { Customer, Paginated } from "@/services/types";

// ─────────────────────────────────────────────────────────────────────────────
// Drizzle-backed implementation of the Customers seam. Selected by
// `src/services/customers.ts` when DATABASE_URL is configured. Signatures are
// identical to the mock (customers.mock.ts) so screens and actions never change.
// See docs/adr/0006-drizzle-data-layer.md.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure mapper: a `customers` row → the seam's `Customer`. No DB access, so it is
 * unit-tested directly (customers.db.test.ts). Converts the `created_at`
 * timestamptz (a JS `Date`) to an ISO 8601 string; the enum column is already a
 * `CustomerStatus` union at the type level and passes through unchanged.
 */
export function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function searchFilter(q: string | undefined): SQL | undefined {
  const needle = q?.trim();
  if (!needle) return undefined;
  const like = `%${needle}%`;
  return or(
    ilike(customers.name, like),
    ilike(customers.email, like),
    ilike(customers.company, like),
  );
}

export async function listCustomers(opts: ListCustomersOptions = {}): Promise<Paginated<Customer>> {
  const { q, page = 1, pageSize = 10 } = opts;
  const db = getDb();
  const where = searchFilter(q);

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db.select({ value: count() }).from(customers).where(where);

  return { items: rows.map(rowToCustomer), total: totals?.value ?? 0 };
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ? rowToCustomer(row) : null;
}

export async function createCustomer(input: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
  const db = getDb();
  const [row] = await db
    .insert(customers)
    .values({
      name: input.name,
      email: input.email,
      company: input.company,
      status: input.status,
    })
    .returning();
  if (!row) throw new Error("Failed to create customer");
  return rowToCustomer(row);
}

export async function updateCustomer(
  id: string,
  patch: Partial<Omit<Customer, "id" | "createdAt">>,
): Promise<Customer> {
  const db = getDb();
  const [row] = await db.update(customers).set(patch).where(eq(customers.id, id)).returning();
  if (!row) throw new Error(`Customer ${id} not found`);
  return rowToCustomer(row);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = getDb();
  await db.delete(customers).where(eq(customers.id, id));
}

import { isDatabaseConfigured } from "@/env.server";
import * as dbImpl from "@/services/customers.db";
import type { ListCustomersOptions } from "@/services/customers.mock";
import * as mockImpl from "@/services/customers.mock";
import type { Customer, Paginated } from "@/services/types";

// ─────────────────────────────────────────────────────────────────────────────
// Customers Service Seam. Screens (RSC) and Server Actions import from here and
// never touch a data source directly. This module is a thin SELECTOR: with a
// DATABASE_URL configured it resolves to the Drizzle-backed impl, otherwise to
// the in-memory mock (the default). See docs/adr/0003 and docs/adr/0006.
// ─────────────────────────────────────────────────────────────────────────────

export type { ListCustomersOptions };

/**
 * The seam's public contract. Both implementations are checked against it below,
 * so `customers.db.ts` and `customers.mock.ts` can never drift out of signature
 * with each other or with what callers depend on.
 */
interface CustomersService {
  listCustomers(opts?: ListCustomersOptions): Promise<Paginated<Customer>>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(input: Omit<Customer, "id" | "createdAt">): Promise<Customer>;
  updateCustomer(id: string, patch: Partial<Omit<Customer, "id" | "createdAt">>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
}

const impl: CustomersService = isDatabaseConfigured ? dbImpl : mockImpl;

export const listCustomers = impl.listCustomers;
export const getCustomer = impl.getCustomer;
export const createCustomer = impl.createCustomer;
export const updateCustomer = impl.updateCustomer;
export const deleteCustomer = impl.deleteCustomer;

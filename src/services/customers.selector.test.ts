import { afterEach, describe, expect, it, vi } from "vitest";

// The seam (customers.ts) selects its implementation from DATABASE_URL at import
// time. These tests re-import it under each env so both arms of the selector are
// verified: mock by default, Drizzle-backed when a database is configured. Only
// the selection is checked — no DB function is called, so nothing connects.

describe("customers seam selector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves to the in-memory mock when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();

    const seam = await import("./customers");
    const mock = await import("./customers.mock");

    expect(seam.listCustomers).toBe(mock.listCustomers);
    expect(seam.getCustomer).toBe(mock.getCustomer);
    expect(seam.createCustomer).toBe(mock.createCustomer);
    expect(seam.updateCustomer).toBe(mock.updateCustomer);
    expect(seam.deleteCustomer).toBe(mock.deleteCustomer);
  });

  it("resolves to the Drizzle-backed impl when DATABASE_URL is set", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:6543/postgres");
    vi.resetModules();

    const seam = await import("./customers");
    const db = await import("./customers.db");

    expect(seam.listCustomers).toBe(db.listCustomers);
    expect(seam.getCustomer).toBe(db.getCustomer);
    expect(seam.createCustomer).toBe(db.createCustomer);
    expect(seam.updateCustomer).toBe(db.updateCustomer);
    expect(seam.deleteCustomer).toBe(db.deleteCustomer);
  });
});

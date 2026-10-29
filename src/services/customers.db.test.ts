import { describe, expect, it } from "vitest";

import { rowToCustomer } from "./customers.db";
import type { CustomerRow } from "@/lib/db/schema";

// Unit test for the PURE row → Customer mapper. It needs no database: the DB
// query functions in customers.db.ts are exercised only against a live Postgres
// (see the KNOWN GAP in docs/adr/0006), but the mapper is pure and fully tested
// here — Date → ISO string and the enum → CustomerStatus passthrough.

describe("rowToCustomer", () => {
  const baseRow: CustomerRow = {
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    status: "active",
    createdAt: new Date("2026-01-04T09:00:00.000Z"),
  };

  it("maps every column to the Customer shape", () => {
    expect(rowToCustomer(baseRow)).toEqual({
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      status: "active",
      createdAt: "2026-01-04T09:00:00.000Z",
    });
  });

  it("serializes the createdAt Date to an ISO 8601 string", () => {
    const row: CustomerRow = { ...baseRow, createdAt: new Date("2026-07-31T13:45:06.000Z") };
    expect(rowToCustomer(row).createdAt).toBe("2026-07-31T13:45:06.000Z");
  });

  it("passes each customer_status enum value through unchanged", () => {
    for (const status of ["active", "blocked", "pending"] as const) {
      expect(rowToCustomer({ ...baseRow, status }).status).toBe(status);
    }
  });
});

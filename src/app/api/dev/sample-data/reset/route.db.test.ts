import { afterAll, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { describeWithDatabase, openTestDatabase } from "@/lib/db/test-database";
import { staffFromRows } from "@/services/admin.rows";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { sampleStaff } from "@/services/mock/staff";

import { loadTestCatalogue } from "../../../../../../test/catalogue-database";

// POST /api/dev/sample-data/reset on the database: the Admin specs call it
// before each test, so it must put back the seed and the sample staff list,
// and clear Staff Activity. The database project's DATABASE_URL is the local
// test database, which the route accepts.

const database = await openTestDatabase();

describeWithDatabase("POST /api/dev/sample-data/reset, on the database", database, () => {
  afterAll(async () => {
    await loadTestCatalogue(getDb());
  });

  it("re-seeds the catalogue and the sample staff, and clears Staff Activity", async () => {
    const db = getDb();
    await db.update(schema.websiteSettings).set({ contactEmail: "hello@aceyourcourse.ph" });
    await db.delete(schema.staff);
    await db.insert(schema.staffActivity).values({
      id: crypto.randomUUID(),
      at: new Date(),
      actorEmail: "angel@aceyourcourse.ph",
      actorName: "Angel Rose L. Lepaña",
      entity: "settings",
      entityId: "website",
      action: "update",
    });
    const { POST } = await import("./route");

    const before = Date.now();
    const response = await POST(
      new Request("http://localhost:3000/api/dev/sample-data/reset", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(204);
    const [settings] = await db.select().from(schema.websiteSettings);
    expect(settings?.contactEmail).toBe(CATALOGUE_SEED.settings.contactEmail);
    expect(await db.select().from(schema.staffActivity)).toEqual([]);
    const staff = staffFromRows(await db.select().from(schema.staff));
    expect(staff.staff.map(({ email, role }) => ({ email, role }))).toEqual(
      sampleStaff(new Date(before)).staff.map(({ email, role }) => ({ email, role })),
    );
    expect(staff.invites).toHaveLength(2);
  });
});

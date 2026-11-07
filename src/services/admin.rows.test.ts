import { describe, expect, it } from "vitest";

import type { StaffActivity } from "@/services/admin.types";
import { sampleStaff } from "@/services/mock/staff";

import {
  deniedSignInFromRow,
  deniedSignInToRow,
  SEEDED_RECORD,
  staffActivityFromRow,
  staffActivityToRow,
  staffFromRows,
  staffToRows,
  stampsFromRows,
  stampsToRows,
} from "./admin.rows";

// The Admin's own rows, both ways (the database arm, admin.db.ts).

const BOOT = new Date("2026-11-03T02:00:00.000Z");

describe("the staff list's rows", () => {
  it("round-trips the sample staff and Invites, in order", () => {
    const list = sampleStaff(BOOT);
    expect(staffFromRows(staffToRows(list))).toEqual(list);
  });

  it("keeps each list's order whatever order the rows come in", () => {
    const list = sampleStaff(BOOT);
    expect(staffFromRows(staffToRows(list).reverse())).toEqual(list);
  });

  it("writes one row per email: a Staff User active, an Invite invited", () => {
    const rows = staffToRows(sampleStaff(BOOT));
    expect(rows.map(({ email, status, position }) => ({ email, status, position }))).toEqual([
      { email: "angel@aceyourcourse.ph", status: "active", position: 0 },
      { email: "content@aceyourcourse.ph", status: "active", position: 1 },
      { email: "kim.reyes@gmail.com", status: "invited", position: 0 },
      { email: "expired.invite@example.com", status: "invited", position: 1 },
    ]);
  });

  it("refuses an active row with no name rather than inventing one", () => {
    const [owner] = staffToRows(sampleStaff(BOOT));
    if (!owner) throw new Error("no owner row");
    expect(() => staffFromRows([{ ...owner, name: null }])).toThrow(
      "The staff row for angel@aceyourcourse.ph has no name.",
    );
  });
});

describe("denied sign-ins and Staff Activity rows", () => {
  it("round-trips a denied sign-in", () => {
    const attempt = {
      id: "6a1f0a3e-8a59-4a47-9f53-0f7b0d6f5c11",
      email: "juan.delacruz@gmail.com",
      reason: "not-staff" as const,
      at: BOOT.toISOString(),
    };
    expect(deniedSignInFromRow(deniedSignInToRow(attempt))).toEqual(attempt);
  });

  it("round-trips a Staff Activity record, with no value before as null", () => {
    const activity: StaffActivity = {
      id: "9b2c7f1d-2f7e-4d0b-8a8e-3f6c1d2e4b5a",
      at: BOOT.toISOString(),
      actor: { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" },
      entity: "invite",
      entityId: "kim.reyes@gmail.com",
      action: "create",
      before: null,
      after: { email: "kim.reyes@gmail.com", role: "editor" },
    };
    expect(staffActivityFromRow(staffActivityToRow(activity))).toEqual(activity);
  });
});

describe("record stamps' rows", () => {
  it("round-trips the stamps, keeping the seed's time apart", () => {
    const stamps = {
      settings: { savedAt: "2026-11-03T02:05:00.000Z", savedBy: "Angel Rose L. Lepaña" },
      "product-flags:prd-001": { savedAt: "2026-11-03T02:06:00.000Z", savedBy: "AYC Content Team" },
    };
    const seeded = { record: SEEDED_RECORD, updatedAt: BOOT, updatedBy: null };
    expect(stampsFromRows([seeded, ...stampsToRows(stamps)])).toEqual({
      seededAt: BOOT.toISOString(),
      stamps,
    });
  });

  it("reads a database with no seed time as seeded at the epoch", () => {
    expect(stampsFromRows([])).toEqual({ seededAt: "1970-01-01T00:00:00.000Z", stamps: {} });
  });
});

import { describe, expect, it } from "vitest";

import type { Invite, StaffList, StaffMember } from "@/services/admin.types";

import { staffRows } from "./staff-rows";

// The ADMIN ACCOUNTS rows in Settings (mockup 694–699; BUILD-MAP §3.11): the
// signed-in Owner, the other Staff, then the Invites, each with its badge and
// status line. Times are relative to `now`, in Manila.
const NOW = new Date("2026-10-22T03:42:00.000Z"); // 11:42 AM in Manila
const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(NOW.getTime() + offset).toISOString();

const EDITOR: StaffMember = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
  addedAt: iso(-30 * DAY),
  lastSignedInAt: iso(-2 * DAY),
};
const KIM: Invite = {
  email: "kim.reyes@gmail.com",
  role: "editor",
  createdAt: iso(-DAY),
  expiresAt: iso(6 * DAY),
};

const LIST: StaffList = {
  staff: [
    {
      email: "angel@aceyourcourse.ph",
      name: "Angel Rose L. Lepaña",
      role: "owner",
      addedAt: iso(-90 * DAY),
      lastSignedInAt: null,
    },
    EDITOR,
  ],
  invites: [
    KIM,
    {
      email: "expired.invite@example.com",
      role: "owner",
      createdAt: iso(-8 * DAY),
      expiresAt: iso(-DAY),
    },
  ],
};

describe("staffRows", () => {
  it("gives the mockup's rows: you, another Staff User, an Invite and an expired one", () => {
    expect(staffRows(LIST, "angel@aceyourcourse.ph", NOW)).toEqual([
      {
        kind: "you",
        email: "angel@aceyourcourse.ph",
        name: "Angel Rose L. Lepaña",
        role: "owner",
        badge: "OWNER",
        status: "YOU · CAN’T BE REMOVED",
      },
      {
        kind: "staff",
        email: "content@aceyourcourse.ph",
        name: "AYC Content Team",
        role: "editor",
        badge: "EDITOR",
        status: "LAST SIGNED IN 2 DAYS AGO",
      },
      {
        kind: "invite",
        email: "kim.reyes@gmail.com",
        name: "Invited",
        role: "editor",
        badge: "INVITED",
        status: "EXPIRES IN 6 DAYS",
        expiresAt: iso(6 * DAY),
      },
      {
        kind: "expired",
        email: "expired.invite@example.com",
        name: "Invited",
        role: "owner",
        badge: "INVITED",
        status: "EXPIRED",
        expiresAt: iso(-DAY),
      },
    ]);
  });

  it("recognises the signed-in Owner whatever the case of their email", () => {
    expect(staffRows(LIST, "Angel@AceYourCourse.PH", NOW)[0]?.kind).toBe("you");
  });

  it.each([
    [7 * DAY, "EXPIRES IN 7 DAYS"],
    [6 * DAY + 1, "EXPIRES IN 7 DAYS"],
    [DAY + 1, "EXPIRES IN 2 DAYS"],
    [DAY, "EXPIRES IN 1 DAY"],
    [1, "EXPIRES IN 1 DAY"],
  ])("counts an Invite expiring in %i ms as %j", (left, status) => {
    const list = { staff: [], invites: [{ ...KIM, expiresAt: iso(left) }] };
    expect(staffRows(list, "angel@aceyourcourse.ph", NOW)[0]).toMatchObject({
      kind: "invite",
      status,
    });
  });

  it("shows an Invite as expired from the moment it expires", () => {
    const list = { staff: [], invites: [{ ...KIM, expiresAt: iso(0) }] };
    expect(staffRows(list, "angel@aceyourcourse.ph", NOW)[0]).toMatchObject({
      kind: "expired",
      status: "EXPIRED",
    });
  });

  it.each([
    [null, "NOT SIGNED IN YET"],
    [iso(-60 * 1000), "LAST SIGNED IN TODAY"],
    // 11:42 PM the day before, in Manila.
    [iso(-12 * 60 * 60 * 1000), "LAST SIGNED IN YESTERDAY"],
    [iso(-2 * DAY), "LAST SIGNED IN 2 DAYS AGO"],
    [iso(-45 * DAY), "LAST SIGNED IN 45 DAYS AGO"],
  ])("says when a Staff User last signed in (%s) as %j, by Manila days", (at, status) => {
    const list = { staff: [{ ...EDITOR, lastSignedInAt: at }], invites: [] };
    expect(staffRows(list, "angel@aceyourcourse.ph", NOW)[0]).toMatchObject({ status });
  });

  it("counts Manila days: 12:30 AM today in Manila is today, though it's yesterday in UTC", () => {
    const now = new Date("2026-10-22T16:30:00.000Z"); // 12:30 AM, 23 Oct in Manila
    const list = {
      staff: [{ ...EDITOR, lastSignedInAt: "2026-10-22T16:05:00.000Z" }],
      invites: [],
    };
    expect(staffRows(list, "angel@aceyourcourse.ph", now)[0]?.status).toBe("LAST SIGNED IN TODAY");
  });
});

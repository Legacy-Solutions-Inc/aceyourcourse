import { describe, expect, it } from "vitest";

import {
  isDeletionConfirmed,
  isPrivacyRequestOverdue,
  PRIVACY_REQUEST_DAYS,
  privacyRequestDueOn,
} from "./privacy-requests";

// The Privacy Request deadlines (spec, Phase 3 → Privacy Requests; Privacy
// Policy §14): a data copy within 7 days, a deletion within 30, counted in
// Asia/Manila calendar days from the day the Member asked. A request still
// open after its due date is overdue.

describe("PRIVACY_REQUEST_DAYS", () => {
  it("gives a data copy 7 days and a deletion 30", () => {
    expect(PRIVACY_REQUEST_DAYS).toEqual({ "data-copy": 7, deletion: 30 });
  });
});

describe("privacyRequestDueOn", () => {
  // 10:00 on 19 Nov 2026 in Manila.
  const MORNING_OF_THE_19TH = new Date("2026-11-19T02:00:00.000Z");

  it("dues a data copy 7 days after the Manila day it was asked for", () => {
    expect(privacyRequestDueOn("data-copy", MORNING_OF_THE_19TH)).toBe("2026-11-26");
  });

  it("dues a deletion 30 days after", () => {
    expect(privacyRequestDueOn("deletion", MORNING_OF_THE_19TH)).toBe("2026-12-19");
  });

  it("counts from the day in Manila, not in UTC", () => {
    // 00:30 on 20 Nov in Manila is still the 19th in UTC.
    expect(privacyRequestDueOn("data-copy", new Date("2026-11-19T16:30:00.000Z"))).toBe(
      "2026-11-27",
    );
    // 23:30 on 19 Nov in Manila.
    expect(privacyRequestDueOn("data-copy", new Date("2026-11-19T15:30:00.000Z"))).toBe(
      "2026-11-26",
    );
  });

  it("runs across the end of a month and a year", () => {
    expect(privacyRequestDueOn("deletion", new Date("2026-12-15T04:00:00.000Z"))).toBe(
      "2027-01-14",
    );
  });
});

describe("isPrivacyRequestOverdue", () => {
  const due = { status: "open", dueOn: "2026-11-26" } as const;

  it("isn't overdue on its due date, a minute before Manila midnight", () => {
    // 23:59 on 26 Nov in Manila.
    expect(isPrivacyRequestOverdue(due, new Date("2026-11-26T15:59:00.000Z"))).toBe(false);
  });

  it("is overdue from Manila midnight after its due date", () => {
    // 00:00 on 27 Nov in Manila is still the 26th in UTC.
    expect(isPrivacyRequestOverdue(due, new Date("2026-11-26T16:00:00.000Z"))).toBe(true);
  });

  it("isn't overdue before its due date", () => {
    expect(isPrivacyRequestOverdue(due, new Date("2026-11-20T04:00:00.000Z"))).toBe(false);
  });

  it("is never overdue once done", () => {
    expect(
      isPrivacyRequestOverdue({ ...due, status: "done" }, new Date("2027-01-01T04:00:00.000Z")),
    ).toBe(false);
  });
});

describe("isDeletionConfirmed", () => {
  it.each(["DELETE", " DELETE ", "DELETE\n"])("accepts %j", (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(true);
  });

  it.each(["", "delete", "Delete", "DELET", "DELETE ME", "yes"])("refuses %j", (typed) => {
    expect(isDeletionConfirmed(typed)).toBe(false);
  });
});

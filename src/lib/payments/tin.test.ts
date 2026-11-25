import { describe, expect, it } from "vitest";

import { normaliseTin } from "./tin";

// A Philippine Taxpayer Identification Number (Phase 4, tickets 06 and 08):
// 9 digits, optionally followed by a 3- or 5-digit branch code, typed with
// or without dashes, kept with dashes in groups of three. The values here
// are made up.

describe("normaliseTin", () => {
  it.each([
    ["123-456-789", "123-456-789"],
    ["123456789", "123-456-789"],
    ["123-456-789-000", "123-456-789-000"],
    ["123456789000", "123-456-789-000"],
    ["123-456-789-00000", "123-456-789-00000"],
    ["12345678900000", "123-456-789-00000"],
    ["  123-456-789  ", "123-456-789"],
  ])("keeps %j as %j", (typed, kept) => {
    expect(normaliseTin(typed)).toBe(kept);
  });

  it.each([
    ["too few digits", "12345678"],
    ["ten digits", "1234567890"],
    ["a 4-digit branch code", "123-456-789-0000"],
    ["letters", "123-456-78A"],
    ["dashes in the wrong places", "12-3456-789"],
    ["spaces between the groups", "123 456 789"],
    ["nothing", ""],
  ])("refuses %s", (_what, typed) => {
    expect(normaliseTin(typed)).toBeNull();
  });
});

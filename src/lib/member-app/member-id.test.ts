import { describe, expect, it } from "vitest";

import { memberWatermark, shortMemberId } from "./member-id";

// The short Member ID the watermark shows with the Member's email (spec,
// Phase 3 → Burned-in watermark): enough of their User id to trace a copied
// card back to the account.
describe("shortMemberId", () => {
  it("is the first 8 characters of the User id, uppercase", () => {
    expect(shortMemberId("3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b")).toBe("3F1A5C2E");
  });

  it("refuses something that isn't a User id", () => {
    expect(() => shortMemberId("tester@example.com")).toThrow(RangeError);
  });
});

describe("memberWatermark", () => {
  it("is the Member's email and short Member ID", () => {
    expect(memberWatermark("tester@example.com", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b")).toBe(
      "tester@example.com · 3F1A5C2E",
    );
  });
});

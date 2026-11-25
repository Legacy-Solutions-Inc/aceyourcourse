import { describe, expect, it } from "vitest";

import { computePaymentsMode, paymentsClient, paymentsMode, samplePaymentsFake } from "./payments";

// The payments selector (Phase 4, ticket 03; spec, Phase 4 planning decisions
// → The key decides; no new switch): which payments client this server has.
// Sample mode has the fake; anywhere else there's none until ticket 04 adds
// PayMongo's key rules, and the Plans page reads "Buying opens soon".

describe("computePaymentsMode", () => {
  it("uses the fake in sample mode", () => {
    expect(computePaymentsMode({ adminMode: "sample" })).toBe("fake");
  });

  it.each(["live", "closed"] as const)("has no client in %s mode", (adminMode) => {
    expect(computePaymentsMode({ adminMode })).toBe("none");
  });
});

describe("paymentsClient", () => {
  // The unit tests run in sample mode (vitest.config.ts blanks Supabase and the database).
  it("gives the fake in sample mode, the same one each time", () => {
    expect(paymentsMode).toBe("fake");
    const client = paymentsClient();
    expect(client?.kind).toBe("fake");
    expect(paymentsClient()).toBe(client);
    expect(samplePaymentsFake()).toBe(client);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computePaymentsMode,
  paymentsClient,
  paymentsKeyWarning,
  paymentsMode,
  samplePaymentsFake,
  testPaymentsShown,
} from "./payments";

// The payments selector (Phase 4, tickets 03 and 04; spec, Phase 4 planning
// decisions → The key decides; no new switch): which payments client this
// server has. Sample mode has the fake. Anywhere else PayMongo's secret key
// decides: a test key takes PayMongo's test payments, a live key real money,
// and no key, or one that isn't PayMongo's, leaves buying off ("Buying opens
// soon").

const TEST_KEY = "sk_test_Ab12Cd34Ef56Gh78";
const LIVE_KEY = "sk_live_Ab12Cd34Ef56Gh78";

describe("computePaymentsMode", () => {
  it("uses the fake in sample mode, whatever the key", () => {
    expect(computePaymentsMode({ adminMode: "sample", secretKey: undefined })).toBe("fake");
    expect(computePaymentsMode({ adminMode: "sample", secretKey: LIVE_KEY })).toBe("fake");
  });

  it.each(["live", "closed"] as const)("takes test payments with a test key in %s mode", (mode) => {
    expect(computePaymentsMode({ adminMode: mode, secretKey: TEST_KEY })).toBe("test");
  });

  it("takes real money with a live key", () => {
    expect(computePaymentsMode({ adminMode: "live", secretKey: LIVE_KEY })).toBe("live");
  });

  it.each([
    ["no key", undefined],
    ["an empty key", ""],
    ["a public key", "pk_test_Ab12Cd34Ef56Gh78"],
    ["a key with no body", "sk_test_"],
    ["a key of another kind", "sk_prod_Ab12Cd34Ef56Gh78"],
    ["a key with a space in it", "sk_test_Ab12 Cd34Ef56Gh78"],
  ])("has no client with %s", (_what, secretKey) => {
    expect(computePaymentsMode({ adminMode: "live", secretKey })).toBe("none");
  });
});

describe("paymentsKeyWarning", () => {
  it("says nothing with no key, or one of PayMongo's", () => {
    expect(paymentsKeyWarning(undefined)).toBeNull();
    expect(paymentsKeyWarning(TEST_KEY)).toBeNull();
    expect(paymentsKeyWarning(LIVE_KEY)).toBeNull();
  });

  it("warns of a key that isn't PayMongo's secret key, without the key", () => {
    const warning = paymentsKeyWarning("pk_test_Ab12Cd34Ef56Gh78");

    expect(warning).toBe(
      "PAYMONGO_SECRET_KEY isn't a PayMongo secret key (sk_test_… or sk_live_…), so buying stays off.",
    );
    expect(warning).not.toContain("Ab12Cd34");
  });
});

describe("testPaymentsShown", () => {
  it("shows the TEST PAYMENTS strip for a test key alone", () => {
    expect(testPaymentsShown("test")).toBe(true);
    expect(testPaymentsShown("live")).toBe(false);
    expect(testPaymentsShown("fake")).toBe(false);
    expect(testPaymentsShown("none")).toBe(false);
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

describe("a server starting with PayMongo's key", () => {
  /** payments.ts loaded afresh on a live server with this PAYMONGO_SECRET_KEY. */
  async function serverWith(secretKey: string) {
    vi.resetModules();
    vi.doMock("@/lib/admin/mode", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
      adminMode: "live",
    }));
    vi.doMock("@/env.server", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/env.server")>();
      return { ...actual, serverEnv: { ...actual.serverEnv, PAYMONGO_SECRET_KEY: secretKey } };
    });
    return import("./payments");
  }

  afterEach(() => {
    vi.doUnmock("@/lib/admin/mode");
    vi.doUnmock("@/env.server");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("buys through PayMongo with test payments, and shows the TEST strip", async () => {
    const server = await serverWith(TEST_KEY);

    expect(server.paymentsMode).toBe("test");
    expect(server.paymentsClient()).toMatchObject({ kind: "paymongo", livemode: false });
    expect(server.samplePaymentsFake()).toBeNull();
    expect(server.showTestPaymentsStrip()).toBe(true);
  });

  it("buys through PayMongo with real money, and no strip", async () => {
    const server = await serverWith(LIVE_KEY);

    expect(server.paymentsClient()).toMatchObject({ kind: "paymongo", livemode: true });
    expect(server.showTestPaymentsStrip()).toBe(false);
  });

  it("keeps buying off with a malformed key, warning once without the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const server = await serverWith("pk_test_Ab12Cd34Ef56Gh78");

    expect(server.paymentsMode).toBe("none");
    expect(server.paymentsClient()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "PAYMONGO_SECRET_KEY isn't a PayMongo secret key (sk_test_… or sk_live_…), so buying stays off.",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Ab12Cd34");
  });
});

import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// restoreSampleData on the database re-seeds only a database on this machine.
// The Admin is closed with any other (mode.ts), so its callers never get this
// far; this check stays as a second line.

const seedCatalogue = vi.fn();

async function restoreWithDatabase(url: string) {
  vi.stubEnv("DATABASE_URL", url);
  vi.resetModules();
  vi.doMock("@/lib/catalogue-seed/seed", () => ({ seedCatalogue }));
  vi.doMock("@/lib/db/client", () => ({ getDb: () => "the database" }));
  return (await import("./sample-data")).restoreSampleData;
}

describe("restoreSampleData on the database", () => {
  beforeEach(() => {
    resetSampleStore();
    seedCatalogue.mockReset();
    seedCatalogue.mockResolvedValue({ ok: true, counts: {}, sampleStaff: {} });
    vi.mocked(revalidateTag).mockClear();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/catalogue-seed/seed");
    vi.doUnmock("@/lib/db/client");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses a database that isn't on this machine, changing nothing", async () => {
    const { generation } = getSampleStore();
    const restore = await restoreWithDatabase(
      "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    );

    expect(await restore()).toEqual({ ok: false, reason: "not-local" });
    expect(seedCatalogue).not.toHaveBeenCalled();
    expect(getSampleStore().generation).toBe(generation);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("re-seeds a local one", async () => {
    const restore = await restoreWithDatabase(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
    expect(await restore()).toEqual({ ok: true });
    expect(seedCatalogue).toHaveBeenCalledOnce();
  });

  it("throws when the seed is refused, rather than saying it reset", async () => {
    seedCatalogue.mockResolvedValue({ ok: false, reason: "invalid", errors: ["x"] });
    const restore = await restoreWithDatabase(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
    await expect(restore()).rejects.toThrow("The sample data wasn't restored (invalid).");
  });
});

// The header's Reset and the e2e specs' reset bring the sample data back as a
// server restart makes it: with the sample Orders (ticket 07) and the renewing
// tester's v2.0 agreement (Phase 4, ticket 13).
describe("restoreSampleData in memory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    resetSampleStore();
  });

  it("brings back the sample Orders and the sample agreements", async () => {
    resetSampleStore();
    const restore = await restoreWithDatabase("");

    expect(await restore()).toEqual({ ok: true });
    expect(getSampleStore().orders.length).toBeGreaterThan(0);
    expect(getSampleStore().memberConsents).toEqual([
      expect.objectContaining({ termsVersion: "2.0", privacyVersion: "2.0" }),
    ]);
  });
});

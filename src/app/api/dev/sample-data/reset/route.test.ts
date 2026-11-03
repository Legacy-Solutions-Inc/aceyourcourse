import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// POST /api/dev/sample-data/reset (CONVENTIONS §2): the Admin specs call it
// before each test, signed out. It exists only with sample data, and a page on
// another site can't call it from a browser.
const RESET_URL = "http://localhost:3000/api/dev/sample-data/reset";
const post = (headers: Record<string, string> = {}) =>
  new Request(RESET_URL, { method: "POST", headers });

/** Changes the sample data as an Admin save would. */
function editSampleData() {
  const store = getSampleStore();
  store.catalogue.settings.contactEmail = "hello@aceyourcourse.ph";
  store.stamps = { settings: { savedAt: new Date().toISOString(), savedBy: "Angel" } };
  return store.generation;
}

describe("POST /api/dev/sample-data/reset", () => {
  beforeEach(() => {
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  it("starts the sample data again from the seed and clears every Catalogue read", async () => {
    const generation = editSampleData();
    const { POST } = await import("./route");

    const response = await POST(post());

    expect(response.status).toBe(204);
    const store = getSampleStore();
    expect(store.catalogue.settings.contactEmail).toBe("aceyourcourseinc@gmail.com");
    expect(store.stamps).toEqual({});
    expect(store.generation).not.toBe(generation);
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([["catalogue"]]);
  });

  it("answers a POST from this site's own pages", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ origin: "http://localhost:3000" }))).status).toBe(204);
  });

  it.each(["https://evil.example", "http://localhost:3001"])(
    "refuses a POST from a page on %s, changing nothing",
    async (origin) => {
      const generation = editSampleData();
      const { POST } = await import("./route");

      expect((await POST(post({ origin }))).status).toBe(403);
      expect(getSampleStore().generation).toBe(generation);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  describe("with the Admin closed", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      vi.resetModules();
    });

    it("answers 404 and changes nothing", async () => {
      const generation = editSampleData();
      const { POST } = await import("./route");

      expect((await POST(post())).status).toBe(404);
      expect(getSampleStore().generation).toBe(generation);
      expect(getSampleStore().catalogue.settings.contactEmail).toBe("hello@aceyourcourse.ph");
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("on the database (DATABASE_URL set)", () => {
    const seedCatalogue = vi.fn();

    /** Imports the route with DATABASE_URL as given, over a stand-in seed and database. */
    async function routeWithDatabase(url: string) {
      vi.stubEnv("DATABASE_URL", url);
      vi.resetModules();
      vi.doMock("@/lib/catalogue-seed/seed", () => ({ seedCatalogue }));
      vi.doMock("@/lib/db/client", () => ({ getDb: () => "the database" }));
      return import("./route");
    }

    beforeEach(() => {
      seedCatalogue.mockReset();
      seedCatalogue.mockResolvedValue({ ok: true, counts: {}, sampleStaff: {} });
    });

    afterEach(() => {
      vi.doUnmock("@/lib/catalogue-seed/seed");
      vi.doUnmock("@/lib/db/client");
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      vi.resetModules();
    });

    it.each([
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "postgresql://postgres:postgres@localhost:54322/postgres",
    ])("re-seeds a local database (%s), then clears every Catalogue read", async (url) => {
      const generation = editSampleData();
      const { POST } = await routeWithDatabase(url);

      expect((await POST(post())).status).toBe(204);
      expect(seedCatalogue).toHaveBeenCalledOnce();
      expect(seedCatalogue.mock.calls[0]?.[0]).toBe("the database");
      expect(getSampleStore().generation).not.toBe(generation);
      expect(vi.mocked(revalidateTag).mock.calls).toEqual([["catalogue"]]);
    });

    it("answers 404 for a database that isn't on this machine, even in development", async () => {
      // The Admin is closed then (src/lib/admin/mode.ts), so the route doesn't exist.
      const generation = editSampleData();
      const { POST } = await routeWithDatabase(
        "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      );

      expect((await POST(post())).status).toBe(404);
      expect(seedCatalogue).not.toHaveBeenCalled();
      expect(getSampleStore().generation).toBe(generation);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("answers 404 in production, even for a local database", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      const { POST } = await routeWithDatabase(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      );

      expect((await POST(post())).status).toBe(404);
      expect(seedCatalogue).not.toHaveBeenCalled();
    });
  });
});

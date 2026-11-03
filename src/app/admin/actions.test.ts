import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The header's Reset button (sample data only), which any Staff User may use.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function editSampleData() {
  const store = getSampleStore();
  store.catalogue.settings.contactEmail = "hello@aceyourcourse.ph";
  return store.generation;
}

describe("resetSampleData", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    vi.mocked(revalidateTag).mockClear();
  });

  it("lets an Editor start the sample data again from the seed, clearing every Catalogue read", async () => {
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
    const generation = editSampleData();
    const { resetSampleData } = await import("./actions");

    await resetSampleData();

    expect(getSampleStore().generation).not.toBe(generation);
    expect(getSampleStore().catalogue.settings.contactEmail).toBe("aceyourcourseinc@gmail.com");
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([["catalogue"]]);
  });

  it("sends a signed-out caller to sign-in and changes nothing", async () => {
    const generation = editSampleData();
    const { resetSampleData } = await import("./actions");

    await expect(resetSampleData()).rejects.toThrow("NEXT_REDIRECT /admin/sign-in?next=%2Fadmin");
    expect(getSampleStore().generation).toBe(generation);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a User who isn't Staff and changes nothing", async () => {
    jar.set("ayc_admin_sample", "juan.delacruz@gmail.com");
    editSampleData();
    const { resetSampleData } = await import("./actions");

    await expect(resetSampleData()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
    expect(getSampleStore().catalogue.settings.contactEmail).toBe("hello@aceyourcourse.ph");
  });

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

    it("answers not found and changes nothing", async () => {
      jar.set("ayc_admin_sample", "angel@aceyourcourse.ph");
      const generation = editSampleData();
      const { resetSampleData } = await import("./actions");

      await expect(resetSampleData()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getSampleStore().generation).toBe(generation);
    });
  });

  describe("on a database that isn't on this machine", () => {
    const seedCatalogue = vi.fn();

    beforeEach(() => {
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      );
      vi.resetModules();
      // The Staff Guard would read the staff list from that database.
      vi.doMock("@/lib/admin/guard", () => ({
        requireStaff: async () => ({
          email: "angel@aceyourcourse.ph",
          name: "Angel",
          role: "owner",
        }),
      }));
      vi.doMock("@/lib/catalogue-seed/seed", () => ({ seedCatalogue }));
    });

    afterEach(() => {
      vi.doUnmock("@/lib/admin/guard");
      vi.doUnmock("@/lib/catalogue-seed/seed");
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("refuses, as the reset route does, and changes nothing", async () => {
      const generation = editSampleData();
      const { resetSampleData } = await import("./actions");

      await expect(resetSampleData()).rejects.toThrow(
        "The sample data can only be reset on a local database.",
      );
      expect(seedCatalogue).not.toHaveBeenCalled();
      expect(getSampleStore().generation).toBe(generation);
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import type { StaffActor } from "@/services/admin.types";

// The upload seam (uploads.ts) picks its arm at import time: Supabase Storage
// when the database is configured, the sample arm otherwise (ticket 17).
// Nothing connects here: the Storage arm only reaches Storage when called.

const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

async function importWith(env: { DATABASE_URL: string; SUPABASE_SECRET_KEY?: string }) {
  vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_SECRET_KEY", env.SUPABASE_SECRET_KEY ?? "");
  vi.resetModules();
  return {
    seam: await import("./uploads"),
    storage: (await import("./uploads.storage")).storageArm,
    sample: await import("./uploads.mock"),
  };
}

describe("upload seam selector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uploads to Storage when the database is configured", async () => {
    const { seam, storage } = await importWith({
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:54322/postgres",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    });
    expect(seam.createUpload).toBe(storage.createUpload);
  });

  it("uploads to the sample data when it isn't", async () => {
    const { seam, sample } = await importWith({ DATABASE_URL: "" });
    expect(seam.createUpload).toBe(sample.createUpload);
  });

  it("fails clearly, with the database configured but no secret key", async () => {
    const { seam } = await importWith({
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:54322/postgres",
    });

    await expect(
      seam.createUpload(EDITOR, { purpose: "product-photo", contentType: "image/png", size: 64 }),
    ).rejects.toThrow("Storage isn't configured on this server.");
  });
});

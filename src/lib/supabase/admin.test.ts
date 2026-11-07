import { afterEach, describe, expect, it, vi } from "vitest";

// The secret-key Storage client (ticket 17). It's made on first use, from the
// server env, so a server without the key fails the call that needs Storage,
// with a message that names neither value. Nothing here connects.

async function importWith(env: { url?: string; key?: string }) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.url ?? "");
  vi.stubEnv("SUPABASE_SECRET_KEY", env.key ?? "");
  vi.resetModules();
  return import("./admin");
}

describe("the Storage client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is made once, on first use, for NEXT_PUBLIC_SUPABASE_URL", async () => {
    const admin = await importWith({ url: "http://127.0.0.1:54321", key: "sb_secret_test" });

    expect(admin.isStorageConfigured).toBe(true);
    const storage = admin.getStorage();
    expect(storage.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(admin.getStorage()).toBe(storage);
  });

  it.each([
    ["no secret key", { url: "http://127.0.0.1:54321" }],
    ["no Supabase URL", { key: "sb_secret_test" }],
  ])("fails clearly with %s, naming neither value", async (_, env) => {
    const admin = await importWith(env);

    expect(admin.isStorageConfigured).toBe(false);
    expect(() => admin.getStorage()).toThrow(new Error("Storage isn't configured on this server."));
  });
});

import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { AUTH_ADMIN_NOT_CONFIGURED, chooseAuthAdmin, supabaseAuthAdmin } from "./auth-admin";

// The auth admin (ticket 19): how deleting a Member's account deletes their
// Supabase User. The real one asks Supabase Auth's admin API, with the
// server-only secret-key client; Supabase's own client is the boundary here,
// so it's replaced. Which one a server uses depends on its mode: a live
// Admin needs the secret key, and sample mode has no Supabase Users at all.

const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";

/** Supabase Auth's admin API, answering deleteUser with `answer`. */
function adminApi(answer: () => Promise<{ error: Error | null }>) {
  return { deleteUser: vi.fn(answer) };
}

describe("supabaseAuthAdmin", () => {
  it("deletes the User by id", async () => {
    const api = adminApi(async () => ({ error: null }));

    const admin = supabaseAuthAdmin(api);
    expect(admin.configured).toBe(true);
    expect(await admin.deleteUser(BEA)).toEqual({ ok: true });
    expect(api.deleteUser).toHaveBeenCalledWith(BEA);
  });

  it("counts a User already gone as deleted, so a retry is safe", async () => {
    const api = adminApi(async () => ({
      error: new AuthApiError("User not found", 404, "user_not_found"),
    }));

    expect(await supabaseAuthAdmin(api).deleteUser(BEA)).toEqual({ ok: true });
  });

  it("gives any other refusal back, without throwing", async () => {
    const api = adminApi(async () => ({
      error: new AuthApiError("Database error deleting user", 500, "unexpected_failure"),
    }));

    expect(await supabaseAuthAdmin(api).deleteUser(BEA)).toEqual({
      ok: false,
      message: "Database error deleting user",
    });
  });

  it("gives a request that never arrived back, without throwing", async () => {
    const api = adminApi(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await supabaseAuthAdmin(api).deleteUser(BEA)).toEqual({
      ok: false,
      message: "fetch failed",
    });
  });
});

describe("chooseAuthAdmin", () => {
  it("uses Supabase for a live Admin with the secret key", () => {
    expect(chooseAuthAdmin("live", true)).toBe("supabase");
  });

  it("can delete no Supabase User for a live Admin without the secret key", () => {
    expect(chooseAuthAdmin("live", false)).toBe("unavailable");
  });

  it("uses the fake in sample mode, where “Sign in as” makes no Supabase Users, key or not", () => {
    expect(chooseAuthAdmin("sample", false)).toBe("sample");
    expect(chooseAuthAdmin("sample", true)).toBe("sample");
  });

  it("deletes nothing while the Admin is closed", () => {
    expect(chooseAuthAdmin("closed", true)).toBe("unavailable");
  });
});

describe("AUTH_ADMIN_NOT_CONFIGURED", () => {
  it("names the setting, never its value", () => {
    expect(AUTH_ADMIN_NOT_CONFIGURED).toBe(
      "SUPABASE_SECRET_KEY isn't set on this server, so no Supabase User can be deleted.",
    );
  });
});

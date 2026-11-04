import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The development-only "Sign in as" action: it sets the sample cookie, asks the
// staff list, and records a refused sign-in. The cookie jar and redirect() are
// the framework boundary, so they are replaced.
const { jar } = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options?: Record<string, unknown> }>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const cookie = jar.get(name);
      return cookie ? { name, value: cookie.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, { value, options });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
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

const IDLE = { error: null, email: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function signInAs(fields: Record<string, string>) {
  const { signInAs } = await import("./actions");
  return signInAs(IDLE, form(fields));
}

describe("signInAs (sample mode)", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  it("signs in as the Owner with an httpOnly, same-site cookie and goes to next", async () => {
    await expect(
      signInAs({ email: "angel@aceyourcourse.ph", next: "/admin/products" }),
    ).rejects.toThrow(/^NEXT_REDIRECT \/admin\/products$/);
    expect(jar.get("ayc_admin_sample")).toEqual({
      value: "angel@aceyourcourse.ph",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    });
  });

  it.each(["https://evil.example", "//evil.example", "/app", "/admin/../app", ""])(
    "goes to the Overview instead of next=%j",
    async (next) => {
      await expect(signInAs({ email: "angel@aceyourcourse.ph", next })).rejects.toThrow(
        /^NEXT_REDIRECT \/admin$/,
      );
    },
  );

  it("records the time of the sign-in on the Staff User's row, for LAST SIGNED IN", async () => {
    const editor = () =>
      getSampleStore().staff.find((member) => member.email === "content@aceyourcourse.ph");
    const before = editor()?.lastSignedInAt ?? "";
    const signedInAt = Date.now();

    await expect(signInAs({ email: "Content@AceYourCourse.ph" })).rejects.toThrow(
      /^NEXT_REDIRECT \/admin$/,
    );
    const recorded = editor()?.lastSignedInAt ?? "";
    expect(recorded).not.toBe(before);
    expect(new Date(recorded).getTime()).toBeGreaterThanOrEqual(signedInAt);
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it("activates Kim's Invite from an upper-case Other email, and records it", async () => {
    await expect(signInAs({ email: " KIM.REYES@GMAIL.COM " })).rejects.toThrow(
      /^NEXT_REDIRECT \/admin$/,
    );
    expect(jar.get("ayc_admin_sample")?.value).toBe("kim.reyes@gmail.com");
    const store = getSampleStore();
    expect(store.staff).toContainEqual(
      expect.objectContaining({ email: "kim.reyes@gmail.com", name: "Kim Reyes", role: "editor" }),
    );
    expect(store.staffActivity).toHaveLength(1);
    expect(store.deniedSignIns).toEqual([]);
  });

  it("sends Juan to the 403 screen and records the attempt", async () => {
    const before = Date.now();
    await expect(signInAs({ email: "juan.delacruz@gmail.com" })).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/denied\?reason=not-staff$/,
    );
    const [attempt, ...others] = getSampleStore().deniedSignIns;
    expect(others).toEqual([]);
    expect(attempt).toMatchObject({ email: "juan.delacruz@gmail.com", reason: "not-staff" });
    expect(new Date(attempt?.at ?? 0).getTime()).toBeGreaterThanOrEqual(before);
    // Still signed in as Juan, so the 403 screen can name the account.
    expect(jar.get("ayc_admin_sample")?.value).toBe("juan.delacruz@gmail.com");
  });

  it("sends the expired Invite to the 403 screen saying so, and records the attempt", async () => {
    await expect(signInAs({ email: "expired.invite@example.com" })).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/denied\?reason=invite-expired$/,
    );
    expect(getSampleStore().deniedSignIns).toEqual([
      expect.objectContaining({ email: "expired.invite@example.com", reason: "invite-expired" }),
    ]);
  });

  it.each([
    ["", "Enter an email address."],
    ["   ", "Enter an email address."],
    ["not-an-email", "Enter a valid email address, like name@example.com."],
    ["angel@", "Enter a valid email address, like name@example.com."],
  ])("rejects the Other email %j with a message, signing nobody in", async (email, message) => {
    expect(await signInAs({ email })).toEqual({ error: message, email });
    expect(jar.size).toBe(0);
    expect(getSampleStore().deniedSignIns).toEqual([]);
  });

  it("rejects a form with no email field", async () => {
    expect(await signInAs({})).toEqual({ error: "Enter an email address.", email: "" });
    expect(jar.size).toBe(0);
  });
});

describe("signInWithPassword (sample mode)", () => {
  it("answers 404: the password box runs in live mode only", async () => {
    const { signInWithPassword } = await import("./actions");
    await expect(
      signInWithPassword(
        { error: null, fieldErrors: {}, email: "" },
        form({ email: "angel@aceyourcourse.ph", password: "anything" }),
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(jar.size).toBe(0);
  });
});

describe("signOut", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  it("clears the session and returns to sign-in", async () => {
    jar.set("ayc_admin_sample", { value: "angel@aceyourcourse.ph" });
    const { signOut } = await import("../actions");
    await expect(signOut()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in$/);
    expect(jar.has("ayc_admin_sample")).toBe(false);
  });
});

describe("closed mode", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    // config.ts warns that production has no Supabase; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("refuses to sign anyone in", async () => {
    await expect(signInAs({ email: "angel@aceyourcourse.ph" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(jar.size).toBe(0);
  });

  it("answers 404 to the password box", async () => {
    const { signInWithPassword } = await import("./actions");
    await expect(
      signInWithPassword(
        { error: null, fieldErrors: {}, email: "" },
        form({ email: "angel@aceyourcourse.ph", password: "anything" }),
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 to sign out", async () => {
    const { signOut } = await import("../actions");
    await expect(signOut()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

// @vitest-environment node
import type { User } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The Staff Guard in live mode (ticket 16): the identity comes from Supabase's
// getUser(), and the staff list decides, exactly as in sample mode. The
// session's verified sign-in method (getClaims' amr, ticket 19) counts too:
// Google always, a password only under `pnpm dev`. The staff
// list here is the sample one, through the Admin seam's sample arm; Supabase's
// server client, next/headers and next/navigation are the boundary, so they
// are replaced.

const { getUser, getClaims, signOut, jar } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
  jar: new Map<string, string>(),
}));

vi.mock("@/lib/admin/mode", () => ({ adminMode: "live" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser, getClaims, signOut } }),
}));
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

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";
const KIM = "kim.reyes@gmail.com";
const JUAN = "juan.delacruz@gmail.com";

/**
 * Signs in to Supabase as a User with this email, verified unless said
 * otherwise: with Google unless `method` says how the session signed in.
 */
function signedInAs(
  email: string,
  { verified = true, name = "Google Name", method = "oauth" } = {},
) {
  const id = crypto.randomUUID();
  getClaims.mockResolvedValue({
    data: { claims: { sub: id, amr: [{ method, timestamp: 1_793_750_400 }] } },
    error: null,
  });
  const user = {
    id,
    app_metadata: { provider: "google" },
    // A role set here by the User themselves: it must change nothing.
    user_metadata: { role: "owner" },
    aud: "authenticated",
    created_at: "2026-11-04T00:00:00Z",
    email,
    email_confirmed_at: verified ? "2026-11-04T00:00:00Z" : undefined,
    identities: [
      {
        id: "google-1",
        identity_id: crypto.randomUUID(),
        user_id: "u",
        provider: "google",
        identity_data: { email, email_verified: verified, full_name: name },
      },
    ],
  } satisfies User;
  getUser.mockResolvedValue({ data: { user }, error: null });
}

const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

describe("Staff Guard (live mode)", () => {
  // Supabase configured, as live mode has it; the modules load once, after this.
  beforeAll(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: null, error: null });
    signOut.mockReset();
  });

  it("lets a verified Staff email in, with its Staff Role", async () => {
    signedInAs(OWNER);
    const { requireStaff } = await import("./guard");

    expect(await requireStaff()).toEqual({
      email: OWNER,
      name: "Angel Rose L. Lepaña",
      role: "owner",
    });
  });

  it("sends a visitor with no Supabase session to sign-in, ignoring the sample cookie", async () => {
    jar.set("ayc_admin_sample", OWNER);
    const { requireStaff } = await import("./guard");

    await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/sign-in?next=%2Fadmin"));
  });

  it("refuses a User who isn't Staff, whatever their user_metadata says, and records it", async () => {
    signedInAs(JUAN);
    const { requireStaff } = await import("./guard");

    await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
    expect(getSampleStore().deniedSignIns.map(({ email, reason }) => ({ email, reason }))).toEqual([
      { email: JUAN, reason: "not-staff" },
    ]);
  });

  it("denies a Staff User removed while signed in on their next request", async () => {
    signedInAs(EDITOR);
    const { requireStaff } = await import("./guard");
    expect((await requireStaff()).role).toBe("editor");

    const store = getSampleStore();
    store.staff = store.staff.filter((member) => member.email !== EDITOR);

    await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
  });

  it("treats a confirmed password session outside pnpm dev as signed out, recording nothing", async () => {
    signedInAs(OWNER, { method: "password" });
    const { getStaff, requireStaff } = await import("./guard");
    const { getIdentity } = await import("./identity");

    expect(await getIdentity()).toBeNull();
    expect(await getStaff()).toBeNull();
    await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/sign-in?next=%2Fadmin"));
    expect(getSampleStore().deniedSignIns).toEqual([]);
  });

  describe("under pnpm dev (ticket 19)", () => {
    beforeAll(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.resetModules();
    });

    afterAll(() => {
      vi.stubEnv("NODE_ENV", "test");
      vi.resetModules();
    });

    it("signs in a password session through continueSignIn, as after Google", async () => {
      signedInAs(OWNER, { method: "password" });
      const { continueSignIn } = await import("./guard");

      expect(await continueSignIn()).toEqual({
        status: "staff",
        actor: { email: OWNER, name: "Angel Rose L. Lepaña", role: "owner" },
      });
    });

    it("activates Kim's Invite from a password session", async () => {
      signedInAs(KIM, { name: "Kim Reyes", method: "password" });
      const { continueSignIn } = await import("./guard");

      expect(await continueSignIn()).toMatchObject({
        status: "staff",
        actor: { email: KIM, role: "editor" },
      });
      expect(getSampleStore().invites.map(({ email }) => email)).not.toContain(KIM);
    });

    it("refuses and records a password User who isn't Staff", async () => {
      signedInAs(JUAN, { method: "password" });
      const { continueSignIn } = await import("./guard");

      await expect(continueSignIn()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
      expect(
        getSampleStore().deniedSignIns.map(({ email, reason }) => ({ email, reason })),
      ).toEqual([{ email: JUAN, reason: "not-staff" }]);
    });

    it("still never counts an otp session", async () => {
      signedInAs(OWNER, { method: "otp" });
      const { continueSignIn } = await import("./guard");

      expect(await continueSignIn()).toEqual({ status: "signed-out" });
      expect(getSampleStore().deniedSignIns).toEqual([]);
    });
  });

  describe("continueSignIn", () => {
    it("signs in a verified Staff User, recording the sign-in", async () => {
      signedInAs(EDITOR);
      const { continueSignIn } = await import("./guard");

      const step = await continueSignIn();

      // The staff list's name, not the Google profile's: the profile is for display only.
      expect(step).toEqual({
        status: "staff",
        actor: { email: EDITOR, name: "AYC Content Team", role: "editor" },
      });
      const member = getSampleStore().staff.find(({ email }) => email === EDITOR);
      expect(member?.lastSignedInAt).not.toBeNull();
    });

    it("activates Kim's Invite with the Google profile's name, as in Stage A", async () => {
      signedInAs(KIM, { name: "Kim Reyes" });
      const { continueSignIn } = await import("./guard");

      expect(await continueSignIn()).toEqual({
        status: "staff",
        actor: { email: KIM, name: "Kim Reyes", role: "editor" },
      });
      const store = getSampleStore();
      expect(store.invites.map(({ email }) => email)).not.toContain(KIM);
      expect(store.staffActivity.map(({ action, entityId }) => ({ action, entityId }))).toEqual([
        { action: "activate-invite", entityId: KIM },
      ]);
    });

    it("refuses an email Google didn't verify, recording it, even on the staff list", async () => {
      signedInAs(OWNER, { verified: false });
      const { continueSignIn, requireStaff } = await import("./guard");

      expect(await continueSignIn()).toEqual({ status: "unverified" });
      expect(
        getSampleStore().deniedSignIns.map(({ email, reason }) => ({ email, reason })),
      ).toEqual([{ email: OWNER, reason: "not-staff" }]);
      await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/sign-in?next=%2Fadmin"));
    });

    it("is signed out without a session, recording nothing", async () => {
      const { continueSignIn } = await import("./guard");

      expect(await continueSignIn()).toEqual({ status: "signed-out" });
      expect(getSampleStore().deniedSignIns).toEqual([]);
    });
  });
});

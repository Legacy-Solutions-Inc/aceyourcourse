import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

// The Staff Guard with the sample identity: the ayc_admin_sample cookie names
// the signed-in User, and the staff list decides on every call. next/headers
// and next/navigation are the framework boundary, so they are replaced: the
// cookie jar is a Map, and redirect() and notFound() throw what they would.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
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
const EXPIRED = "expired.invite@example.com";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
/** Matches the error redirect() throws for exactly this URL. */
const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

async function loadGuard() {
  return import("./guard");
}

describe("Staff Guard (sample mode)", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
  });

  describe("requireStaff", () => {
    it("sends a signed-out visitor to sign-in, coming back to the Overview", async () => {
      const { requireStaff } = await loadGuard();
      await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/sign-in?next=%2Fadmin"));
    });

    it("comes back to the screen that asked", async () => {
      const { requireStaff } = await loadGuard();
      await expect(requireStaff("/admin/products")).rejects.toThrow(
        redirectsTo("/admin/sign-in?next=%2Fadmin%2Fproducts"),
      );
    });

    it("lets the Owner in as an Owner", async () => {
      signInAs(OWNER);
      const { requireStaff } = await loadGuard();
      expect(await requireStaff()).toEqual({
        email: OWNER,
        name: "Angel Rose L. Lepaña",
        role: "owner",
      });
    });

    it("lets the Editor in as an Editor", async () => {
      signInAs(EDITOR);
      const { requireStaff } = await loadGuard();
      expect(await requireStaff()).toMatchObject({ email: EDITOR, role: "editor" });
    });

    it("sends a signed-in User who isn't Staff to the 403 screen, and records the attempt", async () => {
      signInAs(JUAN);
      const { requireStaff } = await loadGuard();
      await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
      expect(getSampleStore().deniedSignIns).toEqual([
        expect.objectContaining({ email: JUAN, reason: "not-staff" }),
      ]);
    });

    it("sends the expired Invite to the 403 screen saying so, and records the attempt", async () => {
      signInAs(EXPIRED);
      const { requireStaff } = await loadGuard();
      await expect(requireStaff()).rejects.toThrow(
        redirectsTo("/admin/denied?reason=invite-expired"),
      );
      expect(getSampleStore().deniedSignIns).toEqual([
        expect.objectContaining({ email: EXPIRED, reason: "invite-expired" }),
      ]);
    });

    it("activates an unexpired Invite, as a sign-in would, recording Staff Activity once", async () => {
      signInAs(KIM);
      const { requireStaff } = await loadGuard();
      expect(await requireStaff()).toEqual({ email: KIM, name: "Kim Reyes", role: "editor" });
      expect(await requireStaff()).toMatchObject({ role: "editor" });
      expect(getSampleStore().staffActivity).toHaveLength(1);
      expect(getSampleStore().deniedSignIns).toEqual([]);
    });

    it("treats a cookie naming an unknown email as not Staff, and records the attempt", async () => {
      signInAs("someone@example.com");
      const { requireStaff } = await loadGuard();
      await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
      expect(getSampleStore().deniedSignIns).toEqual([
        expect.objectContaining({ email: "someone@example.com", reason: "not-staff" }),
      ]);
    });

    it.each(["", "angel", "angel@aceyourcourse.ph<script>"])(
      "treats a tampered cookie (%j) as signed out",
      async (value) => {
        signInAs(value);
        const { requireStaff } = await loadGuard();
        await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/sign-in?next=%2Fadmin"));
      },
    );

    it("records no sign-in: a request isn't a sign-in", async () => {
      signInAs(EDITOR);
      const { requireStaff } = await loadGuard();
      const lastSignedIn = () =>
        getSampleStore().staff.find((member) => member.email === EDITOR)?.lastSignedInAt;
      const before = lastSignedIn();
      await requireStaff();
      expect(lastSignedIn()).toBe(before);
    });

    it("reads the staff list on every call: a removed Staff User is denied on the next one", async () => {
      signInAs(EDITOR);
      const { requireStaff } = await loadGuard();
      await expect(requireStaff()).resolves.toMatchObject({ email: EDITOR });

      const store = getSampleStore();
      store.staff = store.staff.filter((member) => member.email !== EDITOR);

      await expect(requireStaff()).rejects.toThrow(redirectsTo("/admin/denied?reason=not-staff"));
      expect(getSampleStore().deniedSignIns).toEqual([
        expect.objectContaining({ email: EDITOR, reason: "not-staff" }),
      ]);
    });
  });

  describe("requireOwner", () => {
    it("lets the Owner in", async () => {
      signInAs(OWNER);
      const { requireOwner } = await loadGuard();
      expect(await requireOwner("/admin/settings")).toMatchObject({ role: "owner" });
    });

    it("refuses an Editor with the owners-only 403 screen", async () => {
      signInAs(EDITOR);
      const { requireOwner } = await loadGuard();
      await expect(requireOwner("/admin/settings")).rejects.toThrow(
        redirectsTo("/admin/denied?reason=owners-only"),
      );
    });

    it("sends a signed-out visitor to sign-in first", async () => {
      const { requireOwner } = await loadGuard();
      await expect(requireOwner("/admin/settings")).rejects.toThrow(
        redirectsTo("/admin/sign-in?next=%2Fadmin%2Fsettings"),
      );
    });

    it("refuses an Owner demoted since the last call", async () => {
      signInAs(OWNER);
      const { requireOwner } = await loadGuard();
      await expect(requireOwner()).resolves.toMatchObject({ role: "owner" });

      const owner = getSampleStore().staff.find((member) => member.email === OWNER);
      if (owner) owner.role = "editor";

      await expect(requireOwner()).rejects.toThrow(redirectsTo("/admin/denied?reason=owners-only"));
    });
  });

  describe("getStaff", () => {
    it("gives the Staff User, or null when signed out or not Staff", async () => {
      const { getStaff } = await loadGuard();
      expect(await getStaff()).toBeNull();

      signInAs(JUAN);
      expect(await getStaff()).toBeNull();

      signInAs(OWNER);
      expect(await getStaff()).toMatchObject({ email: OWNER, role: "owner" });
    });

    it("only reads: it records nothing and activates no Invite", async () => {
      const { getStaff } = await loadGuard();
      signInAs(JUAN);
      await getStaff();
      signInAs(KIM);
      expect(await getStaff()).toBeNull();
      expect(getSampleStore().deniedSignIns).toEqual([]);
      expect(getSampleStore().staffActivity).toEqual([]);
    });
  });

  describe("getDeniedScreen", () => {
    it("sends a signed-out visitor to sign-in", async () => {
      const { getDeniedScreen } = await loadGuard();
      await expect(getDeniedScreen("not-staff")).rejects.toThrow(redirectsTo("/admin/sign-in"));
    });

    it("shows a User who isn't Staff their email and the time of their latest recorded attempt", async () => {
      signInAs(JUAN);
      const { recordDeniedSignIn } = await import("@/services/admin");
      await recordDeniedSignIn({
        email: JUAN,
        reason: "not-staff",
        at: new Date("2026-10-22T03:42:00Z"),
      });
      const { getDeniedScreen } = await loadGuard();
      expect(await getDeniedScreen("not-staff")).toEqual({
        reason: "not-staff",
        email: JUAN,
        loggedAt: "2026-10-22T03:42:00.000Z",
      });
    });

    it("shows no logged time when no attempt was recorded", async () => {
      signInAs("someone@example.com");
      const { getDeniedScreen } = await loadGuard();
      expect(await getDeniedScreen("not-staff")).toEqual({
        reason: "not-staff",
        email: "someone@example.com",
        loggedAt: null,
      });
    });

    it.each(["not-staff", "invite-expired", undefined])(
      "says the Invite expired to the expired Invite, whatever the address says (%j)",
      async (reason) => {
        signInAs(EXPIRED);
        const { getDeniedScreen } = await loadGuard();
        expect(await getDeniedScreen(reason)).toMatchObject({ reason: "invite-expired" });
      },
    );

    it("records nothing itself: showing the 403 screen isn't another attempt", async () => {
      signInAs(JUAN);
      const { getDeniedScreen } = await loadGuard();
      await getDeniedScreen("not-staff");
      expect(getSampleStore().deniedSignIns).toEqual([]);
    });

    it.each(["owners-only", "invite-expired", "nonsense", undefined, ["invite-expired"]])(
      "says not-staff to a User who isn't Staff, whatever the reason in the address (%j)",
      async (reason) => {
        signInAs(JUAN);
        const { getDeniedScreen } = await loadGuard();
        expect(await getDeniedScreen(reason)).toMatchObject({ reason: "not-staff" });
      },
    );

    it("shows an Editor the owners-only screen", async () => {
      signInAs(EDITOR);
      const { getDeniedScreen } = await loadGuard();
      expect(await getDeniedScreen("owners-only")).toEqual({
        reason: "owners-only",
        actor: { email: EDITOR, name: "AYC Content Team", role: "editor" },
      });
    });

    it.each([
      [OWNER, "owners-only"],
      [OWNER, "not-staff"],
      [EDITOR, "not-staff"],
      [EDITOR, "invite-expired"],
    ])(
      "sends %s, who may use the Admin, back to the Overview (reason %s)",
      async (email, reason) => {
        signInAs(email);
        const { getDeniedScreen } = await loadGuard();
        await expect(getDeniedScreen(reason)).rejects.toThrow(redirectsTo("/admin"));
      },
    );
  });
});

describe("Staff Guard (closed mode)", () => {
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

  it("answers 404 for every check, even with the Owner's sample cookie", async () => {
    signInAs(OWNER);
    const guard = await loadGuard();
    await expect(guard.requireStaff()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(guard.requireOwner()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(guard.getStaff()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(guard.getDeniedScreen("not-staff")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(() => guard.requireAdminOpen()).toThrow("NEXT_NOT_FOUND");
  });

  it("ignores the sample cookie", async () => {
    signInAs(OWNER);
    const { getIdentity } = await import("./identity");
    expect(await getIdentity()).toBeNull();
  });
});

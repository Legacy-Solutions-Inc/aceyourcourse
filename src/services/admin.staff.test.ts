import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's staff sign-in area, run against every arm. The sample data
// (CONVENTIONS §5) has an active Owner and Editor, Kim's Invite (expires 6 days
// after boot), an expired Invite (1 day before boot), and Juan, who isn't on the
// staff list. Each test boots the data at BOOT with a fake clock.
const BOOT = new Date("2026-10-22T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" };
const EDITOR = { email: "content@aceyourcourse.ph", name: "AYC Content Team" };
const KIM = { email: "kim.reyes@gmail.com", name: "Kim Reyes" };
const EXPIRED = { email: "expired.invite@example.com", name: "Expired Invite" };
const JUAN = { email: "juan.delacruz@gmail.com", name: "Juan Dela Cruz" };

describe.each(ADMIN_ARMS)("Admin seam: staff sign-in ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("resolveSignIn", () => {
    it("lets the active Owner in as an Owner", async () => {
      expect(await seam.resolveSignIn(OWNER, BOOT)).toEqual({
        status: "staff",
        actor: { email: OWNER.email, name: OWNER.name, role: "owner" },
      });
    });

    it("lets the active Editor in as an Editor", async () => {
      expect(await seam.resolveSignIn(EDITOR, BOOT)).toEqual({
        status: "staff",
        actor: { email: EDITOR.email, name: EDITOR.name, role: "editor" },
      });
    });

    it("matches the staff list case-insensitively, ignoring spaces around the email", async () => {
      const result = await seam.resolveSignIn(
        { email: "  Angel@AceYourCourse.PH ", name: null },
        BOOT,
      );
      expect(result).toEqual({
        status: "staff",
        actor: { email: OWNER.email, name: OWNER.name, role: "owner" },
      });
    });

    it("takes the name from the staff list, not from the sign-in", async () => {
      const result = await seam.resolveSignIn({ email: OWNER.email, name: "Someone Else" }, BOOT);
      expect(result).toMatchObject({ actor: { name: OWNER.name } });
    });

    it("activates Kim's Invite as an Editor, case-insensitively, and records Staff Activity", async () => {
      const signInAt = at(DAY);
      const result = await seam.resolveSignIn({ ...KIM, email: "KIM.REYES@GMAIL.COM" }, signInAt);

      expect(result).toEqual({
        status: "staff",
        actor: { email: KIM.email, name: KIM.name, role: "editor" },
      });
      expect(await seam.getStaffByEmail(KIM.email)).toEqual({
        email: KIM.email,
        name: KIM.name,
        role: "editor",
      });
      const activity = await arm.staffActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        at: signInAt.toISOString(),
        actor: { email: KIM.email, name: KIM.name },
        entity: "staff",
        entityId: KIM.email,
        action: "activate-invite",
        before: { email: KIM.email, role: "editor", expiresAt: at(6 * DAY).toISOString() },
        after: { email: KIM.email, name: KIM.name, role: "editor" },
      });
      expect(activity[0]?.id).toEqual(expect.any(String));
    });

    it("lets Kim in again on a second sign-in, with no second Staff Activity record", async () => {
      await seam.resolveSignIn(KIM, at(DAY));
      const again = await seam.resolveSignIn({ ...KIM, email: "Kim.Reyes@Gmail.com" }, at(2 * DAY));

      expect(again).toEqual({
        status: "staff",
        actor: { email: KIM.email, name: KIM.name, role: "editor" },
      });
      expect(await arm.staffActivity()).toHaveLength(1);
    });

    it("names an activated Staff User by their email when the sign-in gives no name", async () => {
      const result = await seam.resolveSignIn({ email: KIM.email, name: null }, BOOT);
      expect(result).toMatchObject({ actor: { name: KIM.email } });
    });

    it("activates an Invite until the moment it expires, then refuses it", async () => {
      const expiry = 6 * DAY;
      expect(await seam.resolveSignIn(KIM, at(expiry - 1))).toMatchObject({ status: "staff" });

      await arm.reset();
      expect(await seam.resolveSignIn(KIM, at(expiry))).toEqual({
        status: "denied",
        reason: "invite-expired",
      });
      expect(await seam.getStaffByEmail(KIM.email)).toBeNull();
    });

    it("refuses the expired Invite and changes nothing", async () => {
      expect(await seam.resolveSignIn(EXPIRED, BOOT)).toEqual({
        status: "denied",
        reason: "invite-expired",
      });
      expect(await seam.getStaffByEmail(EXPIRED.email)).toBeNull();
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses Juan, who isn't on the staff list", async () => {
      expect(await seam.resolveSignIn(JUAN, BOOT)).toEqual({
        status: "denied",
        reason: "not-staff",
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it.each(["", "   ", "not-an-email", "angel@"])(
      "refuses a malformed email (%j) as not Staff",
      async (email) => {
        expect(await seam.resolveSignIn({ email, name: null }, BOOT)).toEqual({
          status: "denied",
          reason: "not-staff",
        });
      },
    );
  });

  describe("recordDeniedSignIn and getLatestDeniedSignIn", () => {
    it("records each denied attempt with its email, time and reason", async () => {
      const first = await seam.recordDeniedSignIn({
        email: JUAN.email,
        reason: "not-staff",
        at: BOOT,
      });
      await seam.recordDeniedSignIn({ email: EXPIRED.email, reason: "invite-expired", at: at(1) });
      await seam.recordDeniedSignIn({
        email: "JUAN.DELACRUZ@GMAIL.COM",
        reason: "not-staff",
        at: at(2),
      });

      expect(first).toEqual({
        id: expect.any(String),
        email: JUAN.email,
        reason: "not-staff",
        at: BOOT.toISOString(),
      });
      const recorded = await arm.deniedSignIns();
      expect(recorded.map(({ email, reason, at: when }) => ({ email, reason, at: when }))).toEqual([
        { email: JUAN.email, reason: "not-staff", at: BOOT.toISOString() },
        { email: EXPIRED.email, reason: "invite-expired", at: at(1).toISOString() },
        { email: JUAN.email, reason: "not-staff", at: at(2).toISOString() },
      ]);
      expect(new Set(recorded.map((attempt) => attempt.id)).size).toBe(3);
    });

    it("gives the latest attempt for an email, case-insensitively", async () => {
      await seam.recordDeniedSignIn({ email: JUAN.email, reason: "not-staff", at: at(2) });
      await seam.recordDeniedSignIn({ email: JUAN.email, reason: "not-staff", at: at(1) });

      expect(await seam.getLatestDeniedSignIn("Juan.DelaCruz@gmail.com")).toMatchObject({
        email: JUAN.email,
        at: at(2).toISOString(),
      });
    });

    it("gives null for an email with no recorded attempt", async () => {
      await seam.recordDeniedSignIn({ email: JUAN.email, reason: "not-staff", at: BOOT });
      expect(await seam.getLatestDeniedSignIn(OWNER.email)).toBeNull();
    });
  });

  describe("getStaffByEmail", () => {
    it("finds active Staff case-insensitively", async () => {
      expect(await seam.getStaffByEmail(" CONTENT@aceyourcourse.ph")).toEqual({
        email: EDITOR.email,
        name: EDITOR.name,
        role: "editor",
      });
    });

    it.each([KIM.email, EXPIRED.email, JUAN.email, "", "angel"])(
      "gives null for %j, which isn't active Staff",
      async (email) => {
        expect(await seam.getStaffByEmail(email)).toBeNull();
      },
    );

    it("hands out copies, so a caller can't change the staff list", async () => {
      const actor = await seam.getStaffByEmail(OWNER.email);
      if (actor) actor.role = "editor";
      expect(await seam.getStaffByEmail(OWNER.email)).toMatchObject({ role: "owner" });
    });
  });
});

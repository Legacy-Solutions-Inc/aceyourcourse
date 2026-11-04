import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffActor } from "@/services/admin.types";

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

// The Staff and Invites area: an Owner manages who can use the Admin (spec,
// Phase 2 → Invites, Staff access, Staff Role permissions, Staff Activity).
// Every write is Owners-only, appends one Staff Activity record with the
// values before and after, and clears no Catalogue tags.
describe.each(ADMIN_ARMS)("Admin seam: Staff and Invites ($name)", (arm) => {
  const { seam } = arm;
  const OWNER_ACTOR: StaffActor = { ...OWNER, role: "owner" };
  const EDITOR_ACTOR: StaffActor = { ...EDITOR, role: "editor" };
  const NEW_EDITOR = "new.editor@example.com";
  const ALREADY = "This email is already on the staff list.";
  const LAST_OWNER = "There must always be at least one Owner.";
  const SELF = "You can't remove or change your own access.";

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The staff list as the Owner reads it. */
  async function list() {
    const result = await seam.listStaff(OWNER_ACTOR);
    if (!result.ok) throw new Error(`listStaff refused: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  /** Makes a second active Owner, through an Invite and its first sign-in. */
  async function addSecondOwner(): Promise<StaffActor> {
    const second = { email: "owner.two@example.com", name: "Second Owner" };
    await seam.inviteStaff(OWNER_ACTOR, { email: second.email, role: "owner" });
    const signedIn = await seam.resolveSignIn(second, BOOT);
    if (signedIn.status !== "staff") throw new Error("the second Owner couldn't sign in");
    return signedIn.actor;
  }

  /** Asserts that the staff list and Staff Activity are as the data started. */
  async function expectNothingChanged(before: Awaited<ReturnType<typeof list>>) {
    expect(await list()).toEqual(before);
    expect(await arm.staffActivity()).toEqual([]);
  }

  describe("listStaff", () => {
    it("gives the Owner the active Staff and the Invites, with their times", async () => {
      expect(await seam.listStaff(OWNER_ACTOR)).toEqual({
        ok: true,
        tags: [],
        value: {
          staff: [
            {
              email: OWNER.email,
              name: OWNER.name,
              role: "owner",
              addedAt: at(-90 * DAY).toISOString(),
              lastSignedInAt: null,
            },
            {
              email: EDITOR.email,
              name: EDITOR.name,
              role: "editor",
              addedAt: at(-30 * DAY).toISOString(),
              lastSignedInAt: at(-2 * DAY).toISOString(),
            },
          ],
          invites: [
            {
              email: KIM.email,
              role: "editor",
              createdAt: at(-DAY).toISOString(),
              expiresAt: at(6 * DAY).toISOString(),
            },
            {
              email: EXPIRED.email,
              role: "editor",
              createdAt: at(-8 * DAY).toISOString(),
              expiresAt: at(-DAY).toISOString(),
            },
          ],
        },
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.listStaff(EDITOR_ACTOR)).toEqual({
        ok: false,
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN MANAGE STAFF" },
      });
    });

    it("hands out copies, so a caller can't change the staff list", async () => {
      const first = await list();
      const [owner] = first.staff;
      if (owner) owner.role = "editor";
      first.invites.length = 0;
      expect((await list()).staff[0]?.role).toBe("owner");
      expect((await list()).invites).toHaveLength(2);
    });
  });

  describe("inviteStaff", () => {
    it("makes an Invite that expires 7 days from now, and records Staff Activity", async () => {
      const invitedAt = at(5 * 60 * 1000);
      vi.setSystemTime(invitedAt);
      const expected = {
        email: NEW_EDITOR,
        role: "editor",
        createdAt: invitedAt.toISOString(),
        expiresAt: new Date(invitedAt.getTime() + 7 * DAY).toISOString(),
      };

      expect(await seam.inviteStaff(OWNER_ACTOR, { email: NEW_EDITOR, role: "editor" })).toEqual({
        ok: true,
        value: expected,
        tags: [],
      });
      expect((await list()).invites).toContainEqual(expected);
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: invitedAt.toISOString(),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "invite",
          entityId: NEW_EDITOR,
          action: "create",
          before: null,
          after: expected,
        },
      ]);
    });

    it("stores the email trimmed and lowercased", async () => {
      const result = await seam.inviteStaff(OWNER_ACTOR, {
        email: "  New.Editor@Example.COM ",
        role: "owner",
      });
      expect(result).toMatchObject({ ok: true, value: { email: NEW_EDITOR, role: "owner" } });
    });

    it("lets the new Invite's email sign in once, activating it with that Staff Role", async () => {
      await seam.inviteStaff(OWNER_ACTOR, { email: NEW_EDITOR, role: "editor" });
      expect(await seam.resolveSignIn({ email: NEW_EDITOR, name: "New Editor" }, at(DAY))).toEqual({
        status: "staff",
        actor: { email: NEW_EDITOR, name: "New Editor", role: "editor" },
      });
      const { staff, invites } = await list();
      expect(staff).toContainEqual(
        expect.objectContaining({ email: NEW_EDITOR, lastSignedInAt: at(DAY).toISOString() }),
      );
      expect(invites.map((invite) => invite.email)).not.toContain(NEW_EDITOR);
    });

    it.each([
      ["an empty email", "", "Enter an email address."],
      ["spaces", "   ", "Enter an email address."],
      ["“bad”", "bad", "Enter a valid email address, like name@example.com."],
    ])("refuses %s with a field message, and changes nothing", async (_case, email, message) => {
      const before = await list();
      expect(await seam.inviteStaff(OWNER_ACTOR, { email, role: "editor" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { email: [message] } },
      });
      await expectNothingChanged(before);
    });

    it("refuses a Staff Role that isn't Owner or Editor", async () => {
      const result = await seam.inviteStaff(OWNER_ACTOR, {
        email: NEW_EDITOR,
        role: "admin" as StaffActor["role"],
      });
      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { role: ["Choose Editor or Owner."] } },
      });
    });

    it.each([
      ["already Staff", "angel@aceyourcourse.ph"],
      ["already Staff, in capitals", "Content@AceYourCourse.ph"],
      ["already invited, in capitals", "KIM.REYES@gmail.com"],
      ["invited, though the Invite expired", EXPIRED.email],
    ])("refuses an email that is %s", async (_case, email) => {
      const before = await list();
      expect(await seam.inviteStaff(OWNER_ACTOR, { email, role: "owner" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { email: [ALREADY] } },
      });
      await expectNothingChanged(before);
    });
  });

  describe("renewInvite", () => {
    it("restarts an expired Invite's 7 days from now, so its email can sign in again", async () => {
      const renewedAt = at(60 * 1000);
      vi.setSystemTime(renewedAt);
      const [, expired] = (await list()).invites;
      const renewed = {
        email: EXPIRED.email,
        role: "editor",
        createdAt: renewedAt.toISOString(),
        expiresAt: new Date(renewedAt.getTime() + 7 * DAY).toISOString(),
      };

      expect(await seam.renewInvite(OWNER_ACTOR, "Expired.Invite@example.com")).toEqual({
        ok: true,
        value: renewed,
        tags: [],
      });
      expect((await list()).invites).toContainEqual(renewed);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "invite",
          entityId: EXPIRED.email,
          action: "renew",
          before: expired,
          after: renewed,
        }),
      ]);
      expect(await seam.resolveSignIn(EXPIRED, at(DAY))).toMatchObject({ status: "staff" });
    });

    it("answers not-found for an Invite that was cancelled, or never made", async () => {
      await seam.cancelInvite(OWNER_ACTOR, KIM.email);
      const before = await list();
      expect(await seam.renewInvite(OWNER_ACTOR, KIM.email)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.renewInvite(OWNER_ACTOR, JUAN.email)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await list()).toEqual(before);
      expect(await arm.staffActivity()).toHaveLength(1);
    });

    it("answers not-found for active Staff, who have no Invite", async () => {
      expect(await seam.renewInvite(OWNER_ACTOR, EDITOR.email)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("cancelInvite", () => {
    it("deletes the Invite, so its email is refused as not Staff, and records Staff Activity", async () => {
      const [kim] = (await list()).invites;

      expect(await seam.cancelInvite(OWNER_ACTOR, "Kim.Reyes@Gmail.com")).toEqual({
        ok: true,
        value: kim,
        tags: [],
      });
      expect((await list()).invites.map((invite) => invite.email)).toEqual([EXPIRED.email]);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "invite",
          entityId: KIM.email,
          action: "cancel",
          before: kim,
          after: null,
        }),
      ]);
      expect(await seam.resolveSignIn(KIM, BOOT)).toEqual({
        status: "denied",
        reason: "not-staff",
      });
    });

    it("answers not-found for an Invite that was already cancelled", async () => {
      await seam.cancelInvite(OWNER_ACTOR, KIM.email);
      expect(await seam.cancelInvite(OWNER_ACTOR, KIM.email)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toHaveLength(1);
    });

    it("lets the Owner invite that email again afterwards", async () => {
      await seam.cancelInvite(OWNER_ACTOR, KIM.email);
      expect(
        await seam.inviteStaff(OWNER_ACTOR, { email: KIM.email, role: "owner" }),
      ).toMatchObject({ ok: true });
    });
  });

  describe("changeStaffRole", () => {
    it("makes the Editor an Owner, and back, recording each change", async () => {
      expect(
        await seam.changeStaffRole(OWNER_ACTOR, { email: EDITOR.email, role: "owner" }),
      ).toMatchObject({ ok: true, value: { email: EDITOR.email, role: "owner" }, tags: [] });
      expect(await seam.getStaffByEmail(EDITOR.email)).toMatchObject({ role: "owner" });

      await seam.changeStaffRole(OWNER_ACTOR, {
        email: "CONTENT@aceyourcourse.ph",
        role: "editor",
      });
      expect(await seam.getStaffByEmail(EDITOR.email)).toMatchObject({ role: "editor" });

      const activity = await arm.staffActivity();
      expect(activity).toHaveLength(2);
      expect(activity[0]).toMatchObject({
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "staff",
        entityId: EDITOR.email,
        action: "change-role",
        before: { email: EDITOR.email, role: "editor" },
        after: { email: EDITOR.email, role: "owner" },
      });
      expect(activity[1]).toMatchObject({
        before: { role: "owner" },
        after: { role: "editor" },
      });
    });

    it("records nothing when the Staff User already has that Staff Role", async () => {
      expect(
        await seam.changeStaffRole(OWNER_ACTOR, { email: EDITOR.email, role: "editor" }),
      ).toMatchObject({ ok: true, value: { role: "editor" } });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses to demote the only Owner", async () => {
      const before = await list();
      expect(
        await seam.changeStaffRole(OWNER_ACTOR, { email: OWNER.email, role: "editor" }),
      ).toEqual({ ok: false, error: { kind: "invalid", fieldErrors: {}, formError: LAST_OWNER } });
      await expectNothingChanged(before);
    });

    it("lets a second Owner demote the first, but not the first themselves", async () => {
      const second = await addSecondOwner();

      expect(
        await seam.changeStaffRole(OWNER_ACTOR, { email: OWNER.email, role: "editor" }),
      ).toEqual({ ok: false, error: { kind: "invalid", fieldErrors: {}, formError: SELF } });
      expect(await seam.getStaffByEmail(OWNER.email)).toMatchObject({ role: "owner" });

      expect(
        await seam.changeStaffRole(second, { email: OWNER.email, role: "editor" }),
      ).toMatchObject({ ok: true, value: { email: OWNER.email, role: "editor" } });
      expect(await seam.getStaffByEmail(OWNER.email)).toMatchObject({ role: "editor" });
    });

    it("answers not-found for someone who isn't active Staff", async () => {
      for (const email of [KIM.email, JUAN.email]) {
        expect(await seam.changeStaffRole(OWNER_ACTOR, { email, role: "owner" })).toEqual({
          ok: false,
          error: { kind: "not-found" },
        });
      }
    });
  });

  describe("removeStaff", () => {
    it("removes the Editor from the staff list, keeping their Staff Activity", async () => {
      await seam.resolveSignIn(KIM, BOOT);
      const kimsActivation = await arm.staffActivity();
      const [, editor] = (await list()).staff;

      expect(await seam.removeStaff(OWNER_ACTOR, EDITOR.email)).toEqual({
        ok: true,
        value: editor,
        tags: [],
      });
      expect((await list()).staff.map((member) => member.email)).toEqual([OWNER.email, KIM.email]);
      expect(await seam.getStaffByEmail(EDITOR.email)).toBeNull();
      expect(await seam.resolveSignIn(EDITOR, BOOT)).toEqual({
        status: "denied",
        reason: "not-staff",
      });

      const activity = await arm.staffActivity();
      expect(activity.slice(0, 1)).toEqual(kimsActivation);
      expect(activity[1]).toMatchObject({
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "staff",
        entityId: EDITOR.email,
        action: "remove",
        before: editor,
        after: null,
      });
    });

    it("refuses to remove the only Owner", async () => {
      const before = await list();
      expect(await seam.removeStaff(OWNER_ACTOR, OWNER.email)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: LAST_OWNER },
      });
      await expectNothingChanged(before);
    });

    it("refuses an Owner removing themselves, even with a second Owner", async () => {
      const second = await addSecondOwner();
      expect(await seam.removeStaff(OWNER_ACTOR, OWNER.email)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: SELF },
      });
      expect(await seam.removeStaff(second, OWNER.email)).toMatchObject({ ok: true });
      expect(await seam.getStaffByEmail(OWNER.email)).toBeNull();
    });

    it("answers not-found for someone who isn't active Staff, or was already removed", async () => {
      await seam.removeStaff(OWNER_ACTOR, EDITOR.email);
      for (const email of [EDITOR.email, KIM.email, "bad"]) {
        expect((await seam.removeStaff(OWNER_ACTOR, email)).ok).toBe(false);
      }
      expect(await seam.removeStaff(OWNER_ACTOR, EDITOR.email)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("an Editor", () => {
    it.each([
      ["inviteStaff", () => seam.inviteStaff(EDITOR_ACTOR, { email: NEW_EDITOR, role: "editor" })],
      ["renewInvite", () => seam.renewInvite(EDITOR_ACTOR, EXPIRED.email)],
      ["cancelInvite", () => seam.cancelInvite(EDITOR_ACTOR, KIM.email)],
      [
        "changeStaffRole",
        () => seam.changeStaffRole(EDITOR_ACTOR, { email: EDITOR.email, role: "owner" }),
      ],
      ["removeStaff", () => seam.removeStaff(EDITOR_ACTOR, OWNER.email)],
    ])("is refused %s, and nothing changes", async (_name, write) => {
      const before = await list();
      expect(await write()).toEqual({
        ok: false,
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN MANAGE STAFF" },
      });
      await expectNothingChanged(before);
    });
  });

  describe("recordSignIn", () => {
    it("records the time of each sign-in on the Staff User's row", async () => {
      await seam.recordSignIn("Content@AceYourCourse.ph", at(DAY));
      expect((await list()).staff[1]?.lastSignedInAt).toBe(at(DAY).toISOString());
      await seam.recordSignIn(EDITOR.email, at(2 * DAY));
      expect((await list()).staff[1]?.lastSignedInAt).toBe(at(2 * DAY).toISOString());
    });

    it("changes nothing for someone who isn't active Staff, and records no Staff Activity", async () => {
      const before = await list();
      await seam.recordSignIn(KIM.email, at(DAY));
      await seam.recordSignIn("bad", at(DAY), "Someone");
      await expectNothingChanged(before);
    });

    // The first Owner is added at deployment named by their email (staff:add-owner),
    // and an Invite activated without a Google name is too. The first sign-in
    // with Google gives them the profile's name.
    describe("the Google profile's name", () => {
      /** Kim, active and named by their email, as when Google gave no name. */
      async function activateKimWithoutName() {
        await seam.resolveSignIn({ email: KIM.email, name: null }, BOOT);
        const activity = await arm.staffActivity();
        expect(activity).toHaveLength(1);
        return activity;
      }
      const nameOf = async (email: string) =>
        (await list()).staff.find((member) => member.email === email)?.name;

      it("replaces a name that is still the email, as display only", async () => {
        const activity = await activateKimWithoutName();

        await seam.recordSignIn(KIM.email, at(DAY), "  Kim R. Reyes ");

        expect(await nameOf(KIM.email)).toBe("Kim R. Reyes");
        expect(await arm.staffActivity()).toEqual(activity);
      });

      it("finds the Staff User by email in any case", async () => {
        await activateKimWithoutName();
        await seam.recordSignIn("Kim.Reyes@Gmail.com", at(DAY), "Kim Reyes");
        expect(await nameOf(KIM.email)).toBe("Kim Reyes");
      });

      it("keeps a name the staff list already has", async () => {
        await seam.recordSignIn(EDITOR.email, at(DAY), "Someone Else");
        await seam.recordSignIn(OWNER.email, at(DAY), null);
        expect(await nameOf(EDITOR.email)).toBe(EDITOR.name);
        expect(await nameOf(OWNER.email)).toBe(OWNER.name);
      });

      it.each([null, undefined, "", "   "])(
        "keeps the email when the profile gives %j",
        async (profileName) => {
          await activateKimWithoutName();
          await seam.recordSignIn(KIM.email, at(DAY), profileName);
          expect(await nameOf(KIM.email)).toBe(KIM.email);
        },
      );

      it("still records the time of the sign-in", async () => {
        await activateKimWithoutName();
        await seam.recordSignIn(KIM.email, at(DAY), "Kim Reyes");
        const kim = (await list()).staff.find((member) => member.email === KIM.email);
        expect(kim?.lastSignedInAt).toBe(at(DAY).toISOString());
      });
    });
  });
});

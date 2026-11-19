import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashDeviceToken } from "@/lib/member-app/device-token";
import { USERS_PAGE_SIZE } from "@/lib/admin/users-list";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Admin seam's Users (Phase 3, ticket 16; stories 129, 130 and 132), run
// against every arm. Owners list the Members (search, filters, pages), open a
// Member's detail page, and force-sign-out a Member's Active Device with a
// reason, which Staff Activity keeps. Editors are refused everything.
//
// The Members here sign in through the Member seam, as the Member App does.
// The sample data's Beta Tester list starts with tester@example.com and
// lapsed@example.com; its staff list has the Owner (Angel) and the Editor
// (the AYC Content Team) active, and Kim's Invite.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const LOU = {
  userId: "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
  email: "lapsed@example.com",
  name: "Lou Lapsed",
};
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: null,
};
const ANGEL = {
  userId: "5e7a9c1b-2d4f-4a6b-8c0d-1e3f5a7b9c2d",
  email: OWNER.email,
  name: OWNER.name,
};
const CONTENT = {
  userId: "9d2b4f6a-8c0e-4d1f-a3b5-c7d9e1f3a5b7",
  email: EDITOR.email,
  name: EDITOR.name,
};
/** A User id no Member has. */
const NOBODY = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const PHONE = { tokenHash: hashDeviceToken("phone-token"), deviceLabel: "Chrome on Android" };
const LAPTOP = { tokenHash: hashDeviceToken("laptop-token"), deviceLabel: "Safari on macOS" };

/** Exam Dates the Members pick: the seed's Exams have no Official Exam Date. */
const CE_DATE = "2027-04-24";
const ME_DATE = "2027-02-08";

const at = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();
const emailsOf = (rows: readonly { email: string }[]) => rows.map(({ email }) => email);
const ALL = { q: null, filter: "all", page: 1 } as const;

describe.each(ADMIN_ARMS)("Admin seam: Users ($name)", (arm) => {
  const { seam, member } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  /** A Member's first sign-in to the Member App, at BOOT + `ms`. */
  async function joins(user: { userId: string; email: string; name: string | null }, ms: number) {
    later(ms);
    await member.getOrCreateMember(user);
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    // Lou joined first and Content last, so the list (newest first) is
    // Content, Angel, Sam, Bea, Lou.
    await joins(LOU, 0);
    await joins(BEA, MINUTE);
    await joins(SAM, 2 * MINUTE);
    await joins(ANGEL, 3 * MINUTE);
    await joins(CONTENT, 4 * MINUTE);
    // Lou's CE pass ended 3 days ago; Bea's CE pass ends in 90 days.
    await arm.putAccessPass({ userId: LOU.userId, examCode: "CE", endsAt: at(-3 * DAY) });
    await arm.putAccessPass({ userId: BEA.userId, examCode: "CE", endsAt: at(90 * DAY) });
    later(5 * MINUTE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listUsers", () => {
    it("gives an Owner every Member, newest first, with their Target Exams, passes, Active Device and role", async () => {
      await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_DATE });
      await member.addTargetExam(BEA.userId, { examCode: "ME", examDate: ME_DATE });
      later(6 * MINUTE);
      await member.claimDevice(BEA.userId, PHONE);

      const result = await seam.listUsers(OWNER, ALL);

      expect(result).toMatchObject({
        ok: true,
        tags: [],
        value: { query: ALL, matching: 5, total: 5, pageCount: 1 },
      });
      if (!result.ok) return;
      expect(emailsOf(result.value.rows)).toEqual([
        CONTENT.email,
        ANGEL.email,
        SAM.email,
        BEA.email,
        LOU.email,
      ]);
      expect(result.value.rows[3]).toEqual({
        userId: BEA.userId,
        name: "Bea Tester",
        email: BEA.email,
        joinedAt: at(MINUTE),
        targetExams: ["CE", "ME"],
        accessPasses: [{ examCode: "CE", endsAt: at(90 * DAY) }],
        activeDevice: { deviceLabel: "Chrome on Android", claimedAt: at(6 * MINUTE) },
        role: "member",
        betaTester: true,
      });
      expect(result.value.rows[2]).toMatchObject({
        name: null,
        targetExams: [],
        accessPasses: [],
        activeDevice: null,
        role: "member",
        betaTester: false,
      });
    });

    it("gives Staff their Staff Role", async () => {
      const result = await seam.listUsers(OWNER, ALL);
      if (!result.ok) throw new Error("refused");
      expect(result.value.rows.slice(0, 2).map(({ role }) => role)).toEqual(["editor", "owner"]);
    });

    it("leaves out a removed Target Exam", async () => {
      await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_DATE });
      await member.addTargetExam(BEA.userId, { examCode: "ME", examDate: ME_DATE });
      await member.removeTargetExam(BEA.userId, "CE");

      const result = await seam.listUsers(OWNER, { ...ALL, filter: "active" });
      expect(result).toMatchObject({
        value: { rows: [{ email: BEA.email, targetExams: ["ME"] }] },
      });
    });

    it.each([
      ["active", [BEA.email]],
      ["expired", [LOU.email]],
      ["none", [CONTENT.email, ANGEL.email, SAM.email]],
      ["staff", [CONTENT.email, ANGEL.email]],
      ["beta", [BEA.email, LOU.email]],
    ] as const)("filters to %s", async (filter, emails) => {
      const result = await seam.listUsers(OWNER, { ...ALL, filter });
      expect(result).toMatchObject({ ok: true, value: { matching: emails.length, total: 5 } });
      if (result.ok) expect(emailsOf(result.value.rows)).toEqual(emails);
    });

    it("counts a pass ending this instant as expired, and one ending a millisecond later as active", async () => {
      vi.setSystemTime(new Date(at(90 * DAY)));
      expect(await seam.listUsers(OWNER, { ...ALL, filter: "active" })).toMatchObject({
        value: { matching: 0 },
      });
      vi.setSystemTime(new Date(at(90 * DAY - 1)));
      expect(await seam.listUsers(OWNER, { ...ALL, filter: "active" })).toMatchObject({
        value: { rows: [{ email: BEA.email }] },
      });
    });

    it("counts a Member with an active pass and an ended one as active, not expired", async () => {
      await arm.putAccessPass({ userId: BEA.userId, examCode: "ME", endsAt: at(-DAY) });

      expect(await seam.listUsers(OWNER, { ...ALL, filter: "expired" })).toMatchObject({
        value: { rows: [{ email: LOU.email }] },
      });
      expect(await seam.listUsers(OWNER, { ...ALL, filter: "active" })).toMatchObject({
        value: {
          rows: [
            {
              email: BEA.email,
              accessPasses: [
                { examCode: "CE", endsAt: at(90 * DAY) },
                { examCode: "ME", endsAt: at(-DAY) },
              ],
            },
          ],
        },
      });
    });

    it("reads the staff list now: a removed Editor is a Member like any other", async () => {
      await seam.removeStaff(OWNER, EDITOR.email);

      const staff = await seam.listUsers(OWNER, { ...ALL, filter: "staff" });
      if (!staff.ok) throw new Error("refused");
      expect(emailsOf(staff.value.rows)).toEqual([ANGEL.email]);
      const all = await seam.listUsers(OWNER, ALL);
      if (!all.ok) throw new Error("refused");
      expect(all.value.rows[0]).toMatchObject({ email: CONTENT.email, role: "member" });
    });

    it("searches names, ignoring case", async () => {
      const result = await seam.listUsers(OWNER, { ...ALL, q: "LAPS" });
      expect(result).toMatchObject({ value: { rows: [{ email: LOU.email }], matching: 1 } });
    });

    it("searches names with accents as typed", async () => {
      const result = await seam.listUsers(OWNER, { ...ALL, q: "lepaña" });
      expect(result).toMatchObject({ value: { rows: [{ email: ANGEL.email }] } });
    });

    it("searches emails, ignoring case", async () => {
      const result = await seam.listUsers(OWNER, { ...ALL, q: "Stranger@" });
      expect(result).toMatchObject({ value: { rows: [{ email: SAM.email }] } });
    });

    it("matches a search in a name or an email", async () => {
      const result = await seam.listUsers(OWNER, { ...ALL, q: "aceyourcourse" });
      if (!result.ok) throw new Error("refused");
      expect(emailsOf(result.value.rows)).toEqual([CONTENT.email, ANGEL.email]);
    });

    it("searches within the filter", async () => {
      const result = await seam.listUsers(OWNER, { q: "example.com", filter: "beta", page: 1 });
      if (!result.ok) throw new Error("refused");
      expect(emailsOf(result.value.rows)).toEqual([BEA.email, LOU.email]);
    });

    it.each(["%", "_", "\\", "a%e"])(
      "takes the search %j as text, never as a pattern",
      async (q) => {
        expect(await seam.listUsers(OWNER, { ...ALL, q })).toMatchObject({
          value: { rows: [], matching: 0, total: 5, pageCount: 1 },
        });
      },
    );

    it("answers a search with no results with no rows, still counting every Member", async () => {
      expect(await seam.listUsers(OWNER, { ...ALL, q: "nobody" })).toEqual({
        ok: true,
        tags: [],
        value: {
          query: { ...ALL, q: "nobody" },
          rows: [],
          matching: 0,
          total: 5,
          pageCount: 1,
        },
      });
    });

    describe("pages", () => {
      /** More Members than a page holds, each joining a minute after the last. */
      async function moreMembers() {
        for (let index = 0; index < USERS_PAGE_SIZE; index += 1) {
          const n = String(index).padStart(12, "0");
          await joins(
            {
              userId: `6a7b8c9d-0e1f-4a2b-8c3d-${n}`,
              email: `member${index}@example.com`,
              name: null,
            },
            (10 + index) * MINUTE,
          );
        }
      }

      it("gives a page at a time, newest first", async () => {
        await moreMembers();
        const total = USERS_PAGE_SIZE + 5;

        const first = await seam.listUsers(OWNER, ALL);
        expect(first).toMatchObject({ value: { matching: total, total, pageCount: 2 } });
        if (!first.ok) return;
        expect(first.value.rows).toHaveLength(USERS_PAGE_SIZE);
        expect(first.value.rows[0]?.email).toBe(`member${USERS_PAGE_SIZE - 1}@example.com`);

        const second = await seam.listUsers(OWNER, { ...ALL, page: 2 });
        expect(second).toMatchObject({ value: { query: { page: 2 }, pageCount: 2 } });
        if (!second.ok) return;
        expect(emailsOf(second.value.rows)).toEqual([
          CONTENT.email,
          ANGEL.email,
          SAM.email,
          BEA.email,
          LOU.email,
        ]);
      });

      it("shows the last page for a page past it", async () => {
        await moreMembers();
        const result = await seam.listUsers(OWNER, { ...ALL, page: 9 });
        expect(result).toMatchObject({ value: { query: { page: 2 }, pageCount: 2 } });
        if (result.ok) expect(result.value.rows).toHaveLength(5);
      });

      it("shows the first page for a page past the last of no matches", async () => {
        expect(await seam.listUsers(OWNER, { ...ALL, q: "nobody", page: 3 })).toMatchObject({
          value: { query: { page: 1 }, rows: [], pageCount: 1 },
        });
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.listUsers(EDITOR, ALL)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });

    it.each([
      { ...ALL, page: 0 },
      { ...ALL, filter: "paid" },
      { ...ALL, q: "x".repeat(101) },
    ])("refuses a query the URL can't give: %j", async (query) => {
      // @ts-expect-error A filter that doesn't exist, as a forged request might send.
      expect(await seam.listUsers(OWNER, query)).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });
  });

  describe("getMemberForAdmin", () => {
    it("gives an Owner every section of a Member's detail", async () => {
      await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_DATE });
      await member.addTargetExam(BEA.userId, { examCode: "ME", examDate: ME_DATE });
      await member.recordConsent(BEA.userId, { termsVersion: "1.0", privacyVersion: "1.0" });
      later(6 * MINUTE);
      await member.recordConsent(BEA.userId, { termsVersion: "2.0", privacyVersion: "2.0" });
      await member.claimDevice(BEA.userId, PHONE);
      later(7 * MINUTE);
      await member.claimDevice(BEA.userId, LAPTOP);
      const grant = {
        userId: LOU.userId,
        examCode: "CE",
        days: 30,
        startsAt: at(-33 * DAY),
        endsAt: at(-3 * DAY),
        reason: "Paid by bank transfer",
        grantedBy: { email: OWNER.email, name: OWNER.name },
        grantedAt: at(-33 * DAY),
      };
      await arm.putAccessPass({ userId: BEA.userId, examCode: "ME", endsAt: at(10 * DAY) }, [
        { ...grant, userId: BEA.userId, examCode: "ME", startsAt: at(-20 * DAY) },
        { ...grant, userId: BEA.userId, examCode: "ME", days: 30, endsAt: at(10 * DAY) },
      ]);

      const result = await seam.getMemberForAdmin(OWNER, BEA.userId);

      const { userId: _, examCode: __, ...grantShown } = grant;
      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          member: { ...BEA, joinedAt: at(MINUTE) },
          role: "member",
          betaTester: true,
          targetExams: await member.listTargetExams(BEA.userId),
          accessPasses: [
            { examCode: "CE", endsAt: at(90 * DAY), grants: [] },
            {
              examCode: "ME",
              endsAt: at(10 * DAY),
              grants: [
                { ...grantShown, startsAt: at(-20 * DAY) },
                { ...grantShown, endsAt: at(10 * DAY) },
              ],
            },
          ],
          progress: [
            { examCode: "CE", progress: await member.getProgress(BEA.userId, "CE") },
            { examCode: "ME", progress: await member.getProgress(BEA.userId, "ME") },
          ],
          activeDevice: { deviceLabel: "Safari on macOS", claimedAt: at(7 * MINUTE) },
          deviceSwitches: [
            { deviceLabel: "Safari on macOS", switchedAt: at(7 * MINUTE) },
            { deviceLabel: "Chrome on Android", switchedAt: at(6 * MINUTE) },
          ],
          consents: [
            { termsVersion: "2.0", privacyVersion: "2.0", agreedAt: at(6 * MINUTE) },
            { termsVersion: "1.0", privacyVersion: "1.0", agreedAt: at(5 * MINUTE) },
          ],
        },
      });
      if (result.ok) {
        expect(result.value.targetExams.map(({ examCode }) => examCode)).toEqual(["CE", "ME"]);
      }
    });

    it("gives a Member's progress from their study records", async () => {
      await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_DATE });
      const result = await seam.getMemberForAdmin(OWNER, BEA.userId);
      expect(result).toMatchObject({
        value: {
          progress: [
            {
              examCode: "CE",
              progress: { started: false, quizAverage: null, streak: { lastStudyDay: null } },
            },
          ],
        },
      });
    });

    it("gives a Member who just signed in empty sections", async () => {
      expect(await seam.getMemberForAdmin(OWNER, SAM.userId)).toEqual({
        ok: true,
        tags: [],
        value: {
          member: { ...SAM, joinedAt: at(2 * MINUTE) },
          role: "member",
          betaTester: false,
          targetExams: [],
          accessPasses: [],
          progress: [],
          activeDevice: null,
          deviceSwitches: [],
          consents: [],
        },
      });
    });

    it("never gives one Member's records on another's page", async () => {
      await member.recordConsent(BEA.userId, { termsVersion: "2.0", privacyVersion: "2.0" });
      await member.claimDevice(BEA.userId, PHONE);
      await member.addTargetExam(BEA.userId, { examCode: "CE", examDate: CE_DATE });

      expect(await seam.getMemberForAdmin(OWNER, SAM.userId)).toMatchObject({
        value: {
          targetExams: [],
          accessPasses: [],
          activeDevice: null,
          deviceSwitches: [],
          consents: [],
        },
      });
    });

    it("gives Staff their Staff Role", async () => {
      expect(await seam.getMemberForAdmin(OWNER, ANGEL.userId)).toMatchObject({
        value: { role: "owner", betaTester: false },
      });
    });

    it.each([NOBODY, "not-a-uuid", ""])("answers not-found for the Member %j", async (userId) => {
      expect(await seam.getMemberForAdmin(OWNER, userId)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.getMemberForAdmin(EDITOR, BEA.userId)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });
  });

  describe("forceSignOut", () => {
    beforeEach(async () => {
      await member.claimDevice(BEA.userId, PHONE);
      await member.claimDevice(SAM.userId, LAPTOP);
      later(10 * MINUTE);
    });

    it("clears the Member's Active Device, so their device's next request is replaced", async () => {
      const result = await seam.forceSignOut(OWNER, {
        userId: BEA.userId,
        reason: "  Shared with a classmate  ",
      });

      expect(result).toEqual({
        ok: true,
        tags: [],
        value: {
          userId: BEA.userId,
          signedOut: { deviceLabel: "Chrome on Android", claimedAt: at(5 * MINUTE) },
          reason: "Shared with a classmate",
        },
      });
      expect(await member.getActiveDevice(BEA.userId)).toBeNull();
      expect(await member.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("replaced");
      // The switch log keeps its claims: a forced sign-out isn't a switch.
      expect(await member.deviceSwitchCount(BEA.userId)).toBe(1);
    });

    it("records the reason and the old device in Staff Activity", async () => {
      await seam.forceSignOut(OWNER, { userId: BEA.userId, reason: "Shared with a classmate" });

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(10 * MINUTE),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "member",
          entityId: BEA.userId,
          action: "force-sign-out",
          before: {
            email: BEA.email,
            activeDevice: { deviceLabel: "Chrome on Android", claimedAt: at(5 * MINUTE) },
          },
          after: { email: BEA.email, activeDevice: null, reason: "Shared with a classmate" },
        },
      ]);
    });

    it("leaves every other Member's Active Device alone", async () => {
      await seam.forceSignOut(OWNER, { userId: BEA.userId, reason: "Shared" });
      expect(await member.deviceStatus(SAM.userId, LAPTOP.tokenHash)).toBe("active");
    });

    it("lets the Member claim a device again", async () => {
      await seam.forceSignOut(OWNER, { userId: BEA.userId, reason: "Shared" });
      await member.claimDevice(BEA.userId, PHONE);
      expect(await member.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
    });

    it.each([
      ["no reason", undefined],
      ["an empty reason", ""],
      ["a reason of spaces", "   "],
      ["a reason over 500 characters", "x".repeat(501)],
    ])("refuses %s, and changes nothing", async (_, reason) => {
      // @ts-expect-error A missing reason, as a forged request might send.
      const result = await seam.forceSignOut(OWNER, { userId: BEA.userId, reason });

      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { reason: [expect.any(String)] } },
      });
      expect(await member.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("says a Member with no Active Device has nothing to sign out, and records nothing", async () => {
      await seam.forceSignOut(OWNER, { userId: BEA.userId, reason: "Shared" });
      const before = await arm.staffActivity();

      const again = await seam.forceSignOut(OWNER, { userId: BEA.userId, reason: "Shared" });
      const never = await seam.forceSignOut(OWNER, { userId: LOU.userId, reason: "Shared" });

      for (const result of [again, never]) {
        expect(result).toEqual({
          ok: false,
          error: {
            kind: "invalid",
            fieldErrors: {},
            formError: expect.stringMatching(/no Active Device/),
          },
        });
      }
      expect(await arm.staffActivity()).toEqual(before);
    });

    it.each([NOBODY, "not-a-uuid"])("answers not-found for the Member %j", async (userId) => {
      expect(await seam.forceSignOut(OWNER, { userId, reason: "Shared" })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an Editor, and changes nothing", async () => {
      expect(
        await seam.forceSignOut(EDITOR, { userId: BEA.userId, reason: "Shared" }),
      ).toMatchObject({ ok: false, error: { kind: "forbidden" } });
      expect(await member.deviceStatus(BEA.userId, PHONE.tokenHash)).toBe("active");
      expect(await arm.staffActivity()).toEqual([]);
    });
  });
});

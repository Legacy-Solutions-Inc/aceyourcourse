import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Admin seam's Beta Testers (spec, Phase 3 → The beta gate; stories 133a
// and 133b), run against every arm. Owners keep a list of Google emails that
// get into the Member App while its switch is off. The sample data starts
// with two, added by the Owner: tester@example.com 3 days before boot, then
// lapsed@example.com (whose CE pass has ended) 2 days before.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
const ADDED_BY = { email: OWNER.email, name: OWNER.name };
const SAMPLE_TESTER = {
  email: "tester@example.com",
  addedAt: new Date(BOOT.getTime() - 3 * DAY).toISOString(),
  addedBy: ADDED_BY,
};
const LAPSED_TESTER = {
  email: "lapsed@example.com",
  addedAt: new Date(BOOT.getTime() - 2 * DAY).toISOString(),
  addedBy: ADDED_BY,
};
const SAMPLE_TESTERS = [SAMPLE_TESTER, LAPSED_TESTER];
const NEW_TESTER = "new.tester@example.com";

describe.each(ADMIN_ARMS)("Admin seam: Beta Testers ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listBetaTesters", () => {
    it("gives an Owner each Beta Tester with the date added and who added them", async () => {
      expect(await seam.listBetaTesters(OWNER)).toEqual({
        ok: true,
        value: SAMPLE_TESTERS,
        tags: [],
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.listBetaTesters(EDITOR)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });
  });

  describe("addBetaTester", () => {
    it("adds a Google email, trimmed and lowercased, after the ones already there", async () => {
      const later = new Date(BOOT.getTime() + 60_000);
      vi.setSystemTime(later);

      const result = await seam.addBetaTester(OWNER, { email: "  New.Tester@Example.COM " });

      const added = { email: NEW_TESTER, addedAt: later.toISOString(), addedBy: ADDED_BY };
      expect(result).toEqual({ ok: true, value: added, tags: [] });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({
        value: [...SAMPLE_TESTERS, added],
      });
    });

    it("records the add in Staff Activity", async () => {
      await seam.addBetaTester(OWNER, { email: NEW_TESTER });

      const activity = await arm.staffActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        at: BOOT.toISOString(),
        actor: ADDED_BY,
        entity: "beta-tester",
        entityId: NEW_TESTER,
        action: "add",
        before: null,
        after: { email: NEW_TESTER, addedAt: BOOT.toISOString(), addedBy: ADDED_BY },
      });
    });

    it("can add someone who is also on the staff list", async () => {
      expect(await seam.addBetaTester(OWNER, { email: EDITOR.email })).toMatchObject({ ok: true });
    });

    it.each([
      ["an empty email", "", "Enter an email address."],
      ["a blank email", "   ", "Enter an email address."],
      ["a malformed email", "not-an-email", "Enter a valid email address, like name@example.com."],
    ])("refuses %s with a message, and adds nothing", async (_label, email, message) => {
      expect(await seam.addBetaTester(OWNER, { email })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { email: [message] } },
      });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({ value: SAMPLE_TESTERS });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an email already on the list, whatever its case, with a message", async () => {
      expect(await seam.addBetaTester(OWNER, { email: " TESTER@example.com" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { email: ["This email is already a Beta Tester."] },
        },
      });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({ value: SAMPLE_TESTERS });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an Editor, and adds nothing", async () => {
      expect(await seam.addBetaTester(EDITOR, { email: NEW_TESTER })).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({ value: SAMPLE_TESTERS });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });

  describe("removeBetaTester", () => {
    it("takes a Beta Tester off the list, whatever the email's case, and gives who it was", async () => {
      expect(await seam.removeBetaTester(OWNER, "Tester@Example.com")).toEqual({
        ok: true,
        value: SAMPLE_TESTER,
        tags: [],
      });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({ value: [LAPSED_TESTER] });
    });

    it("records the removal in Staff Activity", async () => {
      await seam.removeBetaTester(OWNER, SAMPLE_TESTER.email);

      const activity = await arm.staffActivity();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        at: BOOT.toISOString(),
        actor: ADDED_BY,
        entity: "beta-tester",
        entityId: SAMPLE_TESTER.email,
        action: "remove",
        before: SAMPLE_TESTER,
        after: null,
      });
    });

    it("lets a removed email be added again", async () => {
      await seam.removeBetaTester(OWNER, SAMPLE_TESTER.email);
      expect(await seam.addBetaTester(OWNER, { email: SAMPLE_TESTER.email })).toMatchObject({
        ok: true,
      });
    });

    it("answers not-found for an email that isn't on the list", async () => {
      expect(await seam.removeBetaTester(OWNER, NEW_TESTER)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a malformed email", async () => {
      expect(await seam.removeBetaTester(OWNER, "not-an-email")).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });

    it("refuses an Editor, and removes nothing", async () => {
      expect(await seam.removeBetaTester(EDITOR, SAMPLE_TESTER.email)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await seam.listBetaTesters(OWNER)).toMatchObject({ value: SAMPLE_TESTERS });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });
});

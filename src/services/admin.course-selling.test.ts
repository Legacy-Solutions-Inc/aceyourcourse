import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { createFakePaymentsClient } from "@/services/payments.fake";
import { createFakeVideoService } from "@/services/video.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { CE_OFFICIAL, withExamDates } from "../../test/member-inputs";

// ─────────────────────────────────────────────────────────────────────────────
// Selling a Course through the Admin seam (Phase 5, ticket 06; spec, Phase 5
// planning decisions → Who does what, Hiding, unpublishing and deleting;
// stories 169, 170, 171, 184). Only Owners switch a Course between "Included
// in {Exam} All-Access" and "Sold separately", set its price and On sale
// (Plans & prices → One-time purchases); each is refused for an Editor on the
// server, and logged in Staff Activity. The switch takes effect at once, and
// the Course says beforehand how many Members it affects: Included → Sold
// separately, the Members who watched it through their Access Pass (Lesson
// progress in it, an active pass for its Exam, not owning it) lose it;
// Sold separately → Included, the Access Pass holders gain it. A Course can't
// be deleted while anyone owns it or any Order names it. Run over the Member
// arms, which carry the matching Admin arm, so Members can watch and buy.
// "Now" is 28 Nov 2026, 20:00 in Manila.
// ─────────────────────────────────────────────────────────────────────────────

const BOOT = new Date("2026-11-28T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");

const SURVEYING = sampleCourseId("Surveying & Curves Lectures");
const PSAD = sampleCourseId("PSAD Masterclass");
const HPGE = sampleCourseId("HPGE Crash Course");
const LEVELING = sampleLessonId(
  "Surveying & Curves Lectures",
  "Surveying basics",
  "Distance and leveling",
);

const ANA = {
  userId: "4d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d",
  email: "ana@example.com",
  name: "Ana",
};
const BEN = {
  userId: "5e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e",
  email: "ben@example.com",
  name: "Ben",
};
const CY = { userId: "6f4e3d2c-1b0a-4c9d-8e8f-7a6b5c4d3e2f", email: "cy@example.com", name: "Cy" };

describe.each(MEMBER_ARMS)("Selling a Course through the Admin seam ($name)", (arm) => {
  const { seam, admin } = arm;

  const courseOf = async (id: string) => {
    const course = await admin.getCourseForAdmin(OWNER, id);
    if (!course) throw new Error(`No Course ${id}`);
    return course;
  };
  const accessOf = async (userId: string): Promise<MemberAccess> => ({
    gate: "open",
    device: "active",
    activeStaff: false,
    passes: (await seam.listAccessPasses(userId)).map(({ examCode, endsAt }) => ({
      examCode,
      endsAt,
    })),
    now: new Date(),
  });
  const passFor = (userId: string, endsInDays: number) =>
    arm.putAccessPass({
      userId,
      examCode: "CE",
      endsAt: new Date(BOOT.getTime() + endsInDays * DAY).toISOString(),
    });
  const watch = async (userId: string) => {
    const saved = await seam.saveLessonPosition(
      userId,
      { lessonId: LEVELING, position: 30 },
      await accessOf(userId),
    );
    if (!saved.ok) throw new Error(`The position wasn't saved: ${JSON.stringify(saved)}`);
  };
  const own = (userId: string, courseId: string) =>
    arm.putCourseOwnership({ userId, courseId, since: BOOT.toISOString(), orderId: null });
  const latestActivity = async () => (await arm.adminArm.staffActivity()).at(-1);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset(withExamDates);
    for (const member of [ANA, BEN, CY]) await seam.getOrCreateMember(member);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("how Members get a Course", () => {
    it("counts the Members who'd lose an included Course: watched it through an active pass, not owning it", async () => {
      const before = (await courseOf(SURVEYING)).accessChange.losing;
      await passFor(ANA.userId, 30);
      await watch(ANA.userId);
      // Ben watched it while his pass was active, and owns it as well.
      await passFor(BEN.userId, 30);
      await watch(BEN.userId);
      await own(BEN.userId, SURVEYING);
      // Cy holds a pass but never watched it.
      await passFor(CY.userId, 30);

      expect((await courseOf(SURVEYING)).accessChange.losing).toBe(before + 1);
    });

    it("counts the pass holders who'd gain a separately sold Course, its owners left out", async () => {
      const before = (await courseOf(PSAD)).accessChange.gaining;
      await passFor(ANA.userId, 30);
      await passFor(BEN.userId, 30);
      await own(BEN.userId, PSAD);
      // Cy's pass has ended.
      await passFor(CY.userId, -1);

      expect((await courseOf(PSAD)).accessChange.gaining).toBe(before + 1);
    });

    it("switches an included Course to Sold separately at once, not on sale and with no price yet", async () => {
      await passFor(ANA.userId, 30);
      await watch(ANA.userId);

      const result = await admin.setCourseAccess(OWNER, {
        id: SURVEYING,
        access: "sold-separately",
      });

      expect(result).toMatchObject({ ok: true });
      expect((await courseOf(SURVEYING)).course).toMatchObject({
        access: "sold-separately",
        onSale: false,
      });
      const opened = await seam.openCourse(ANA.userId, SURVEYING, await accessOf(ANA.userId));
      expect(opened).toMatchObject({ status: "open", course: { owned: false } });
      // Her progress is kept.
      expect(await arm.lessonProgress()).toContainEqual(
        expect.objectContaining({ userId: ANA.userId, lessonId: LEVELING }),
      );
      expect(await latestActivity()).toMatchObject({
        actor: { email: OWNER.email },
        entity: "course",
        entityId: SURVEYING,
        action: "set-access",
        before: { access: "included", onSale: false },
        after: { access: "sold-separately", onSale: false },
      });
    });

    it("switches a separately sold Course back to Included, taking it off sale and keeping Course Ownerships", async () => {
      await own(ANA.userId, PSAD);

      expect(await admin.setCourseAccess(OWNER, { id: PSAD, access: "included" })).toMatchObject({
        ok: true,
      });

      expect((await courseOf(PSAD)).course).toMatchObject({ access: "included", onSale: false });
      expect(await arm.courseOwnerships()).toContainEqual(
        expect.objectContaining({ userId: ANA.userId, courseId: PSAD }),
      );
    });

    it("is refused for an Editor on the server, changing nothing", async () => {
      expect(
        await admin.setCourseAccess(EDITOR, { id: SURVEYING, access: "sold-separately" }),
      ).toMatchObject({ ok: false, error: { kind: "forbidden" } });
      expect((await courseOf(SURVEYING)).course.access).toBe("included");
    });

    it("answers not found for a Course that isn't there", async () => {
      expect(
        await admin.setCourseAccess(OWNER, { id: crypto.randomUUID(), access: "included" }),
      ).toMatchObject({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("One-time purchases on Plans & prices", () => {
    it("lists every separately sold Course with its price and On sale, for Owners only", async () => {
      const listed = await admin.listOneTimePurchases(OWNER);

      expect(listed.ok && listed.value).toEqual([
        expect.objectContaining({
          id: PSAD,
          title: "PSAD Masterclass",
          examCode: "CE",
          priceCentavos: 149_900,
          onSale: true,
          visible: true,
        }),
        expect.objectContaining({ id: HPGE, priceCentavos: null, onSale: false }),
      ]);
      expect(await admin.listOneTimePurchases(EDITOR)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });

    it("adds a Course switched to Sold separately, not on sale", async () => {
      await admin.setCourseAccess(OWNER, { id: SURVEYING, access: "sold-separately" });

      const listed = await admin.listOneTimePurchases(OWNER);
      expect(listed.ok && listed.value.map(({ id }) => id)).toContain(SURVEYING);
    });

    it("sets a price in whole pesos, then On sale, each logged", async () => {
      expect(await admin.setCoursePrice(OWNER, { id: HPGE, price: "1,299" })).toMatchObject({
        ok: true,
        value: { priceCentavos: 129_900 },
      });
      expect(await latestActivity()).toMatchObject({
        entity: "course",
        entityId: HPGE,
        action: "set-price",
        before: { priceCentavos: null },
        after: { priceCentavos: 129_900 },
      });

      expect(await admin.setCourseOnSale(OWNER, { id: HPGE, onSale: true })).toMatchObject({
        ok: true,
        value: { onSale: true },
      });
      expect(await latestActivity()).toMatchObject({ action: "set-on-sale" });
      const plans = await seam.listMemberPlans(ANA.userId);
      expect(plans.find((exam) => exam.examCode === "CE")?.courses).toContainEqual(
        expect.objectContaining({ id: HPGE, priceCentavos: 129_900 }),
      );
    });

    it("refuses a price that isn't whole pesos within a Plan's limits", async () => {
      for (const price of ["0", "12.50", "100000", "free"]) {
        expect(await admin.setCoursePrice(OWNER, { id: HPGE, price })).toMatchObject({
          ok: false,
          error: { kind: "invalid" },
        });
      }
      expect((await courseOf(HPGE)).course.priceCentavos).toBeNull();
    });

    it("refuses On sale with no price yet, and for an included Course", async () => {
      expect(await admin.setCourseOnSale(OWNER, { id: HPGE, onSale: true })).toMatchObject({
        ok: false,
      });
      expect(await admin.setCourseOnSale(OWNER, { id: SURVEYING, onSale: true })).toMatchObject({
        ok: false,
      });
      expect(await admin.setCoursePrice(OWNER, { id: SURVEYING, price: "999" })).toMatchObject({
        ok: false,
      });
    });

    it("refuses an Editor's price and On sale on the server", async () => {
      expect(await admin.setCoursePrice(EDITOR, { id: PSAD, price: "999" })).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await admin.setCourseOnSale(EDITOR, { id: PSAD, onSale: false })).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect((await courseOf(PSAD)).course).toMatchObject({ priceCentavos: 149_900, onSale: true });
    });
  });

  describe("the delete guard", () => {
    it("refuses to delete a Course someone owns, suggesting hiding it", async () => {
      await own(ANA.userId, PSAD);

      const result = await admin.deleteCourse(OWNER, PSAD, createFakeVideoService());

      expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
      expect(JSON.stringify(result)).toMatch(/hide it/i);
      expect((await courseOf(PSAD)).deleteBlocked).toBe("owned");
    });

    it("refuses to delete a Course an Order names", async () => {
      await seam.addTargetExam(ANA.userId, { examCode: "CE", examDate: CE_OFFICIAL });
      const paid = await seam.payForCourse(
        ANA.userId,
        { examCode: "CE", courseId: PSAD, method: "gcash" },
        createFakePaymentsClient(),
      );
      expect(paid.ok).toBe(true);

      const result = await admin.deleteCourse(OWNER, PSAD, createFakeVideoService());

      expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
      expect((await courseOf(PSAD)).deleteBlocked).toBe("ordered");
    });

    it("deletes a Course nobody owns and no Order names", async () => {
      expect((await courseOf(HPGE)).deleteBlocked).toBeNull();
      expect(await admin.deleteCourse(OWNER, HPGE, createFakeVideoService())).toMatchObject({
        ok: true,
      });
    });
  });

  it("never lets an Access Pass open a separately sold Course", async () => {
    await passFor(ANA.userId, 30);
    const opened = await seam.openLesson(
      ANA.userId,
      {
        courseId: PSAD,
        lessonId: sampleLessonId("PSAD Masterclass", "Reinforced concrete", "Beams in flexure"),
      },
      await accessOf(ANA.userId),
      null,
    );
    expect(opened).toMatchObject({ status: "refused", decision: { outcome: "locked" } });
  });
});

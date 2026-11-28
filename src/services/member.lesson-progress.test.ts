import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { sampleUserId } from "@/services/mock/members";
import type { LessonOpening, MemberCourse, OpenedLesson } from "@/services/member.types";
import { createFakeVideoService } from "@/services/video.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";

// Resume and progress through the Member seam (Phase 5, ticket 04; spec,
// Phase 5 planning decisions → Watching a Lesson, Progress; Testing
// Decisions → Phase 5 seams → Member seam, extended; stories 158, 160–162,
// 166), run against every arm: position saves and "Mark complete", each
// through the access decision (the Active Device included), the Lesson
// reopening where the Member left it, the Courses screen's "9 / 32" and
// "Continue", and Home's Lesson counts and "Continue" spot. The sample CE
// Courses: "Surveying & Curves Lectures" (MSTC, included in CE All-Access, 5
// Lessons: Distance and leveling 12:23, Traverse computations 16:46, Areas
// and volumes, Simple curves (Free Preview), Compound and reverse curves),
// "PSAD Masterclass" (sold separately, on sale, 3 Lessons) and "HPGE Crash
// Course" (sold separately, not on sale, 3 Lessons). It's 28 Nov 2026, 11:42
// in Manila. Bea holds CE All-Access for 90 more days; the stranger has none.
const BOOT = new Date("2026-11-28T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const SURVEYING = "Surveying & Curves Lectures";
const SURVEYING_ID = sampleCourseId(SURVEYING);
const PSAD_ID = sampleCourseId("PSAD Masterclass");
const LEVELING = sampleLessonId(SURVEYING, "Surveying basics", "Distance and leveling");
const TRAVERSE = sampleLessonId(SURVEYING, "Surveying basics", "Traverse computations");
const AREAS = sampleLessonId(SURVEYING, "Surveying basics", "Areas and volumes");
const SIMPLE_CURVES = sampleLessonId(SURVEYING, "Horizontal curves", "Simple curves");
const BEAMS = sampleLessonId("PSAD Masterclass", "Reinforced concrete", "Beams in flexure");
/** The sample lengths, in seconds. */
const LEVELING_SECONDS = 743;
const TRAVERSE_SECONDS = 1006;

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);

describe.each(MEMBER_ARMS)("Member seam resume and progress ($name)", (arm) => {
  const { seam } = arm;

  /** The Member's side of the access decision now, as the server gathers it: their own passes. */
  async function accessOf(who: Who, overrides: Partial<MemberAccess> = {}): Promise<MemberAccess> {
    return {
      gate: "open",
      device: "active",
      activeStaff: false,
      passes: (await seam.listAccessPasses(userOf(who))).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
      })),
      now: new Date(),
      ...overrides,
    };
  }

  const save = async (
    who: Who,
    lessonId: string,
    position: number,
    overrides: Partial<MemberAccess> = {},
  ) => seam.saveLessonPosition(userOf(who), { lessonId, position }, await accessOf(who, overrides));
  const complete = async (who: Who, lessonId: string, overrides: Partial<MemberAccess> = {}) =>
    seam.completeLesson(userOf(who), { lessonId }, await accessOf(who, overrides));
  const open = async (who: Who, lessonId: string, courseId = SURVEYING_ID) =>
    seam.openLesson(
      userOf(who),
      { courseId, lessonId },
      await accessOf(who),
      createFakeVideoService(),
    );
  const progress = (who: Who) => seam.getProgress(userOf(who), "CE");

  function allowedOf(opening: LessonOpening) {
    if (opening.status !== "allowed") throw new Error(`Not allowed: ${opening.status}`);
    return opening;
  }
  const resumeOf = async (who: Who, lessonId: string): Promise<OpenedLesson["resume"]> =>
    allowedOf(await open(who, lessonId)).lesson.resume;
  /** Each Lesson in the side panel, done or not. */
  const marks = async (who: Who, lessonId: string) =>
    allowedOf(await open(who, lessonId)).outline.flatMap((module) =>
      module.lessons.map((lesson) => [lesson.title, lesson.done]),
    );

  async function surveyingCard(who: Who): Promise<MemberCourse> {
    const shelf = await seam.listCourses(userOf(who), "CE", await accessOf(who));
    const card = shelf.courses.find((course) => course.id === SURVEYING_ID);
    if (!card) throw new Error("Surveying isn't on the shelf");
    return card;
  }

  /** Bea's stored Lesson progress records. */
  const stored = async (who: Who = "tester") =>
    (await arm.lessonProgress()).filter((record) => record.userId === userOf(who));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    for (const who of Object.keys(MEMBERS) as Who[]) {
      await seam.getOrCreateMember({ userId: userOf(who), ...MEMBERS[who] });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("saving where the Member is", () => {
    it("saves the position, and reopening picks up there, saying when they stopped", async () => {
      expect(await save("tester", TRAVERSE, 760)).toEqual({
        ok: true,
        value: {
          lessonId: TRAVERSE,
          position: 760,
          furthest: 760,
          doneAt: null,
          watchedAt: BOOT.toISOString(),
        },
      });

      vi.setSystemTime(new Date(BOOT.getTime() + 2 * DAY));
      expect(await resumeOf("tester", TRAVERSE)).toEqual({
        state: "resume",
        from: 760,
        savedAt: BOOT.toISOString(),
      });
    });

    it("starts a Lesson never watched from the beginning", async () => {
      expect(await resumeOf("tester", TRAVERSE)).toEqual({ state: "start", from: 0 });
    });

    it("rounds a fraction of a second down", async () => {
      const saved = await save("tester", TRAVERSE, 60.9);
      expect(saved.ok && saved.value.position).toBe(60);
    });

    it("makes a day with no other studying a Study Day", async () => {
      expect(await seam.listStudyDays(userOf("tester"))).toEqual([]);
      await save("tester", TRAVERSE, 30);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-28"]);
    });

    it("lands saves just before and just after Manila midnight on their own Study Days", async () => {
      // 23:59 and 00:01 in Manila (UTC+8).
      vi.setSystemTime(new Date("2026-11-28T15:59:00.000Z"));
      await save("tester", TRAVERSE, 30);
      vi.setSystemTime(new Date("2026-11-28T16:01:00.000Z"));
      await save("tester", TRAVERSE, 150);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-28", "2026-11-29"]);
    });
  });

  describe("done", () => {
    it("isn't done at 89.9%, and is at exactly 90%", async () => {
      // 90% of 1,000 seconds would be 900: Traverse is 1,006, so 905.4 is 90%.
      await save("tester", TRAVERSE, 905);
      expect((await stored())[0]?.doneAt).toBeNull();
      await save("tester", TRAVERSE, 906);
      expect((await stored())[0]?.doneAt).toBe(BOOT.toISOString());
      expect(await marks("tester", LEVELING)).toContainEqual(["Traverse computations", true]);
    });

    it("is done when the Member skips ahead to 95%", async () => {
      const skipped = await save("tester", TRAVERSE, Math.ceil(TRAVERSE_SECONDS * 0.95));
      expect(skipped.ok && skipped.value.doneAt).toBe(BOOT.toISOString());
    });

    it("stays done after rewatching from the start, and a done Lesson starts from the beginning", async () => {
      await save("tester", LEVELING, LEVELING_SECONDS);
      vi.setSystemTime(new Date(BOOT.getTime() + DAY));
      await save("tester", LEVELING, 40);

      expect(await stored()).toMatchObject([
        { lessonId: LEVELING, positionSeconds: 40, furthestSeconds: LEVELING_SECONDS },
      ]);
      expect((await stored())[0]?.doneAt).toBe(BOOT.toISOString());
      expect(await resumeOf("tester", LEVELING)).toEqual({ state: "finished", from: 0 });
    });

    it("is done by Mark complete, at any point, and shows ✓ in the side panel", async () => {
      await save("tester", TRAVERSE, 30);
      const completed = await complete("tester", TRAVERSE);
      expect(completed).toMatchObject({
        ok: true,
        value: { position: 30, doneAt: BOOT.toISOString() },
      });
      expect(await marks("tester", AREAS)).toEqual([
        ["Distance and leveling", false],
        ["Traverse computations", true],
        ["Areas and volumes", false],
        ["Simple curves", false],
        ["Compound and reverse curves", false],
      ]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-28"]);
    });

    it("marks a Lesson never opened complete too", async () => {
      expect(await complete("tester", AREAS)).toMatchObject({
        ok: true,
        value: { doneAt: BOOT.toISOString() },
      });
    });
  });

  describe("refused saves store nothing", () => {
    it("refuses a save and Mark complete from a replaced device: Session ended", async () => {
      const replaced = { device: "replaced" as const };
      const refusal = {
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "device-replaced" } },
      };
      expect(await save("tester", TRAVERSE, 760, replaced)).toEqual(refusal);
      expect(await complete("tester", TRAVERSE, replaced)).toEqual(refusal);
      expect(await stored()).toEqual([]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual([]);
    });

    it("refuses a save for a Lesson the Member can't open", async () => {
      // The PSAD Masterclass is sold separately, and Bea doesn't own it.
      const refused = await save("tester", BEAMS, 30);
      expect(refused).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "locked" } },
      });
      expect(await complete("stranger", TRAVERSE)).toMatchObject({
        ok: false,
        refusal: { decision: { outcome: "locked" } },
      });
      expect(await arm.lessonProgress()).toEqual([]);
    });

    it("refuses a position below 0 or past the Lesson's length", async () => {
      const outOfRange = { ok: false, refusal: { reason: "out-of-range" } };
      expect(await save("tester", TRAVERSE, -1)).toEqual(outOfRange);
      expect(await save("tester", TRAVERSE, TRAVERSE_SECONDS + 1)).toEqual(outOfRange);
      expect(await save("tester", TRAVERSE, Number.NaN)).toMatchObject({ ok: false });
      expect(await stored()).toEqual([]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual([]);
      // The very end is in range.
      expect((await save("tester", TRAVERSE, TRAVERSE_SECONDS)).ok).toBe(true);
    });

    it("finds no Lesson for an id that isn't one", async () => {
      const notFound = { ok: false, refusal: { reason: "not-found" } };
      expect(await save("tester", UNKNOWN, 30)).toEqual(notFound);
      expect(await save("tester", "not-an-id", 30)).toEqual(notFound);
      expect(await complete("tester", UNKNOWN)).toEqual(notFound);
    });
  });

  it("never lets another Member read a Member's Lesson progress", async () => {
    await complete("tester", SIMPLE_CURVES);
    await save("tester", TRAVERSE, 760);

    // Simple curves is a Free Preview Lesson: the stranger opens it, fresh.
    expect(await resumeOf("stranger", SIMPLE_CURVES)).toEqual({ state: "start", from: 0 });
    expect(await marks("stranger", SIMPLE_CURVES)).not.toContainEqual(["Simple curves", true]);
    expect(await progress("stranger")).toMatchObject({
      started: false,
      lessons: { done: 0, total: 0 },
      resume: { lesson: null },
    });
    const card = await surveyingCard("stranger");
    expect(card).toMatchObject({ lessonsDone: 0, continueLesson: null });
    expect((await arm.lessonProgress()).every((record) => record.userId === userOf("tester"))).toBe(
      true,
    );
  });

  describe("where progress shows", () => {
    it("gives the Course card its Lessons done and the Lesson to continue", async () => {
      expect(await surveyingCard("tester")).toMatchObject({ lessonsDone: 0, continueLesson: null });
      await complete("tester", LEVELING);
      await save("tester", TRAVERSE, 760);
      expect(await surveyingCard("tester")).toMatchObject({
        lessons: 5,
        lessonsDone: 1,
        continueLesson: { id: TRAVERSE, title: "Traverse computations" },
      });
    });

    it("gives Home the Lessons done per Subject and of the Lessons the Member can open, and the Lesson to continue", async () => {
      await complete("tester", LEVELING);
      vi.setSystemTime(new Date(BOOT.getTime() + 60_000));
      await save("tester", TRAVERSE, 760);

      const home = await progress("tester");
      // Only Surveying opens for Bea: the PSAD and HPGE Courses are sold separately.
      expect(home.lessons).toEqual({ done: 1, total: 5 });
      expect(home.subjects.map(({ code, lessons }) => [code, lessons])).toEqual(
        expect.arrayContaining([
          ["MSTC", { done: 1, total: 5 }],
          ["PSAD", { done: 0, total: 0 }],
        ]),
      );
      expect(home.resume.lesson).toEqual({
        courseId: SURVEYING_ID,
        lessonId: TRAVERSE,
        subjectCode: "MSTC",
        title: "Traverse computations",
        position: 760,
        seconds: TRAVERSE_SECONDS,
        savedAt: new Date(BOOT.getTime() + 60_000).toISOString(),
      });
      expect(home.started).toBe(true);
    });

    it("counts only Published Lessons in Courses the Member can open", async () => {
      expect((await progress("tester")).lessons.total).toBe(5);

      // An Unpublished Lesson drops out, for everyone.
      expect((await seam.getProgress(userOf("tester"), "CE")).lessons.total).toBe(5);
      expect((await arm.admin.setLessonPublished(EDITOR, AREAS, false)).ok).toBe(true);
      expect((await progress("tester")).lessons.total).toBe(4);

      // A Course she owns joins the count: the PSAD Masterclass's 3 Lessons.
      await arm.putCourseOwnership({
        userId: userOf("tester"),
        courseId: PSAD_ID,
        since: new Date().toISOString(),
        orderId: null,
      });
      expect((await progress("tester")).lessons.total).toBe(7);

      // A Free Preview Lesson doesn't open its Course: the stranger can open none.
      expect((await progress("stranger")).lessons.total).toBe(0);
      // Active Staff open every Course.
      expect(
        (await seam.getProgress(userOf("stranger"), "CE", { activeStaff: true })).lessons.total,
      ).toBe(10);
    });
  });

  it("keeps progress when the Access Pass ends, and shows it again on renewal", async () => {
    await complete("tester", LEVELING);
    await save("tester", TRAVERSE, 760);

    // 91 days on, Bea's CE pass has ended.
    vi.setSystemTime(new Date(BOOT.getTime() + 91 * DAY));
    const ended = await open("tester", TRAVERSE);
    expect(ended).toMatchObject({ status: "refused", decision: { outcome: "expired" } });
    expect(await progress("tester")).toMatchObject({
      lessons: { done: 0, total: 0 },
      resume: { lesson: null },
    });
    expect(await save("tester", TRAVERSE, 800)).toMatchObject({
      ok: false,
      refusal: { decision: { outcome: "expired" } },
    });
    expect(await stored()).toHaveLength(2);

    // Renewed: it all shows again, where she left it.
    const renewed = await arm.admin.extendAccess(OWNER, {
      userId: userOf("tester"),
      examCode: "CE",
      days: 30,
      reason: "Renewed",
    });
    expect(renewed.ok).toBe(true);
    expect(await progress("tester")).toMatchObject({
      lessons: { done: 1, total: 5 },
      resume: { lesson: { lessonId: TRAVERSE, position: 760 } },
    });
    expect(await resumeOf("tester", TRAVERSE)).toMatchObject({ state: "resume", from: 760 });
  });

  it("keeps progress when a Lesson is unpublished", async () => {
    await save("tester", AREAS, 100);
    await arm.admin.setLessonPublished(EDITOR, AREAS, false);
    expect(await stored()).toHaveLength(1);
    await arm.admin.setLessonPublished(EDITOR, AREAS, true);
    expect(await resumeOf("tester", AREAS)).toMatchObject({ state: "resume", from: 100 });
  });

  it("removes a deleted Lesson's progress, which the delete dialog counted", async () => {
    await save("tester", AREAS, 100);
    await save("stranger", SIMPLE_CURVES, 30);
    const lessonIn = async (id: string) =>
      (await arm.admin.getCourseForAdmin(EDITOR, SURVEYING_ID))?.modules
        .flatMap((module) => module.lessons)
        .find((lesson) => lesson.id === id);
    expect((await lessonIn(AREAS))?.savedPositions).toBe(1);
    expect((await lessonIn(TRAVERSE))?.savedPositions).toBe(0);

    expect((await arm.admin.deleteLesson(EDITOR, AREAS, createFakeVideoService())).ok).toBe(true);
    expect((await arm.lessonProgress()).map((record) => record.lessonId)).toEqual([SIMPLE_CURVES]);
  });
});

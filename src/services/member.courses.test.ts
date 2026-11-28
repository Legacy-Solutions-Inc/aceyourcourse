import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccessDecision, AllowedVia, MemberAccess } from "@/lib/member-app/access";
import { shortMemberId } from "@/lib/member-app/member-id";
import { createFakeAuthAdmin } from "@/services/auth-admin.fake";
import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { sampleUserId } from "@/services/mock/members";
import type { CourseOpening, LessonOpening, MemberCourse } from "@/services/member.types";
import { createFakeVideoService, type FakeVideoService } from "@/services/video.fake";
import type { VideoService } from "@/services/video.types";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";

// Watching video Courses through the Member seam (Phase 5, ticket 03; spec,
// Phase 5 planning decisions → Access and playback, The Courses screen;
// Testing Decisions → Phase 5 seams → Member seam, extended; stories 157,
// 159, 163–165), run against every arm: the Courses screen's shelf for an
// Exam, a Course's Lesson list, and a Lesson with its playback pass, each
// through the access decision, with Course Ownership from fixtures (tickets
// 06 and 07 make it). The sample CE Courses: "Surveying & Curves Lectures"
// (MSTC, included in CE All-Access, 2 Modules, 5 Lessons, "Simple curves"
// Free Preview), "PSAD Masterclass" (PSAD, sold separately at ₱1,499, on
// sale, 3 Lessons) and "HPGE Crash Course" (HPGE, sold separately, not on
// sale, 3 Lessons). It's 28 Nov 2026, 11:42 in Manila. The tester (Bea) holds
// CE All-Access; the lapsed tester's CE pass ended 3 days before; the
// stranger has none.
const BOOT = new Date("2026-11-28T03:42:00.000Z");
const OWNER = sampleActor("owner");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const SURVEYING = "Surveying & Curves Lectures";
const PSAD = "PSAD Masterclass";
const HPGE = "HPGE Crash Course";
const SURVEYING_ID = sampleCourseId(SURVEYING);
const PSAD_ID = sampleCourseId(PSAD);
const HPGE_ID = sampleCourseId(HPGE);
const LEVELING = sampleLessonId(SURVEYING, "Surveying basics", "Distance and leveling");
const TRAVERSE = sampleLessonId(SURVEYING, "Surveying basics", "Traverse computations");
const SIMPLE_CURVES = sampleLessonId(SURVEYING, "Horizontal curves", "Simple curves");
const BEAMS = sampleLessonId(PSAD, "Reinforced concrete", "Beams in flexure");
const SHEAR = sampleLessonId(PSAD, "Reinforced concrete", "Shear and torsion");

/** Each Lesson's Course, as its address names it. */
const COURSE_OF: Record<string, string> = {
  [LEVELING]: SURVEYING_ID,
  [TRAVERSE]: SURVEYING_ID,
  [SIMPLE_CURVES]: SURVEYING_ID,
  [BEAMS]: PSAD_ID,
  [SHEAR]: PSAD_ID,
};

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  lapsed: { email: "lapsed@example.com", name: "Lou Lapsed" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);
/** What drifts across `who`'s video: their own email and short Member ID. */
const watermarkOf = (who: Who) => `${MEMBERS[who].email} · ${shortMemberId(userOf(who))}`;

const allowed = (via: AllowedVia): AccessDecision => ({ outcome: "allowed", via });
const LOCKED: AccessDecision = { outcome: "locked" };

describe.each(MEMBER_ARMS)("Member seam watching video Courses ($name)", (arm) => {
  const { seam } = arm;
  let video: FakeVideoService;

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

  const shelf = async (who: Who, exam = "CE", overrides: Partial<MemberAccess> = {}) =>
    seam.listCourses(userOf(who), exam, await accessOf(who, overrides));
  const course = async (who: Who, id: string, overrides: Partial<MemberAccess> = {}) =>
    seam.openCourse(userOf(who), id, await accessOf(who, overrides));
  const lesson = async (
    who: Who,
    id: string,
    overrides: Partial<MemberAccess> = {},
    service: VideoService | null = video,
    courseId = COURSE_OF[id] ?? SURVEYING_ID,
  ) =>
    seam.openLesson(
      userOf(who),
      { courseId, lessonId: id },
      await accessOf(who, overrides),
      service,
    );

  /** Gives `who` Course Ownership of a Course, as a Paid Order or a gift will. */
  const owns = (who: Who, courseId: string) =>
    arm.putCourseOwnership({
      userId: userOf(who),
      courseId,
      since: new Date().toISOString(),
      orderId: null,
    });

  /** One Course off a shelf, by id. */
  function onShelf(courses: MemberCourse[], id: string): MemberCourse {
    const found = courses.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`${id} isn't on the shelf`);
    return found;
  }

  /** The Course page's outline, for a Course that opened. */
  function outlineOf(opening: CourseOpening) {
    if (opening.status !== "open") throw new Error(`Not opened: ${opening.status}`);
    return opening.outline;
  }

  function refusalOf(opening: LessonOpening | CourseOpening) {
    if (opening.status !== "refused") throw new Error(`Not refused: ${opening.status}`);
    return opening.decision;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    for (const who of Object.keys(MEMBERS) as Who[]) {
      await seam.getOrCreateMember({ userId: userOf(who), ...MEMBERS[who] });
    }
    video = createFakeVideoService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listCourses", () => {
    it("shows Bea (CE All-Access) the Exam's Courses with their states, counts and Subjects", async () => {
      const { subjects, courses } = await shelf("tester");

      expect(subjects.map((subject) => subject.code)).toEqual(["MSTC", "HPGE", "PSAD"]);
      expect(courses.map((each) => each.title)).toEqual([SURVEYING, PSAD, HPGE]);
      expect(onShelf(courses, SURVEYING_ID)).toEqual({
        id: SURVEYING_ID,
        examCode: "CE",
        subjectCode: "MSTC",
        title: SURVEYING,
        description: expect.any(String),
        coverSrc: null,
        access: "included",
        priceCentavos: null,
        onSale: false,
        visible: true,
        owned: false,
        modules: 2,
        lessons: 5,
        freePreviewLessons: 1,
        firstLessonId: LEVELING,
        firstFreeLessonId: SIMPLE_CURVES,
        decision: allowed("pass"),
      });
      // An Access Pass never opens a separately sold Course.
      expect(onShelf(courses, PSAD_ID)).toMatchObject({
        access: "sold-separately",
        priceCentavos: 149_900,
        onSale: true,
        owned: false,
        modules: 2,
        lessons: 3,
        freePreviewLessons: 0,
        firstFreeLessonId: null,
        decision: LOCKED,
      });
      expect(onShelf(courses, HPGE_ID)).toMatchObject({
        access: "sold-separately",
        priceCentavos: null,
        onSale: false,
        decision: LOCKED,
      });
    });

    it("locks the included Course for a Member with no pass, and says expired once a pass ended", async () => {
      expect(onShelf((await shelf("stranger")).courses, SURVEYING_ID).decision).toEqual(LOCKED);
      const [lapsedPass] = await seam.listAccessPasses(userOf("lapsed"));
      expect(onShelf((await shelf("lapsed")).courses, SURVEYING_ID).decision).toEqual({
        outcome: "expired",
        passEndedAt: lapsedPass?.endsAt,
      });
    });

    it("doesn't open the Course with a pass for another Exam", async () => {
      const passes = [{ examCode: "ME", endsAt: "2027-01-01T00:00:00.000Z" }];
      expect(
        onShelf((await shelf("stranger", "CE", { passes })).courses, SURVEYING_ID),
      ).toMatchObject({ decision: LOCKED });
    });

    it("marks a Course the Member owns, and opens it with no pass", async () => {
      await owns("stranger", PSAD_ID);
      expect(onShelf((await shelf("stranger")).courses, PSAD_ID)).toMatchObject({
        owned: true,
        decision: allowed("ownership"),
      });
    });

    it("lists a Hidden Course only for its owner", async () => {
      await owns("stranger", PSAD_ID);
      await arm.admin.setCourseVisibility(OWNER, PSAD_ID, false);

      expect((await shelf("tester")).courses.map((each) => each.id)).toEqual([
        SURVEYING_ID,
        HPGE_ID,
      ]);
      expect(onShelf((await shelf("stranger")).courses, PSAD_ID)).toMatchObject({
        visible: false,
        owned: true,
        decision: allowed("ownership"),
      });
    });

    it("never reads another Member's Course Ownership", async () => {
      await owns("tester", PSAD_ID);
      await arm.admin.setCourseVisibility(OWNER, HPGE_ID, false);
      await owns("tester", HPGE_ID);

      const { courses } = await shelf("stranger");
      expect(courses.map((each) => each.id)).toEqual([SURVEYING_ID, PSAD_ID]);
      expect(onShelf(courses, PSAD_ID)).toMatchObject({ owned: false, decision: LOCKED });
    });

    it("counts only Published Lessons, and the Modules that have one", async () => {
      await arm.admin.setLessonPublished(OWNER, TRAVERSE, false);
      expect(onShelf((await shelf("tester")).courses, SURVEYING_ID)).toMatchObject({
        modules: 2,
        lessons: 4,
      });
    });

    it("has no Courses for an Exam with no Visible ones", async () => {
      for (const id of [SURVEYING_ID, PSAD_ID, HPGE_ID]) {
        await arm.admin.setCourseVisibility(OWNER, id, false);
      }
      expect((await shelf("tester")).courses).toEqual([]);
      expect((await shelf("tester", "ME")).courses).toEqual([]);
    });

    it("has no Subjects and no Courses for an Exam that isn't one", async () => {
      expect(await shelf("tester", "NOPE")).toEqual({ subjects: [], courses: [] });
    });
  });

  describe("openCourse", () => {
    it("opens Bea's included Course: its Modules and Lessons with their lengths, all playable", async () => {
      const outline = outlineOf(await course("tester", SURVEYING_ID));

      expect(outline.map((module) => [module.number, module.title])).toEqual([
        [1, "Surveying basics"],
        [2, "Horizontal curves"],
      ]);
      expect(outline[1]?.lessons).toEqual([
        {
          id: SIMPLE_CURVES,
          number: 1,
          title: "Simple curves",
          seconds: expect.any(Number),
          freePreview: true,
          playable: true,
        },
        expect.objectContaining({
          number: 2,
          title: "Compound and reverse curves",
          playable: true,
        }),
      ]);
      expect(outline.flatMap((module) => module.lessons).every((each) => each.playable)).toBe(true);
    });

    it("opens a locked Course's list too, where only its Free Preview Lessons play", async () => {
      const opening = await course("stranger", SURVEYING_ID);
      expect(opening).toMatchObject({ status: "open", course: { decision: LOCKED } });
      const playable = outlineOf(opening)
        .flatMap((module) => module.lessons)
        .filter((each) => each.playable)
        .map((each) => each.title);
      expect(playable).toEqual(["Simple curves"]);
    });

    it("leaves an Unpublished Lesson out, for its owner too", async () => {
      await owns("stranger", PSAD_ID);
      await arm.admin.setLessonPublished(OWNER, SHEAR, false);
      const titles = outlineOf(await course("stranger", PSAD_ID)).flatMap((module) =>
        module.lessons.map((each) => `${module.number}.${each.number} ${each.title}`),
      );
      expect(titles).toEqual(["1.1 Beams in flexure", "2.1 Tension members"]);
    });

    it("opens a Hidden Course for its owner, and refuses it as unavailable to anyone else", async () => {
      await owns("stranger", PSAD_ID);
      await arm.admin.setCourseVisibility(OWNER, PSAD_ID, false);

      expect(await course("stranger", PSAD_ID)).toMatchObject({ status: "open" });
      expect(refusalOf(await course("tester", PSAD_ID))).toEqual({ outcome: "unavailable" });
      expect(refusalOf(await course("tester", PSAD_ID, { activeStaff: true }))).toEqual({
        outcome: "unavailable",
      });
    });

    it("refuses on a replaced device or with no device token", async () => {
      expect(refusalOf(await course("tester", SURVEYING_ID, { device: "replaced" }))).toEqual({
        outcome: "device-replaced",
      });
      expect(refusalOf(await course("tester", SURVEYING_ID, { device: "no-token" }))).toEqual({
        outcome: "no-token",
      });
    });

    it("finds nothing for an id that isn't a Course's", async () => {
      expect(await course("tester", UNKNOWN)).toEqual({ status: "not-found" });
      expect(await course("tester", "not-an-id")).toEqual({ status: "not-found" });
      expect(await course("tester", LEVELING)).toEqual({ status: "not-found" });
    });
  });

  describe("openLesson", () => {
    it("gives Bea a playback pass for an included Lesson, watermarked with her email and Member ID", async () => {
      const opening = await lesson("tester", TRAVERSE);
      if (opening.status !== "allowed") throw new Error(`Not allowed: ${opening.status}`);

      expect(opening.via).toBe("pass");
      expect(opening.lesson).toMatchObject({
        id: TRAVERSE,
        title: "Traverse computations",
        moduleNumber: 1,
        number: 2,
        notes: "",
        playable: true,
      });
      expect(opening.course).toMatchObject({ id: SURVEYING_ID, title: SURVEYING });
      expect(opening.outline).toHaveLength(2);
      expect(opening.player).toEqual({
        kind: "pass",
        pass: { kind: "sample", token: expect.stringMatching(/^sample:/) },
        seconds: opening.lesson.seconds,
        watermark: watermarkOf("tester"),
      });
      expect(video.passes).toEqual([
        { videoId: expect.any(String), watermark: watermarkOf("tester") },
      ]);
    });

    it("gives the notes as the Lesson has them", async () => {
      const opening = await lesson("tester", LEVELING);
      expect(opening).toMatchObject({
        status: "allowed",
        lesson: { notes: "Taping corrections.\nDifferential leveling." },
      });
    });

    it("plays a Free Preview Lesson for a Member with no pass", async () => {
      expect(await lesson("stranger", SIMPLE_CURVES)).toMatchObject({
        status: "allowed",
        via: "free-preview",
        player: { kind: "pass", watermark: watermarkOf("stranger") },
      });
    });

    it("always draws the requesting Member's own email and Member ID", async () => {
      await lesson("tester", SIMPLE_CURVES);
      await lesson("stranger", SIMPLE_CURVES);
      expect(video.passes.map((pass) => pass.watermark)).toEqual([
        watermarkOf("tester"),
        watermarkOf("stranger"),
      ]);
    });

    it("refuses a locked Lesson, even by its address, and asks for no pass", async () => {
      expect(await lesson("stranger", TRAVERSE)).toMatchObject({
        status: "refused",
        decision: LOCKED,
        course: { id: SURVEYING_ID },
        lesson: { id: TRAVERSE, title: "Traverse computations" },
      });
      expect(video.passes).toEqual([]);
    });

    it("never opens a separately sold Course's Lesson with an Access Pass", async () => {
      expect(refusalOf(await lesson("tester", BEAMS))).toEqual(LOCKED);
      expect(video.passes).toEqual([]);
    });

    it("says expired, with no pass, once the Member's pass ended", async () => {
      const [lapsedPass] = await seam.listAccessPasses(userOf("lapsed"));
      expect(refusalOf(await lesson("lapsed", TRAVERSE))).toEqual({
        outcome: "expired",
        passEndedAt: lapsedPass?.endsAt,
      });
      expect(video.passes).toEqual([]);
    });

    it("doesn't open an included Lesson with a pass for another Exam", async () => {
      const passes = [{ examCode: "ME", endsAt: "2027-01-01T00:00:00.000Z" }];
      expect(refusalOf(await lesson("stranger", TRAVERSE, { passes }))).toEqual(LOCKED);
    });

    it("plays an owned Course's Lesson, including after Staff hide the Course", async () => {
      await owns("stranger", PSAD_ID);
      expect(await lesson("stranger", BEAMS)).toMatchObject({
        status: "allowed",
        via: "ownership",
      });

      await arm.admin.setCourseVisibility(OWNER, PSAD_ID, false);
      expect(await lesson("stranger", BEAMS)).toMatchObject({
        status: "allowed",
        via: "ownership",
        course: { visible: false },
      });
      expect(refusalOf(await lesson("tester", BEAMS))).toEqual({ outcome: "unavailable" });
    });

    it("refuses an Unpublished Lesson to everyone, its Course's owners included", async () => {
      await owns("stranger", PSAD_ID);
      await arm.admin.setLessonPublished(OWNER, SHEAR, false);

      expect(refusalOf(await lesson("stranger", SHEAR))).toEqual({ outcome: "unavailable" });
      expect(refusalOf(await lesson("tester", SHEAR, { activeStaff: true }))).toEqual({
        outcome: "unavailable",
      });
      expect(video.passes).toEqual([]);
    });

    it("refuses a Hidden included Course's Lesson to a pass holder", async () => {
      await arm.admin.setCourseVisibility(OWNER, SURVEYING_ID, false);
      expect(refusalOf(await lesson("tester", TRAVERSE))).toEqual({ outcome: "unavailable" });
    });

    it("opens everything Published for active Staff", async () => {
      expect(await lesson("stranger", BEAMS, { activeStaff: true })).toMatchObject({
        status: "allowed",
        via: "staff",
      });
    });

    it("gives no pass to a replaced device, or a request with no device token", async () => {
      expect(refusalOf(await lesson("tester", TRAVERSE, { device: "replaced" }))).toEqual({
        outcome: "device-replaced",
      });
      expect(refusalOf(await lesson("tester", SIMPLE_CURVES, { device: "no-token" }))).toEqual({
        outcome: "no-token",
      });
      expect(refusalOf(await lesson("tester", TRAVERSE, { gate: "not-open-yet" }))).toEqual({
        outcome: "not-open-yet",
      });
      expect(video.passes).toEqual([]);
    });

    it("says the video isn't available yet with no video service, the rest of the Lesson still there", async () => {
      expect(await lesson("tester", TRAVERSE, {}, null)).toMatchObject({
        status: "allowed",
        lesson: { title: "Traverse computations" },
        player: { kind: "not-connected" },
      });
    });

    it("says so when the video service gives no pass", async () => {
      const refusing: VideoService = { ...video, playbackPass: async () => null };
      expect(await lesson("tester", TRAVERSE, {}, refusing)).toMatchObject({
        status: "allowed",
        player: { kind: "didnt-answer" },
      });
    });

    it("finds nothing for an id that isn't a Lesson's", async () => {
      expect(await lesson("tester", UNKNOWN)).toEqual({ status: "not-found" });
      expect(await lesson("tester", "not-an-id")).toEqual({ status: "not-found" });
      expect(await lesson("tester", SURVEYING_ID)).toEqual({ status: "not-found" });
      expect(video.passes).toEqual([]);
    });

    it("finds nothing, and asks for no pass, for a Lesson the named Course doesn't hold", async () => {
      expect(await lesson("tester", TRAVERSE, {}, video, PSAD_ID)).toEqual({
        status: "not-found",
      });
      expect(video.passes).toEqual([]);
    });
  });

  describe("deleting the account", () => {
    it("removes the Member's Course Ownerships with it", async () => {
      await owns("stranger", PSAD_ID);
      const { request } = await seam.requestPrivacy(userOf("stranger"), "deletion");
      expect(
        await arm.admin.deleteMemberAccount(
          OWNER,
          { requestId: request.id, confirmation: MEMBERS.stranger.email },
          createFakeAuthAdmin(),
        ),
      ).toMatchObject({ ok: true });

      expect(onShelf((await shelf("stranger")).courses, PSAD_ID)).toMatchObject({
        owned: false,
        decision: LOCKED,
      });
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import type { NewCourseForm } from "@/services/admin.schema";
import type { AdminCourse, StaffActor } from "@/services/admin.types";
import { sampleCourseId } from "@/services/mock/courses";
import { createFakeVideoService } from "@/services/video.fake";

import { sampleActor, UNUSED_EXAM, withUnusedExam } from "../../test/admin-inputs";
import { ADMIN_ARMS } from "../../test/admin-arms";

// ─────────────────────────────────────────────────────────────────────────────
// The Course builder through the Admin seam (Phase 5, ticket 01; spec, Phase 5
// planning decisions → A Course, Who does what, The Course builder, Hiding,
// unpublishing and deleting; stories 156, 174, 175, 177, 179): any Staff User
// makes Courses, their Modules and their Lessons, in order. Every rule is the
// seam's: the Subject one of the Exam's, the titles' lengths, a Module
// deleted only when empty, Visible needing a Published Lesson, Publish
// needing a ready video, the conflict check on an edit, and an Exam or
// Subject with a Course counting as used. Each change appends Staff Activity.
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const SURVEYING = sampleCourseId("Surveying & Curves Lectures");
const PSAD = sampleCourseId("PSAD Masterclass");
const HPGE = sampleCourseId("HPGE Crash Course");

const NEW_COURSE: NewCourseForm = {
  title: "PSAD Masterclass 2",
  description: "Loads to details.\nIn concrete and steel.",
  exam: "CE",
  subject: "PSAD",
  cover: null,
};

describe.each(ADMIN_ARMS)("the Course builder ($name)", (arm) => {
  const { seam } = arm;
  let video = createFakeVideoService();

  beforeEach(async () => {
    await arm.reset();
    video = createFakeVideoService();
  });

  async function courseOf(id: string): Promise<AdminCourse> {
    const course = await seam.getCourseForAdmin(EDITOR, id);
    if (!course) throw new Error(`No Course ${id}`);
    return course;
  }

  async function newCourse(actor: StaffActor = EDITOR, input: NewCourseForm = NEW_COURSE) {
    const result = await seam.createCourse(actor, input);
    if (!result.ok) throw new Error(`The Course wasn't made: ${JSON.stringify(result.error)}`);
    return result.value.id;
  }

  async function newModule(course: string, title: string, actor: StaffActor = EDITOR) {
    const result = await seam.createCourseModule(actor, { course, title });
    if (!result.ok) throw new Error(`The Module wasn't made: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  async function newLesson(module: string, title: string, actor: StaffActor = EDITOR) {
    const result = await seam.createLesson(actor, { module, title });
    if (!result.ok) throw new Error(`The Lesson wasn't made: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  /** The Course's Modules, each with its Lessons' titles, in order. */
  const outline = async (id: string) =>
    (await courseOf(id)).modules.map((module) => ({
      title: module.title,
      lessons: module.lessons.map((lesson) => lesson.title),
    }));

  /** Runs `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    return { result, appended: (await arm.staffActivity()).slice(before.length) };
  }

  describe("the sample Courses", () => {
    it("lists the three, oldest first, each with its Exam, Lesson count and Visible", async () => {
      const list = await seam.listCoursesForAdmin(EDITOR);
      expect(list.courses).toEqual([
        {
          id: SURVEYING,
          title: "Surveying & Curves Lectures",
          examCode: "CE",
          subjectCode: "MSTC",
          lessons: 5,
          visibility: "visible",
        },
        {
          id: PSAD,
          title: "PSAD Masterclass",
          examCode: "CE",
          subjectCode: "PSAD",
          lessons: 3,
          visibility: "visible",
        },
        {
          id: HPGE,
          title: "HPGE Crash Course",
          examCode: "CE",
          subjectCode: "HPGE",
          lessons: 3,
          visibility: "visible",
        },
      ]);
      expect(list.exams.find((exam) => exam.code === "CE")?.subjects.map((s) => s.code)).toEqual([
        "MSTC",
        "HPGE",
        "PSAD",
      ]);
    });

    it("has Surveying & Curves Lectures included, in 2 Modules, with 1 Free Preview Lesson, every Lesson Published with a ready video", async () => {
      const course = await courseOf(SURVEYING);
      expect(course.course).toMatchObject({ access: "included", priceCentavos: null });
      expect(course.modules.map((module) => module.lessons.length)).toEqual([3, 2]);
      const lessons = course.modules.flatMap((module) => module.lessons);
      expect(lessons.filter((lesson) => lesson.freePreview)).toHaveLength(1);
      expect(new Set(lessons.map((lesson) => lesson.state))).toEqual(new Set(["published"]));
      for (const lesson of lessons) {
        expect(lesson.videoId).toEqual(expect.any(String));
        expect(lesson.videoSeconds).toBeGreaterThan(0);
        expect(lesson.replacementVideoId).toBeNull();
      }
      expect(lessons.every((lesson) => lesson.savedPositions === 0)).toBe(true);
    });

    it("has PSAD Masterclass sold separately at ₱1,499 on sale, and HPGE Crash Course not on sale", async () => {
      expect((await courseOf(PSAD)).course).toMatchObject({
        access: "sold-separately",
        priceCentavos: 149_900,
        onSale: true,
      });
      expect((await courseOf(HPGE)).course).toMatchObject({
        access: "sold-separately",
        onSale: false,
      });
    });

    it("finds no Course for an unknown or malformed id", async () => {
      expect(await seam.getCourseForAdmin(EDITOR, UNKNOWN)).toBeNull();
      expect(await seam.getCourseForAdmin(EDITOR, "not-an-id")).toBeNull();
    });
  });

  describe("building a Course", () => {
    it("lets an Editor make a Course, Modules and Lessons, reorder and move them, and keeps the order", async () => {
      const id = await newCourse();
      const course = await courseOf(id);
      expect(course.course).toMatchObject({
        title: "PSAD Masterclass 2",
        description: "Loads to details.\nIn concrete and steel.",
        examCode: "CE",
        subjectCode: "PSAD",
        visibility: "hidden",
        access: "included",
        priceCentavos: null,
        onSale: false,
        coverSrc: null,
      });

      const concrete = await newModule(id, "Reinforced concrete");
      const steel = await newModule(id, "Steel design");
      const beams = await newLesson(concrete.id, "Beams");
      await newLesson(concrete.id, "Columns");
      await newLesson(steel.id, "Tension members");
      expect(await outline(id)).toEqual([
        { title: "Reinforced concrete", lessons: ["Beams", "Columns"] },
        { title: "Steel design", lessons: ["Tension members"] },
      ]);

      const movedModules = await seam.moveCourseModule(EDITOR, steel.id, "up");
      expect(movedModules).toEqual({ ok: true, value: [steel.id, concrete.id], tags: [] });
      expect((await seam.moveLesson(EDITOR, beams.id, "down")).ok).toBe(true);
      const toSteel = await seam.moveLessonToModule(EDITOR, { id: beams.id, module: steel.id });
      expect(toSteel.ok && toSteel.value.length).toBe(2);
      const renamed = await seam.renameCourseModule(
        EDITOR,
        { id: steel.id, title: "Steel and timber" },
        { savedAt: (await courseOf(id)).modules[0]?.stamp.savedAt ?? "" },
      );
      expect(renamed.ok).toBe(true);

      // Read again, as a reload does.
      expect(await outline(id)).toEqual([
        { title: "Steel and timber", lessons: ["Tension members", "Beams"] },
        { title: "Reinforced concrete", lessons: ["Columns"] },
      ]);
      const positions = (await courseOf(id)).modules.map((module) => [
        module.position,
        module.lessons.map((lesson) => lesson.position),
      ]);
      expect(positions).toEqual([
        [1, [1, 2]],
        [2, [1]],
      ]);
      expect((await seam.listCoursesForAdmin(EDITOR)).courses.at(-1)).toMatchObject({
        id,
        lessons: 3,
      });
    });

    it("lets an Owner build too, recording each change in Staff Activity", async () => {
      const { result: made, appended: madeRecords } = await appendedBy(() =>
        seam.createCourse(OWNER, NEW_COURSE),
      );
      if (!made.ok) throw new Error("not made");
      const id = made.value.id;
      expect(madeRecords).toMatchObject([
        {
          actor: { email: OWNER.email },
          entity: "course",
          entityId: id,
          action: "add",
          before: null,
        },
      ]);

      const { result: module, appended: moduleRecords } = await appendedBy(() =>
        newModule(id, "Loads", OWNER),
      );
      expect(moduleRecords).toMatchObject([
        { entity: "course-module", entityId: module.id, action: "add" },
      ]);
      const { result: lesson, appended: lessonRecords } = await appendedBy(() =>
        newLesson(module.id, "Dead and live loads", OWNER),
      );
      expect(lessonRecords).toMatchObject([
        { entity: "lesson", entityId: lesson.id, action: "add" },
      ]);

      const { appended: edited } = await appendedBy(() =>
        seam.updateLesson(
          OWNER,
          {
            id: lesson.id,
            title: "Dead loads",
            notes: "Line one.\r\nLine two.",
            freePreview: true,
          },
          { savedAt: lesson.stamp.savedAt },
        ),
      );
      expect(edited).toMatchObject([
        {
          entity: "lesson",
          action: "edit",
          before: { title: "Dead and live loads", notes: "", freePreview: false },
          after: { title: "Dead loads", notes: "Line one.\nLine two.", freePreview: true },
        },
      ]);

      const { appended: deleted } = await appendedBy(() =>
        seam.deleteLesson(OWNER, lesson.id, video),
      );
      expect(deleted).toMatchObject([{ entity: "lesson", action: "delete", after: null }]);
      const { appended: moduleGone } = await appendedBy(() =>
        seam.deleteCourseModule(OWNER, module.id),
      );
      expect(moduleGone).toMatchObject([{ entity: "course-module", action: "delete" }]);
    });

    it("moves a Course to another Exam with one of that Exam's Subjects", async () => {
      await arm.reset(withUnusedExam);
      const course = await courseOf(PSAD);
      const { result, appended } = await appendedBy(() =>
        seam.updateCourse(
          EDITOR,
          {
            id: PSAD,
            title: "PSAD Masterclass",
            description: "",
            exam: "che",
            subject: "thermo",
            cover: null,
          },
          { savedAt: course.stamp.savedAt },
        ),
      );
      expect(result).toMatchObject({ ok: true, value: { examCode: "CHE", subjectCode: "THERMO" } });
      expect(appended).toMatchObject([{ entity: "course", action: "move-exam" }]);
      expect((await courseOf(PSAD)).subject).toEqual({ code: "THERMO", name: "Thermodynamics" });
    });

    it("deletes a Course with its Modules and Lessons", async () => {
      const course = await courseOf(SURVEYING);
      const lesson = course.modules[0]?.lessons[0];
      const { result, appended } = await appendedBy(() =>
        seam.deleteCourse(EDITOR, SURVEYING, video),
      );
      expect(result.ok).toBe(true);
      expect(appended).toMatchObject([{ entity: "course", action: "delete", after: null }]);
      expect(await seam.getCourseForAdmin(EDITOR, SURVEYING)).toBeNull();
      expect((await seam.listCoursesForAdmin(EDITOR)).courses).toHaveLength(2);
      expect(await seam.deleteLesson(EDITOR, lesson?.id ?? UNKNOWN, video)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("publishes a Lesson whose video is ready, and only then lets the Course be Visible", async () => {
      const id = await newCourse();
      const loads = await newModule(id, "Loads");
      const lesson = await newLesson(loads.id, "Dead loads");
      // An upload made it a draft with a ready video.
      await arm.setLessonState(lesson.id, "draft");
      const { result, appended } = await appendedBy(() =>
        seam.setLessonPublished(EDITOR, lesson.id, true),
      );
      expect(result).toMatchObject({ ok: true, value: { state: "published" } });
      expect(appended).toMatchObject([
        {
          entity: "lesson",
          action: "publish",
          before: { state: "draft" },
          after: { state: "published" },
        },
      ]);
      const shown = await appendedBy(() => seam.setCourseVisibility(EDITOR, id, true));
      expect(shown.result).toEqual({ ok: true, value: { visibility: "visible" }, tags: [] });
      expect(shown.appended).toMatchObject([{ entity: "course", action: "show" }]);
      // Hidden again, its Lesson can go back to a draft.
      expect((await seam.setCourseVisibility(EDITOR, id, false)).ok).toBe(true);
      const unpublished = await seam.setLessonPublished(EDITOR, lesson.id, false);
      expect(unpublished).toMatchObject({ ok: true, value: { state: "draft" } });
    });

    it("refuses to unpublish a Visible Course's last Published Lesson, and hides it when that Lesson is deleted", async () => {
      const id = await newCourse();
      const loads = await newModule(id, "Loads");
      const first = await newLesson(loads.id, "Dead loads");
      const second = await newLesson(loads.id, "Live loads");
      await arm.setLessonState(first.id, "published");
      await arm.setLessonState(second.id, "published");
      expect((await seam.setCourseVisibility(EDITOR, id, true)).ok).toBe(true);

      // Another Published Lesson is left: it stays Visible.
      expect((await seam.setLessonPublished(EDITOR, first.id, false)).ok).toBe(true);
      expect((await courseOf(id)).course.visibility).toBe("visible");

      // The last one can't be unpublished while the Course is Visible.
      const refused = await appendedBy(() => seam.setLessonPublished(EDITOR, second.id, false));
      expect(refused.result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "A visible course needs a published lesson. Hide the course first.",
        },
      });
      expect(refused.appended).toEqual([]);
      expect((await courseOf(id)).modules[0]?.lessons[1]?.state).toBe("published");

      // Deleting it hides the Course.
      const { appended } = await appendedBy(() => seam.deleteLesson(EDITOR, second.id, video));
      expect(appended).toMatchObject([
        { entity: "lesson", action: "delete" },
        {
          entity: "course",
          action: "hide",
          before: { visibility: "visible" },
          after: { visibility: "hidden" },
        },
      ]);
      expect((await courseOf(id)).course.visibility).toBe("hidden");
    });

    it("takes a finished cover upload as the Course's cover", async () => {
      const { path, publicUrl } = await arm.uploadPhoto({ purpose: "course-cover" });
      const id = await newCourse(EDITOR, { ...NEW_COURSE, cover: path });
      expect((await courseOf(id)).course.coverSrc).toBe(publicUrl);
    });
  });

  describe("refusals", () => {
    it("refuses a Subject that isn't one of the Exam's, on create and on moving the Course", async () => {
      await arm.reset(withUnusedExam);
      const before = await arm.staffActivity();
      expect(await seam.createCourse(EDITOR, { ...NEW_COURSE, subject: "THERMO" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { subject: ["PICK ONE OF CE’S SUBJECTS"] } },
      });
      expect(await seam.createCourse(EDITOR, { ...NEW_COURSE, exam: "XYZ" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { exam: ["PICK AN EXAM"] } },
      });
      const course = await courseOf(PSAD);
      expect(
        await seam.updateCourse(
          EDITOR,
          {
            id: PSAD,
            title: "PSAD Masterclass",
            description: "",
            exam: UNUSED_EXAM.code,
            subject: "PSAD",
            cover: null,
          },
          { savedAt: course.stamp.savedAt },
        ),
      ).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { subject: ["PICK ONE OF CHE’S SUBJECTS"] } },
      });
      expect((await courseOf(PSAD)).course.examCode).toBe("CE");
      expect(await arm.staffActivity()).toEqual(before);
    });

    it("refuses an empty or over-long title for a Course, a Module and a Lesson", async () => {
      const long = "x".repeat(121);
      const first = (await courseOf(PSAD)).modules[0];
      const lesson = first?.lessons[0];
      const refusals = [
        await seam.createCourse(EDITOR, { ...NEW_COURSE, title: "   " }),
        await seam.createCourse(EDITOR, { ...NEW_COURSE, title: long }),
        await seam.createCourseModule(EDITOR, { course: PSAD, title: "" }),
        await seam.createCourseModule(EDITOR, { course: PSAD, title: long }),
        await seam.renameCourseModule(EDITOR, { id: first?.id ?? UNKNOWN, title: " " }),
        await seam.createLesson(EDITOR, { module: first?.id ?? UNKNOWN, title: "" }),
        await seam.updateLesson(EDITOR, {
          id: lesson?.id ?? UNKNOWN,
          title: long,
          notes: "",
          freePreview: false,
        }),
      ];
      expect(refusals.map((result) => !result.ok && result.error.kind)).toEqual(
        Array(7).fill("invalid"),
      );
      expect(
        refusals.map(
          (result) =>
            !result.ok && result.error.kind === "invalid" && result.error.fieldErrors.title,
        ),
      ).toEqual([
        ["ENTER THE COURSE’S TITLE"],
        ["KEEP IT TO 120 CHARACTERS"],
        ["ENTER THE MODULE’S TITLE"],
        ["KEEP IT TO 120 CHARACTERS"],
        ["ENTER THE MODULE’S TITLE"],
        ["ENTER THE LESSON’S TITLE"],
        ["KEEP IT TO 120 CHARACTERS"],
      ]);
    });

    it("refuses to delete a Module that still has Lessons", async () => {
      const concrete = (await courseOf(PSAD)).modules[0];
      const { result, appended } = await appendedBy(() =>
        seam.deleteCourseModule(EDITOR, concrete?.id ?? UNKNOWN),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "MOVE OR DELETE ITS 2 LESSONS FIRST",
        },
      });
      expect(appended).toEqual([]);
      expect((await courseOf(PSAD)).modules).toHaveLength(2);
    });

    it("refuses to make a Course Visible without a Published Lesson", async () => {
      const id = await newCourse();
      const loads = await newModule(id, "Loads");
      await newLesson(loads.id, "Dead loads");
      const { result, appended } = await appendedBy(() =>
        seam.setCourseVisibility(EDITOR, id, true),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "Needs at least one published lesson",
        },
      });
      expect(appended).toEqual([]);
      expect((await courseOf(id)).course.visibility).toBe("hidden");
      // Hidden always saves, and changes nothing here.
      expect(await seam.setCourseVisibility(EDITOR, id, false)).toMatchObject({ ok: true });
    });

    it("refuses to publish a Lesson without a video", async () => {
      const id = await newCourse();
      const lesson = await newLesson((await newModule(id, "Loads")).id, "Dead loads");
      const { result, appended } = await appendedBy(() =>
        seam.setLessonPublished(EDITOR, lesson.id, true),
      );
      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "ADD A VIDEO BEFORE PUBLISHING" },
      });
      expect(appended).toEqual([]);
    });

    it("refuses a stale edit, changing nothing", async () => {
      const course = await courseOf(PSAD);
      const opened = { savedAt: course.stamp.savedAt };
      const settings = { id: PSAD, description: "", exam: "CE", subject: "PSAD", cover: null };
      const first = await seam.updateCourse(OWNER, { ...settings, title: "First save" }, opened);
      expect(first.ok).toBe(true);
      const { result, appended } = await appendedBy(() =>
        seam.updateCourse(EDITOR, { ...settings, title: "Second save" }, opened),
      );
      expect(result).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
      expect(appended).toEqual([]);
      expect((await courseOf(PSAD)).course.title).toBe("First save");

      const concrete = course.modules[0];
      const lesson = concrete?.lessons[0];
      if (!concrete || !lesson) throw new Error("PSAD has no Lessons");
      await seam.renameCourseModule(
        OWNER,
        { id: concrete.id, title: "One" },
        { savedAt: concrete.stamp.savedAt },
      );
      expect(
        await seam.renameCourseModule(
          EDITOR,
          { id: concrete.id, title: "Two" },
          { savedAt: concrete.stamp.savedAt },
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      const form = { id: lesson.id, notes: "", freePreview: false };
      await seam.updateLesson(OWNER, { ...form, title: "One" }, { savedAt: lesson.stamp.savedAt });
      expect(
        await seam.updateLesson(
          EDITOR,
          { ...form, title: "Two" },
          { savedAt: lesson.stamp.savedAt },
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      expect(await outline(PSAD)).toMatchObject([
        { title: "One", lessons: ["One", "Shear and torsion"] },
        {},
      ]);
    });

    it("refuses to move past either end, or to a Module of another Course", async () => {
      const course = await courseOf(PSAD);
      const [first, last] = course.modules;
      const other = (await courseOf(HPGE)).modules[0];
      expect(await seam.moveCourseModule(EDITOR, first?.id ?? UNKNOWN, "up")).toMatchObject({
        ok: false,
        error: { formError: "IT’S ALREADY THE FIRST MODULE" },
      });
      expect(await seam.moveLesson(EDITOR, last?.lessons[0]?.id ?? UNKNOWN, "down")).toMatchObject({
        ok: false,
        error: { formError: "IT’S ALREADY THE LAST LESSON IN ITS MODULE" },
      });
      expect(
        await seam.moveLessonToModule(EDITOR, {
          id: first?.lessons[0]?.id ?? UNKNOWN,
          module: other?.id ?? UNKNOWN,
        }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });

    it("refuses a cover upload of the wrong type or size, and a cover that isn't a finished upload", async () => {
      const [uploads] = await import("../../test/upload-arms").then((m) => m.UPLOAD_ARMS);
      if (!uploads) throw new Error("No upload arm");
      const wrongType = await uploads.seam.createUpload(EDITOR, {
        purpose: "course-cover",
        contentType: "image/gif" as "image/png",
        size: 1000,
      });
      expect(wrongType).toMatchObject({
        ok: false,
        error: { fieldErrors: { contentType: ["USE A JPEG, PNG OR WEBP IMAGE"] } },
      });
      const tooBig = await uploads.seam.createUpload(EDITOR, {
        purpose: "course-cover",
        contentType: "image/png",
        size: 10 * 1024 * 1024 + 1,
      });
      expect(tooBig).toMatchObject({
        ok: false,
        error: { fieldErrors: { size: ["KEEP EACH PHOTO TO 10 MB"] } },
      });
      const unsent = await arm.uploadPhoto({ purpose: "course-cover", send: false });
      expect(await seam.createCourse(EDITOR, { ...NEW_COURSE, cover: unsent.path })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { cover: ["WAIT FOR THE COVER TO FINISH UPLOADING"] },
        },
      });
      const photo = await arm.uploadPhoto({ purpose: "product-photo" });
      expect(await seam.createCourse(EDITOR, { ...NEW_COURSE, cover: photo.path })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { cover: ["UPLOAD THE COVER AGAIN"] } },
      });
    });

    it("counts an Exam or Subject with a Course as used, so neither can be deleted", async () => {
      await arm.reset(withUnusedExam);
      await newCourse(EDITOR, { ...NEW_COURSE, exam: "CHE", subject: "THERMO" });
      expect(await seam.deleteSubject(OWNER, "CHE", "THERMO")).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "1 Course uses THERMO. Move or delete it first.",
        },
      });
      expect(await seam.deleteExam(OWNER, "CHE")).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "1 Course belongs to CHE. Move or delete it first.",
        },
      });
      const page = await seam.getExamPageForAdmin(OWNER, "CHE");
      expect(page).toMatchObject({ courses: 1, subjectCourses: { THERMO: 1, PCHEM: 0 } });
      // The other Subject has no Course, so it can go.
      expect((await seam.deleteSubject(OWNER, "CHE", "PCHEM")).ok).toBe(true);
    });

    it("has no write for how Members get a Course, its price or On sale", async () => {
      const course = await courseOf(PSAD);
      const result = await seam.updateCourse(
        EDITOR,
        {
          id: PSAD,
          title: "PSAD Masterclass",
          description: "",
          exam: "CE",
          subject: "PSAD",
          cover: null,
          ...{ access: "included", priceCentavos: 100, onSale: false },
        } as Parameters<typeof seam.updateCourse>[1],
        { savedAt: course.stamp.savedAt },
      );
      expect(result.ok).toBe(true);
      expect((await courseOf(PSAD)).course).toMatchObject({
        access: "sold-separately",
        priceCentavos: 149_900,
        onSale: true,
      });
      const writes = Object.keys(seam).filter((name) => /price|onsale|access/i.test(name));
      expect(writes.filter((name) => /course/i.test(name))).toEqual([]);
    });

    it("answers not-found for a Course, Module or Lesson that isn't there", async () => {
      const results = await Promise.all([
        seam.createCourseModule(EDITOR, { course: UNKNOWN, title: "x" }),
        seam.createLesson(EDITOR, { module: UNKNOWN, title: "x" }),
        seam.deleteCourse(EDITOR, UNKNOWN, video),
        seam.setLessonPublished(EDITOR, UNKNOWN, true),
      ]);
      expect(results).toEqual(Array(4).fill({ ok: false, error: { kind: "not-found" } }));
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import type { LessonUploadInput } from "@/services/admin.schema";
import type { AdminLesson } from "@/services/admin.types";
import { sampleCourseId } from "@/services/mock/courses";
import { createFakeVideoService, type FakeVideoService } from "@/services/video.fake";

import { sampleActor } from "../../test/admin-inputs";
import { ADMIN_ARMS } from "../../test/admin-arms";

// ─────────────────────────────────────────────────────────────────────────────
// Lesson videos through the Admin seam (Phase 5, ticket 02; spec, Phase 5
// planning decisions → The video service interface, Uploads, Hiding,
// unpublishing and deleting, Access and playback; stories 156, 176, 177,
// 178, 187), over both arms with the video fake. Upload permission is asked
// only after the file checks and only for a Lesson that's there, and the new
// video is recorded on the Lesson before the browser sends anything. The
// status poll makes it a draft with its length. "Replace video" keeps the
// ready video until the new one is ready, then deletes the old one. Deleting
// a Lesson or a Course deletes its videos; a delete the service refuses still
// deletes the Lesson, and is logged.
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";
const PSAD = sampleCourseId("PSAD Masterclass");
const GB = 1024 ** 3;

const mp4 = (id: string, fields: Partial<LessonUploadInput> = {}): LessonUploadInput => ({
  id,
  name: "beams.mp4",
  type: "video/mp4",
  size: 250 * 1024 * 1024,
  ...fields,
});

describe.each(ADMIN_ARMS)("Lesson videos ($name)", (arm) => {
  const { seam } = arm;
  let video: FakeVideoService;

  beforeEach(async () => {
    await arm.reset();
    // Videos stay processing until a test finishes them.
    video = createFakeVideoService({ processingMs: Number.POSITIVE_INFINITY });
  });

  /** A new Hidden Course with one Module and a Lesson with no video, and their ids. */
  async function freshLesson(title = "Dead loads") {
    const course = await seam.createCourse(EDITOR, {
      title: "Loads 101",
      description: "",
      exam: "CE",
      subject: "PSAD",
      cover: null,
    });
    if (!course.ok) throw new Error("No Course");
    const loads = await seam.createCourseModule(EDITOR, {
      course: course.value.id,
      title: "Loads",
    });
    if (!loads.ok) throw new Error("No Module");
    const lesson = await seam.createLesson(EDITOR, { module: loads.value.id, title });
    if (!lesson.ok) throw new Error("No Lesson");
    return { course: course.value.id, module: loads.value.id, lesson: lesson.value.id };
  }

  async function lessonOf(id: string): Promise<AdminLesson> {
    for (const summary of (await seam.listCoursesForAdmin(EDITOR)).courses) {
      const course = await seam.getCourseForAdmin(EDITOR, summary.id);
      const found = course?.modules.flatMap((module) => module.lessons).find((l) => l.id === id);
      if (found) return found;
    }
    throw new Error(`No Lesson ${id}`);
  }

  /** Starts an upload, giving the new video's id. */
  async function started(lesson: string) {
    const result = await seam.startLessonUpload(EDITOR, mp4(lesson), video);
    if (!result.ok) throw new Error(`No upload: ${JSON.stringify(result.error)}`);
    return result.value.videoId;
  }

  /** Runs `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    return { result, appended: (await arm.staffActivity()).slice(before.length) };
  }

  describe("uploading", () => {
    it("gives permission for an MP4 and records the video on the Lesson, uploading, before anything is sent", async () => {
      const { lesson } = await freshLesson();
      const { result, appended } = await appendedBy(() =>
        seam.startLessonUpload(EDITOR, mp4(lesson), video),
      );
      expect(result).toMatchObject({ ok: true, value: { target: { kind: "fake" } } });
      const videoId = result.ok ? result.value.videoId : "";
      expect(video.permissions).toEqual(["Dead loads"]);
      expect(result.ok && result.value.lesson).toMatchObject({ state: "uploading", videoId });
      expect(await lessonOf(lesson)).toMatchObject({
        state: "uploading",
        videoId,
        videoSeconds: null,
        replacementVideoId: null,
      });
      expect(appended).toMatchObject([
        {
          entity: "lesson",
          entityId: lesson,
          action: "upload-video",
          before: { state: "no-video", videoId: null },
          after: { state: "uploading", videoId },
        },
      ]);
    });

    it("takes a MOV, and an Owner's upload too", async () => {
      const { lesson } = await freshLesson();
      const result = await seam.startLessonUpload(
        OWNER,
        mp4(lesson, { name: "beams.mov", type: "video/quicktime" }),
        video,
      );
      expect(result.ok).toBe(true);
    });

    it("goes from uploading to processing once sent, then to a draft with its length once ready", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      const sent = await appendedBy(() =>
        seam.finishLessonUpload(EDITOR, { id: lesson, video: videoId, outcome: "sent" }),
      );
      expect(sent.result).toMatchObject({ ok: true, value: { state: "processing" } });
      expect(sent.appended).toMatchObject([{ action: "video-uploaded" }]);

      // Still processing: the poll changes nothing.
      const polled = await appendedBy(() => seam.checkLessonVideo(EDITOR, lesson, video));
      expect(polled.result).toMatchObject({ ok: true, value: { state: "processing" } });
      expect(polled.appended).toEqual([]);

      video.finish(videoId, 754);
      const ready = await appendedBy(() => seam.checkLessonVideo(EDITOR, lesson, video));
      expect(ready.result).toMatchObject({
        ok: true,
        value: { state: "draft", videoId, videoSeconds: 754 },
      });
      expect(ready.appended).toMatchObject([
        {
          action: "video-ready",
          before: { state: "processing", videoSeconds: null },
          after: { state: "draft", videoSeconds: 754 },
        },
      ]);
      expect(await lessonOf(lesson)).toMatchObject({ state: "draft", videoSeconds: 754 });
      // Then it publishes.
      expect(await seam.setLessonPublished(EDITOR, lesson, true)).toMatchObject({
        ok: true,
        value: { state: "published" },
      });
    });

    it("takes VdoCipher's word that the file arrived when the browser never said so", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      video.finish(videoId, 300);
      expect(await seam.checkLessonVideo(EDITOR, lesson, video)).toMatchObject({
        ok: true,
        value: { state: "draft", videoSeconds: 300 },
      });
    });

    it("leaves a Lesson with nothing in flight as it is, asking the service nothing", async () => {
      const { lesson } = await freshLesson();
      const { result, appended } = await appendedBy(() =>
        seam.checkLessonVideo(EDITOR, lesson, video),
      );
      expect(result).toMatchObject({ ok: true, value: { state: "no-video" } });
      expect(appended).toEqual([]);
    });

    it("ignores the browser's word about a video the Lesson has moved on from", async () => {
      const { lesson } = await freshLesson();
      const first = await started(lesson);
      const second = await started(lesson);
      const { result, appended } = await appendedBy(() =>
        seam.finishLessonUpload(EDITOR, { id: lesson, video: first, outcome: "sent" }),
      );
      expect(result).toMatchObject({ ok: true, value: { state: "uploading", videoId: second } });
      expect(appended).toEqual([]);
    });
  });

  describe("upload refusals", () => {
    it("refuses a file that isn't an MP4 or MOV, or is over 4 GB, before asking for permission", async () => {
      const { lesson } = await freshLesson();
      const before = await arm.staffActivity();
      const refusals = await Promise.all([
        seam.startLessonUpload(
          EDITOR,
          mp4(lesson, { name: "beams.avi", type: "video/x-msvideo" }),
          video,
        ),
        seam.startLessonUpload(
          EDITOR,
          mp4(lesson, { name: "beams.mp4", type: "application/pdf" }),
          video,
        ),
        seam.startLessonUpload(EDITOR, mp4(lesson, { size: 4 * GB + 1 }), video),
      ]);
      expect(refusals.map((result) => !result.ok && result.error)).toEqual([
        { kind: "invalid", fieldErrors: { file: ["PICK AN MP4 OR MOV VIDEO"] } },
        { kind: "invalid", fieldErrors: { file: ["PICK AN MP4 OR MOV VIDEO"] } },
        { kind: "invalid", fieldErrors: { file: ["KEEP THE VIDEO TO 4 GB OR LESS"] } },
      ]);
      expect(video.permissions).toEqual([]);
      expect((await lessonOf(lesson)).state).toBe("no-video");
      expect(await arm.staffActivity()).toEqual(before);
    });

    it("refuses permission for a Lesson that isn't there, asking the service nothing", async () => {
      expect(await seam.startLessonUpload(EDITOR, mp4(UNKNOWN), video)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(video.permissions).toEqual([]);
    });

    it("refuses with no video service connected: Connect the video service to upload", async () => {
      const { lesson } = await freshLesson();
      expect(await seam.startLessonUpload(EDITOR, mp4(lesson), null)).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "CONNECT THE VIDEO SERVICE TO UPLOAD",
        },
      });
      expect((await lessonOf(lesson)).state).toBe("no-video");
    });

    it("changes nothing when the service gives no permission", async () => {
      const { lesson } = await freshLesson();
      video.refusePermissions();
      const { result, appended } = await appendedBy(() =>
        seam.startLessonUpload(EDITOR, mp4(lesson), video),
      );
      expect(result).toMatchObject({
        ok: false,
        error: { formError: "THE VIDEO SERVICE DIDN’T ANSWER · TRY AGAIN" },
      });
      expect(appended).toEqual([]);
      expect((await lessonOf(lesson)).state).toBe("no-video");
    });
  });

  describe("a failed upload", () => {
    it("shows upload failed, can't be published, and trying again starts over, deleting the failed video", async () => {
      const { lesson } = await freshLesson();
      const failed = await started(lesson);
      const { result, appended } = await appendedBy(() =>
        seam.finishLessonUpload(EDITOR, { id: lesson, video: failed, outcome: "failed" }),
      );
      expect(result).toMatchObject({ ok: true, value: { state: "upload-failed" } });
      expect(appended).toMatchObject([{ action: "upload-failed" }]);
      expect(await seam.setLessonPublished(EDITOR, lesson, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "ADD A VIDEO BEFORE PUBLISHING" },
      });

      const again = await started(lesson);
      expect(again).not.toBe(failed);
      expect(await lessonOf(lesson)).toMatchObject({ state: "uploading", videoId: again });
      expect(video.deleted).toEqual([failed]);
    });

    it("shows upload failed when the service fails the video while processing", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      video.fail(videoId);
      expect(await seam.checkLessonVideo(EDITOR, lesson, video)).toMatchObject({
        ok: true,
        value: { state: "upload-failed" },
      });
    });
  });

  describe("publishing", () => {
    it("refuses to publish while the video uploads or processes: WAIT FOR THE VIDEO TO FINISH UPLOADING", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      const wait = {
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "WAIT FOR THE VIDEO TO FINISH UPLOADING",
        },
      };
      expect(await seam.setLessonPublished(EDITOR, lesson, true)).toEqual(wait);
      await seam.finishLessonUpload(EDITOR, { id: lesson, video: videoId, outcome: "sent" });
      expect(await seam.setLessonPublished(EDITOR, lesson, true)).toEqual(wait);
      expect((await lessonOf(lesson)).state).toBe("processing");
    });

    it("lets a Course be Visible once it has a Published Lesson, and refuses unpublishing that last one", async () => {
      const { course, lesson } = await freshLesson();
      expect((await seam.setCourseVisibility(EDITOR, course, true)).ok).toBe(false);
      const videoId = await started(lesson);
      video.finish(videoId, 600);
      await seam.checkLessonVideo(EDITOR, lesson, video);
      expect((await seam.setLessonPublished(EDITOR, lesson, true)).ok).toBe(true);
      expect(await seam.setCourseVisibility(EDITOR, course, true)).toMatchObject({ ok: true });
      expect(await seam.setLessonPublished(EDITOR, lesson, false)).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "A visible course needs a published lesson. Hide the course first.",
        },
      });
      expect((await lessonOf(lesson)).state).toBe("published");
    });
  });

  describe("Replace video", () => {
    it("keeps the Published Lesson's ready video until the new one is ready, then deletes the old one", async () => {
      const { lesson } = await freshLesson();
      const old = await started(lesson);
      video.finish(old, 600);
      await seam.checkLessonVideo(EDITOR, lesson, video);
      await seam.setLessonPublished(EDITOR, lesson, true);

      const replaced = await appendedBy(() => seam.startLessonUpload(EDITOR, mp4(lesson), video));
      expect(replaced.appended).toMatchObject([{ action: "replace-video" }]);
      const next = replaced.result.ok ? replaced.result.value.videoId : "";
      // The old video still plays: the Lesson stays Published, on it.
      expect(await lessonOf(lesson)).toMatchObject({
        state: "published",
        videoId: old,
        videoSeconds: 600,
        replacementVideoId: next,
        replacementState: "uploading",
      });

      await seam.finishLessonUpload(EDITOR, { id: lesson, video: next, outcome: "sent" });
      expect(await lessonOf(lesson)).toMatchObject({
        videoId: old,
        replacementState: "processing",
      });
      await seam.checkLessonVideo(EDITOR, lesson, video);
      expect(video.deleted).toEqual([]);

      video.finish(next, 900);
      const { appended } = await appendedBy(() => seam.checkLessonVideo(EDITOR, lesson, video));
      expect(appended).toMatchObject([{ action: "video-ready" }]);
      expect(await lessonOf(lesson)).toMatchObject({
        state: "published",
        videoId: next,
        videoSeconds: 900,
        replacementVideoId: null,
        replacementState: null,
      });
      expect(video.deleted).toEqual([old]);
    });

    it("keeps the old video when the replacement's upload fails, and can still be published", async () => {
      const { lesson } = await freshLesson();
      await arm.setLessonState(lesson, "draft");
      const next = await started(lesson);
      await seam.finishLessonUpload(EDITOR, { id: lesson, video: next, outcome: "failed" });
      const now = await lessonOf(lesson);
      expect(now).toMatchObject({ state: "draft", replacementState: "upload-failed" });
      expect(now.videoId).not.toBe(next);
      expect((await seam.setLessonPublished(EDITOR, lesson, true)).ok).toBe(true);
    });
  });

  describe("deleting", () => {
    it("deletes a Lesson's video at the service once the Lesson is deleted", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      expect((await seam.deleteLesson(EDITOR, lesson, video)).ok).toBe(true);
      expect(video.deleted).toEqual([videoId]);
    });

    it("still deletes the Lesson when the service won't delete its video, and logs it in Staff Activity", async () => {
      const { lesson } = await freshLesson();
      const videoId = await started(lesson);
      video.failDeletes();
      const { result, appended } = await appendedBy(() => seam.deleteLesson(EDITOR, lesson, video));
      expect(result.ok).toBe(true);
      expect(appended).toMatchObject([
        { entity: "lesson", entityId: lesson, action: "delete" },
        {
          entity: "lesson",
          entityId: lesson,
          action: "video-delete-failed",
          actor: { email: EDITOR.email },
          before: { lesson, videoId },
          after: null,
        },
      ]);
      await expect(lessonOf(lesson)).rejects.toThrow();
    });

    it("deletes every video of a Course it deletes, old and replacement alike", async () => {
      const { course, lesson } = await freshLesson();
      await arm.setLessonState(lesson, "draft");
      const replacement = await started(lesson);
      const ready = (await lessonOf(lesson)).videoId;
      expect((await seam.deleteCourse(EDITOR, course, video)).ok).toBe(true);
      expect([...video.deleted].sort()).toEqual([ready, replacement].sort());
    });

    it("logs a sample Course's videos as not deleted when no video service is connected", async () => {
      const lessons = (await seam.getCourseForAdmin(EDITOR, PSAD))?.modules.flatMap(
        (module) => module.lessons,
      );
      const { result, appended } = await appendedBy(() => seam.deleteCourse(EDITOR, PSAD, null));
      expect(result.ok).toBe(true);
      expect(appended.filter((record) => record.action === "video-delete-failed")).toHaveLength(
        lessons?.length ?? -1,
      );
    });
  });

  describe("the Staff preview", () => {
    it("gives a playback pass for the ready video, watermarked with the Staff member's email", async () => {
      const lesson = (await seam.getCourseForAdmin(EDITOR, PSAD))?.modules[0]?.lessons[0];
      if (!lesson?.videoId) throw new Error("No sample Lesson with a video");
      const { result, appended } = await appendedBy(() =>
        seam.previewLessonVideo(EDITOR, lesson.id, video),
      );
      expect(result).toEqual({
        ok: true,
        value: {
          pass: { kind: "sample", token: `sample:${lesson.videoId}` },
          seconds: lesson.videoSeconds,
        },
        tags: [],
      });
      expect(video.passes).toEqual([{ videoId: lesson.videoId, watermark: EDITOR.email }]);
      expect(appended).toEqual([]);
    });

    it("refuses a preview before the video is ready, or with no video service", async () => {
      const { lesson } = await freshLesson();
      expect(await seam.previewLessonVideo(EDITOR, lesson, video)).toMatchObject({
        ok: false,
        error: { formError: "THE VIDEO ISN’T READY YET" },
      });
      expect(await seam.previewLessonVideo(EDITOR, UNKNOWN, video)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.previewLessonVideo(EDITOR, lesson, null)).toMatchObject({ ok: false });
      expect(video.passes).toEqual([]);
    });
  });
});

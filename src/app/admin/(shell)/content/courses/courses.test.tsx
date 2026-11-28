import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { addCourse, createLessonUpload, removeLesson, saveCourseVisibility } from "./actions";
import CoursesPage from "./page";

// Courses & videos (Phase 5, ticket 01; stories 156, 174, 175, 177, 179), on
// sample data: the page as a browser loads it, and its Server Actions as a
// browser sends them. Every Admin action's refusals for signed-out visitors,
// non-Staff and closed mode are also in actions.permissions.test.ts; the
// seam's rules in admin.courses.test.ts.
const { jar, video } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  video: { connected: true },
}));

// Sample mode has the video fake; a test can take it away, as a deploy with no key has none.
vi.mock("@/services/video", async (importActual) => {
  const actual = await importActual<typeof import("@/services/video")>();
  return { ...actual, videoService: () => (video.connected ? actual.videoService() : null) };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/content/courses",
  useRouter: () => ({ refresh: () => {}, replace: () => {}, push: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";
const SURVEYING = sampleCourseId("Surveying & Curves Lectures");
const PSAD = sampleCourseId("PSAD Masterclass");
const SIMPLE_CURVES = sampleLessonId(
  "Surveying & Curves Lectures",
  "Horizontal curves",
  "Simple curves",
);

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const coursesPage = (params: Record<string, string> = {}) =>
  CoursesPage({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  jar.clear();
  resetSampleStore();
});

describe("the Courses & videos page", () => {
  it("shows an Editor the three sample Courses, all Visible", async () => {
    signInAs(EDITOR);
    render(await coursesPage());
    expect(screen.getByRole("heading", { level: 1, name: "Courses & videos" })).toBeInTheDocument();
    const list = screen.getByRole("navigation", { name: "COURSES · 3" });
    expect(within(list).getByText("Surveying & Curves Lectures")).toBeInTheDocument();
    expect(within(list).getByText("CE · 5 LESSONS · VISIBLE")).toBeInTheDocument();
    expect(within(list).getAllByText(/VISIBLE$/)).toHaveLength(3);
  });

  it("opens a Course's Modules and Lessons", async () => {
    signInAs(EDITOR);
    render(await coursesPage({ course: SURVEYING }));
    expect(screen.getByText("CE · MSTC · 2 MODULES · 5 LESSONS · 5 PUBLISHED")).toBeInTheDocument();
    expect(screen.getAllByText("FREE PREVIEW")).toHaveLength(1);
    expect(screen.getAllByText("PUBLISHED")).toHaveLength(5);
  });

  it("shows how Members get each Course in its settings, read-only", async () => {
    signInAs(EDITOR);
    render(await coursesPage({ course: PSAD, view: "settings" }));
    expect(screen.getByText("Sold separately · ₱1,499")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("opens a Lesson in the Lesson editor", async () => {
    signInAs(OWNER);
    render(await coursesPage({ course: SURVEYING, lesson: SIMPLE_CURVES }));
    expect(screen.getByLabelText("LESSON TITLE")).toHaveValue("Simple curves");
    // Sample mode has the video fake: the ready video, its preview and Replace video.
    expect(screen.getByText(/^VIDEO READY · \d+:\d\d$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ Preview" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace video" })).toBeEnabled();
    expect(screen.queryByText("Connect the video service to upload")).not.toBeInTheDocument();
  });

  it("says Connect the video service to upload when there's no video service, and the rest still works", async () => {
    video.connected = false;
    try {
      signInAs(EDITOR);
      render(await coursesPage({ course: SURVEYING, lesson: SIMPLE_CURVES }));
      expect(screen.getByText("Connect the video service to upload")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replace video" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
    } finally {
      video.connected = true;
    }
  });

  it("opens a new Course's settings", async () => {
    signInAs(EDITOR);
    render(await coursesPage({ course: "new" }));
    expect(screen.getByRole("heading", { name: "NEW COURSE" })).toBeInTheDocument();
    expect(screen.getByText("Included in CE All-Access")).toBeInTheDocument();
  });

  it("answers 404 for a Course that isn't there", async () => {
    signInAs(EDITOR);
    await expect(coursesPage({ course: "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("sends a signed-out visitor to sign in, coming back to the Course", async () => {
    await expect(coursesPage({ course: PSAD })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent(`/admin/content/courses?course=${PSAD}`)}`,
    );
  });

  it("sends a User who isn't Staff to the 403 screen", async () => {
    signInAs("someone@example.com");
    await expect(coursesPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
  });
});

describe("the Courses & videos actions", () => {
  const IDLE = { status: "idle" } as const;

  it("lets an Editor add a Course, recorded under Courses in Staff Activity", async () => {
    signInAs(EDITOR);
    const state = await addCourse(IDLE, {
      input: { title: "Steel Lectures", description: "", exam: "CE", subject: "PSAD", cover: null },
    });
    expect(state).toMatchObject({ status: "saved", value: { title: "Steel Lectures" } });
    expect(getSampleStore().staffActivity.at(-1)).toMatchObject({
      entity: "course",
      action: "add",
    });
  });

  it("refuses to make a Course Visible without a Published Lesson", async () => {
    signInAs(EDITOR);
    const added = await addCourse(IDLE, {
      input: { title: "Steel Lectures", description: "", exam: "CE", subject: "PSAD", cover: null },
    });
    const course = added.status === "saved" ? added.value.id : "";
    expect(await saveCourseVisibility(IDLE, { input: { course, visible: true } })).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "Needs at least one published lesson" },
    });
  });

  it("gives an Editor upload permission for a Lesson in sample mode, recording the new video on it", async () => {
    signInAs(EDITOR);
    const state = await createLessonUpload(IDLE, {
      input: { id: SIMPLE_CURVES, name: "curves.mov", type: "video/quicktime", size: 2048 },
    });
    expect(state).toMatchObject({
      status: "saved",
      value: { target: { kind: "fake" }, lesson: { replacementState: "uploading" } },
    });
    const lesson = getSampleStore().lessons.find((candidate) => candidate.id === SIMPLE_CURVES);
    expect(lesson?.replacementVideoId).toBe(state.status === "saved" ? state.value.videoId : "");
  });

  it("refuses upload permission with no video service, and for a file that isn't a video", async () => {
    signInAs(EDITOR);
    expect(
      await createLessonUpload(IDLE, {
        input: { id: SIMPLE_CURVES, name: "notes.pdf", type: "application/pdf", size: 2048 },
      }),
    ).toMatchObject({
      status: "refused",
      error: { fieldErrors: { file: ["PICK AN MP4 OR MOV VIDEO"] } },
    });
    video.connected = false;
    try {
      expect(
        await createLessonUpload(IDLE, {
          input: { id: SIMPLE_CURVES, name: "curves.mp4", type: "video/mp4", size: 2048 },
        }),
      ).toMatchObject({
        status: "refused",
        error: { formError: "CONNECT THE VIDEO SERVICE TO UPLOAD" },
      });
    } finally {
      video.connected = true;
    }
  });

  it("deletes nothing when DELETE isn't typed", async () => {
    signInAs(EDITOR);
    const before = getSampleStore().lessons.length;
    const state = await removeLesson(IDLE, { input: { id: SIMPLE_CURVES, confirm: "delete" } });
    expect(state).toMatchObject({
      status: "refused",
      error: { kind: "invalid", fieldErrors: { confirm: ["TYPE DELETE TO CONFIRM"] } },
    });
    expect(getSampleStore().lessons).toHaveLength(before);
  });
});

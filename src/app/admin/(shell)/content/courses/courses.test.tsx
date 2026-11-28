import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleCourseId, sampleLessonId } from "@/services/mock/courses";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { addCourse, removeLesson, saveCourseVisibility } from "./actions";
import CoursesPage from "./page";

// Courses & videos (Phase 5, ticket 01; stories 156, 174, 175, 177, 179), on
// sample data: the page as a browser loads it, and its Server Actions as a
// browser sends them. Every Admin action's refusals for signed-out visitors,
// non-Staff and closed mode are also in actions.permissions.test.ts; the
// seam's rules in admin.courses.test.ts.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

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
  it("shows an Editor the three sample Courses, all Hidden", async () => {
    signInAs(EDITOR);
    render(await coursesPage());
    expect(screen.getByRole("heading", { level: 1, name: "Courses & videos" })).toBeInTheDocument();
    const list = screen.getByRole("navigation", { name: "COURSES · 3" });
    expect(within(list).getByText("Surveying & Curves Lectures")).toBeInTheDocument();
    expect(within(list).getByText("CE · 5 LESSONS · HIDDEN")).toBeInTheDocument();
    expect(within(list).getAllByText(/HIDDEN$/)).toHaveLength(3);
  });

  it("opens a Course's Modules and Lessons", async () => {
    signInAs(EDITOR);
    render(await coursesPage({ course: SURVEYING }));
    expect(screen.getByText("CE · MSTC · 2 MODULES · 5 LESSONS · 0 PUBLISHED")).toBeInTheDocument();
    expect(screen.getAllByText("FREE PREVIEW")).toHaveLength(1);
    expect(screen.getAllByText("NO VIDEO")).toHaveLength(5);
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
    expect(
      await saveCourseVisibility(IDLE, { input: { course: SURVEYING, visible: true } }),
    ).toEqual({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "Needs at least one published lesson" },
    });
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

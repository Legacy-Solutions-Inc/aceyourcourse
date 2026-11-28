import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";

import { CONCRETE, COURSE, OPENED, OPENED_COURSE, STEEL } from "../../../../test/course-fixtures";
import { CourseBuilder, type CourseBuilderActions } from "./course-builder";
import { CoursesList } from "./courses-list";

// The Course builder (Phase 5, ticket 01): the Modules in order with their
// Lessons, ▲▼, "Move to Module…", the title edited in place, "+ Lesson" and
// "+ Module", and a Module with Lessons kept from being deleted. The Server
// Actions are the boundary, so they're replaced.
const { push, refresh, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function renderBuilder(actions: Partial<CourseBuilderActions> = {}, opened = OPENED_COURSE) {
  const all = {
    addCourseModule: vi.fn(async () => saved({ ...STEEL, title: "Timber" })),
    saveCourseModuleTitle: vi.fn(async () =>
      saved({ id: CONCRETE.id, title: "Concrete", stamp: OPENED }),
    ),
    moveCourseModuleInCourse: vi.fn(async () => saved([STEEL.id, CONCRETE.id])),
    removeCourseModule: vi.fn(async () =>
      saved({ id: STEEL.id, courseId: COURSE.id, position: 2, title: STEEL.title }),
    ),
    addLesson: vi.fn(async () => saved(CONCRETE.lessons[0])),
    moveLessonInModule: vi.fn(async () => saved([])),
    moveLessonToOtherModule: vi.fn(async () => saved([])),
    ...actions,
  } as unknown as CourseBuilderActions & Record<string, ReturnType<typeof vi.fn>>;
  render(<CourseBuilder opened={opened} actions={all} />);
  return all;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  toast.mockClear();
});

describe("CourseBuilder", () => {
  it("shows the Course's header, its Modules in order and each Lesson's number, tags and state", () => {
    renderBuilder();
    expect(screen.getByRole("heading", { level: 2, name: "PSAD Masterclass" })).toBeInTheDocument();
    expect(screen.getByText("CE · PSAD · 2 MODULES · 2 LESSONS · 0 PUBLISHED")).toBeInTheDocument();
    const modules = within(screen.getByRole("list", { name: "Modules" })).getAllByRole("listitem", {
      name: /^Module/,
    });
    expect(modules.map((module) => module.getAttribute("aria-label"))).toEqual([
      "Module 1: Reinforced concrete",
      "Module 2: Steel design",
    ]);
    const lessons = within(
      screen.getByRole("list", { name: "Lessons in Reinforced concrete" }),
    ).getAllByRole("listitem");
    expect(lessons[0]).toHaveTextContent("1.1");
    expect(lessons[0]).toHaveTextContent("FREE PREVIEW");
    expect(lessons[0]).toHaveTextContent("NO VIDEO");
    expect(
      within(lessons[0] as HTMLElement).getByRole("link", { name: "Beams in flexure" }),
    ).toHaveAttribute(
      "href",
      `/admin/content/courses?course=${COURSE.id}&lesson=${CONCRETE.lessons[0]?.id}`,
    );
    expect(screen.getByRole("link", { name: "Course settings →" })).toHaveAttribute(
      "href",
      `/admin/content/courses?course=${COURSE.id}&view=settings`,
    );
  });

  it("moves a Lesson to another Module of the Course", async () => {
    const user = userEvent.setup();
    const actions = renderBuilder();
    await user.selectOptions(
      screen.getByLabelText("Move Beams in flexure to Module"),
      "Steel design",
    );
    expect(actions.moveLessonToOtherModule).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: CONCRETE.lessons[0]?.id, module: STEEL.id } },
    );
  });

  it("moves a Module and a Lesson one place with ▲▼", async () => {
    const user = userEvent.setup();
    const actions = renderBuilder();
    expect(screen.getByRole("button", { name: "Move up: Reinforced concrete" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move down: Reinforced concrete" }));
    expect(actions.moveCourseModuleInCourse).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: CONCRETE.id, direction: "down" } },
    );
    await user.click(screen.getByRole("button", { name: "Move down: Beams in flexure" }));
    expect(actions.moveLessonInModule).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: CONCRETE.lessons[0]?.id, direction: "down" } },
    );
  });

  it("renames a Module in place, sending the stamp it opened with", async () => {
    const user = userEvent.setup();
    const actions = renderBuilder();
    await user.click(screen.getByRole("button", { name: "Rename Reinforced concrete" }));
    const field = screen.getByLabelText("MODULE TITLE");
    await user.clear(field);
    await user.type(field, "Concrete");
    await user.click(screen.getByRole("button", { name: "Save title" }));
    expect(actions.saveCourseModuleTitle).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: CONCRETE.id, title: "Concrete" }, expected: { savedAt: OPENED.savedAt } },
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the conflict notice when someone renamed the Module first", async () => {
    const user = userEvent.setup();
    renderBuilder({
      saveCourseModuleTitle: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "conflict" as const, savedBy: "Angel", savedAt: OPENED.savedAt },
      })),
    });
    await user.click(screen.getByRole("button", { name: "Rename Reinforced concrete" }));
    await user.click(screen.getByRole("button", { name: "Save title" }));
    expect(screen.getByText("SOMEONE SAVED FIRST")).toBeInTheDocument();
  });

  it("adds a Module and a Lesson, showing a title the server refused", async () => {
    const user = userEvent.setup();
    const actions = renderBuilder({
      addLesson: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "invalid" as const, fieldErrors: { title: ["ENTER THE LESSON’S TITLE"] } },
      })),
    });
    await user.type(screen.getByLabelText("NEW MODULE"), "Timber");
    await user.click(screen.getByRole("button", { name: "+ Module" }));
    expect(actions.addCourseModule).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { course: COURSE.id, title: "Timber" } },
    );
    const [first] = screen.getAllByRole("button", { name: "+ Lesson" });
    if (!first) throw new Error("No + Lesson");
    await user.click(first);
    expect(screen.getByText("ENTER THE LESSON’S TITLE")).toBeInTheDocument();
  });

  it("keeps a Module with Lessons from being deleted, and lets an empty one go", () => {
    renderBuilder();
    const [concrete, steel] = within(screen.getByRole("list", { name: "Modules" })).getAllByRole(
      "listitem",
      { name: /^Module/ },
    );
    expect(concrete).toHaveTextContent("move or delete its 2 lessons first");
    expect(
      within(concrete as HTMLElement).queryByRole("button", { name: /Delete/ }),
    ).not.toBeInTheDocument();
    expect(
      within(steel as HTMLElement).getByRole("button", { name: "Delete Steel design" }),
    ).toBeInTheDocument();
  });

  it("explains Modules when the Course has none", () => {
    renderBuilder({}, { ...OPENED_COURSE, modules: [] });
    expect(
      screen.getByText("Group lessons into modules, like “Reinforced concrete” or “Steel design”."),
    ).toBeInTheDocument();
  });
});

describe("CoursesList", () => {
  it("lists the Courses with their Exam, Lesson count and visibility, then + New course", () => {
    render(
      <CoursesList
        selected={COURSE.id}
        courses={[
          {
            id: COURSE.id,
            title: "PSAD Masterclass",
            examCode: "CE",
            subjectCode: "PSAD",
            lessons: 1,
            visibility: "hidden",
          },
          {
            id: "c0000000-0000-4000-8000-000000000002",
            title: "HPGE Crash Course",
            examCode: "CE",
            subjectCode: "HPGE",
            lessons: 9,
            visibility: "visible",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "COURSES · 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PSAD Masterclass/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("CE · 1 LESSON · HIDDEN")).toBeInTheDocument();
    expect(screen.getByText("CE · 9 LESSONS · VISIBLE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New course" })).toHaveAttribute(
      "href",
      "/admin/content/courses?course=new",
    );
  });
});

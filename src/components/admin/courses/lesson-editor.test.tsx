import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminLesson } from "@/services/admin.types";
import type { Lesson } from "@/services/courses.types";

import { CONCRETE, COURSE, OPENED } from "../../../../test/course-fixtures";
import { LessonEditor, type LessonEditorActions, savedPositionsLine } from "./lesson-editor";

// The Lesson editor (Phase 5, ticket 01): title, notes, Free Preview, Save,
// Publish (refused without a video) and Delete lesson, which needs DELETE
// typed. The Server Actions are the boundary, so they're replaced.
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

const BEAMS = CONCRETE.lessons[0] as AdminLesson;

function renderEditor(actions: Partial<LessonEditorActions> = {}, lesson: AdminLesson = BEAMS) {
  const all = {
    saveLesson: vi.fn(async (): Promise<AdminActionState<AdminLesson>> => ({
      status: "saved",
      value: lesson,
    })),
    saveLessonPublished: vi.fn(async (): Promise<AdminActionState<AdminLesson>> => ({
      status: "refused",
      error: { kind: "invalid", fieldErrors: {}, formError: "ADD A VIDEO BEFORE PUBLISHING" },
    })),
    removeLesson: vi.fn(async (): Promise<AdminActionState<Lesson>> => ({
      status: "saved",
      value: lesson,
    })),
    ...actions,
  };
  render(
    <LessonEditor
      course={{ id: COURSE.id, title: COURSE.title }}
      moduleTitle={CONCRETE.title}
      lesson={lesson}
      actions={all}
    />,
  );
  return all;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  toast.mockClear();
});

describe("LessonEditor", () => {
  it("shows the Lesson with no video, its notes and Free Preview", () => {
    renderEditor({}, { ...BEAMS, notes: "Line one.\nLine two." });
    expect(screen.getByLabelText("LESSON TITLE")).toHaveValue("Beams in flexure");
    expect(screen.getAllByText("NO VIDEO").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("LESSON NOTES · SHOWN UNDER THE VIDEO")).toHaveValue(
      "Line one.\nLine two.",
    );
    expect(screen.getByRole("checkbox", { name: /Free preview/ })).toBeChecked();
  });

  it("saves the title, notes and Free Preview with the stamp it opened with", async () => {
    const user = userEvent.setup();
    const actions = renderEditor();
    await user.type(screen.getByLabelText("LESSON NOTES · SHOWN UNDER THE VIDEO"), "Watch this.");
    await user.click(screen.getByRole("checkbox", { name: /Free preview/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.saveLesson).toHaveBeenCalledWith(
      { status: "idle" },
      {
        input: {
          id: BEAMS.id,
          title: "Beams in flexure",
          notes: "Watch this.",
          freePreview: false,
        },
        expected: { savedAt: OPENED.savedAt },
      },
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows why Publish was refused: the Lesson has no video", async () => {
    const user = userEvent.setup();
    const actions = renderEditor();
    await user.click(screen.getByRole("button", { name: "Publish lesson" }));
    expect(actions.saveLessonPublished).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: BEAMS.id, published: true } },
    );
    expect(screen.getByText("ADD A VIDEO BEFORE PUBLISHING")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the conflict notice when someone saved the Lesson first", async () => {
    const user = userEvent.setup();
    renderEditor({
      saveLesson: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "conflict" as const, savedBy: "Angel", savedAt: OPENED.savedAt },
      })),
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("SOMEONE SAVED FIRST")).toBeInTheDocument();
  });

  it("deletes nothing until DELETE is typed, saying how many Members lose their place", async () => {
    const user = userEvent.setup();
    const actions = renderEditor();
    await user.click(screen.getByRole("button", { name: "Delete lesson" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("0 members lose their saved position in this lesson.");
    const confirm = within(dialog).getByRole("button", { name: "Delete lesson" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("TYPE DELETE TO CONFIRM"), "delete{Enter}");
    expect(actions.removeLesson).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("TYPE DELETE TO CONFIRM"));
    await user.type(within(dialog).getByLabelText("TYPE DELETE TO CONFIRM"), "DELETE");
    await user.click(confirm);
    expect(actions.removeLesson).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: BEAMS.id, confirm: "DELETE" } },
    );
    expect(push).toHaveBeenCalledWith(`/admin/content/courses?course=${COURSE.id}`);
  });

  it("counts the Members who lose their saved position", () => {
    expect(savedPositionsLine(1)).toBe("1 member loses their saved position in this lesson.");
    expect(savedPositionsLine(214)).toBe("214 members lose their saved position in this lesson.");
  });
});

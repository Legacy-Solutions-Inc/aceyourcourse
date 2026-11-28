import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminCourseSummary } from "@/services/admin.types";

import { COURSE, EXAMS, OPENED, OPENED_COURSE } from "../../../../test/course-fixtures";
import { CourseSettings, type CourseSettingsActions } from "./course-settings";

// Course settings (Phase 5, ticket 01): the title, description, cover, the
// Exam and one of its Subjects picked from the list, and "How members get
// it": read-only for an Editor, an Owner's switch with a confirmation saying
// how many Members it affects (ticket 06). The Server Actions are the
// boundary, so they're replaced; the screen shows what each one answers.
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

const SUMMARY: AdminCourseSummary = {
  id: COURSE.id,
  title: "Steel Lectures",
  examCode: "CE",
  subjectCode: "PSAD",
  lessons: 0,
  visibility: "hidden",
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function actionsWith(overrides: Partial<CourseSettingsActions> = {}) {
  return {
    createCourseCoverUpload: vi.fn(),
    addCourse: vi.fn(async (): Promise<AdminActionState<AdminCourseSummary>> => saved(SUMMARY)),
    saveCourse: vi.fn(async (): Promise<AdminActionState<AdminCourseSummary>> => saved(SUMMARY)),
    saveCourseVisibility: vi.fn(),
    removeCourse: vi.fn(),
    saveCourseAccess: vi.fn(),
    ...overrides,
  } as CourseSettingsActions & Record<string, ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  toast.mockClear();
});

describe("CourseSettings", () => {
  it("adds a new Course with a Subject picked from its Exam's list, Included by default", async () => {
    const user = userEvent.setup();
    const actions = actionsWith();
    render(<CourseSettings opened={null} exams={EXAMS} actions={actions} role="editor" />);

    expect(screen.getByText("Included in CE All-Access")).toBeInTheDocument();
    await user.type(screen.getByLabelText("COURSE TITLE"), "Steel Lectures");
    const subject = screen.getByLabelText("SUBJECT");
    expect(
      within(subject)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Pick a subject",
      "MSTC · Mathematics, Surveying & Transportation Engineering",
      "HPGE · Hydraulics & Geotechnical Engineering",
      "PSAD · Structural Design & Construction",
    ]);
    await user.selectOptions(subject, "PSAD");
    await user.click(screen.getByRole("button", { name: "Add course" }));

    expect(actions.addCourse).toHaveBeenCalledWith(
      { status: "idle" },
      {
        input: {
          title: "Steel Lectures",
          description: "",
          exam: "CE",
          subject: "PSAD",
          cover: null,
        },
      },
    );
    expect(push).toHaveBeenCalledWith(`/admin/content/courses?course=${COURSE.id}`);
  });

  it("asks for a Subject again from the new Exam's list when the Exam changes", async () => {
    const user = userEvent.setup();
    render(
      <CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actionsWith()} role="editor" />,
    );
    expect(screen.getByLabelText("SUBJECT")).toHaveValue("PSAD");
    await user.selectOptions(screen.getByLabelText("EXAM"), "CHE");
    const subject = screen.getByLabelText("SUBJECT");
    expect(subject).toHaveValue("");
    expect(
      within(subject)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Pick a subject", "PCHEM · Physical Chemistry", "THERMO · Thermodynamics"]);
  });

  it("shows the Subject the server refused next to the field", async () => {
    const user = userEvent.setup();
    const actions = actionsWith({
      saveCourse: vi.fn(async () => ({
        status: "refused" as const,
        error: {
          kind: "invalid" as const,
          fieldErrors: { subject: ["PICK ONE OF CHE’S SUBJECTS"] },
        },
      })),
    });
    render(<CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actions} role="editor" />);
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(screen.getByText("PICK ONE OF CHE’S SUBJECTS")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an Editor How members get it read-only, with no control to change it", () => {
    render(
      <CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actionsWith()} role="editor" />,
    );
    expect(screen.getByText("HOW MEMBERS GET IT")).toBeInTheDocument();
    expect(screen.getByText("Sold separately · ₱1,499")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/price/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /sale|separately|included/i }),
    ).not.toBeInTheDocument();
    // The only switch is the Course's visibility.
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("says a Course needs a published Lesson before it can be Visible", () => {
    render(
      <CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actionsWith()} role="editor" />,
    );
    expect(screen.getByRole("switch", { name: "Course visible to members" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByText("Needs at least one published lesson")).toBeInTheDocument();
  });

  it("sends the stamp it opened with, and shows the conflict notice when someone saved first", async () => {
    const user = userEvent.setup();
    const actions = actionsWith({
      saveCourse: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "conflict" as const, savedBy: "Angel", savedAt: OPENED.savedAt },
      })),
    });
    render(<CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actions} role="editor" />);
    await user.clear(screen.getByLabelText("COURSE TITLE"));
    await user.type(screen.getByLabelText("COURSE TITLE"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(actions.saveCourse).toHaveBeenCalledWith(
      { status: "idle" },
      expect.objectContaining({ expected: { savedAt: OPENED.savedAt } }),
    );
    expect(screen.getByText("SOMEONE SAVED FIRST")).toBeInTheDocument();
    expect(screen.getByLabelText("COURSE TITLE")).toHaveValue("Renamed");
  });

  it("refuses a cover of the wrong type before uploading it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const actions = actionsWith();
    render(<CourseSettings opened={OPENED_COURSE} exams={EXAMS} actions={actions} role="editor" />);
    const gif = new File(["gif"], "cover.gif", { type: "image/gif" });
    await user.upload(screen.getByLabelText("COVER IMAGE · 16:9"), gif);
    expect(screen.getByText("“cover.gif” isn’t a JPEG, PNG or WebP image.")).toBeInTheDocument();
    expect(actions.createCourseCoverUpload).not.toHaveBeenCalled();
  });

  describe("How members get it, for an Owner (Phase 5, ticket 06)", () => {
    const included = {
      ...OPENED_COURSE,
      course: { ...COURSE, access: "included" as const, priceCentavos: null, onSale: false },
      accessChange: { losing: 3, gaining: 214 },
    };

    it("asks before switching, saying how many Members lose it, then switches", async () => {
      const user = userEvent.setup();
      const saveCourseAccess = vi.fn(async () => saved({ ...included.course }));
      render(
        <CourseSettings
          opened={included}
          exams={EXAMS}
          actions={actionsWith({ saveCourseAccess })}
          role="owner"
        />,
      );

      await user.click(screen.getByRole("radio", { name: "Sold separately" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(
        "3 members who watched it through CE All-Access lose it now, and keep their progress.",
      );
      expect(saveCourseAccess).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole("button", { name: "Sell separately" }));

      expect(saveCourseAccess).toHaveBeenCalledWith(
        { status: "idle" },
        { input: { id: COURSE.id, access: "sold-separately" } },
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("says how many Access Pass holders gain a separately sold Course, and shows its price with a link to Plans & prices", async () => {
      const user = userEvent.setup();
      render(
        <CourseSettings
          opened={{ ...OPENED_COURSE, accessChange: { losing: 0, gaining: 214 } }}
          exams={EXAMS}
          actions={actionsWith()}
          role="owner"
        />,
      );

      expect(screen.getByRole("link", { name: "Set the price in Plans & prices" })).toHaveAttribute(
        "href",
        "/admin/plans",
      );
      await user.click(screen.getByRole("radio", { name: "Included in CE All-Access" }));
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "214 members with active CE All-Access gain it now. Everyone who owns it keeps it.",
      );
    });

    it("shows the server's refusal in the confirmation", async () => {
      const user = userEvent.setup();
      const saveCourseAccess = vi.fn(async () => ({
        status: "refused" as const,
        error: {
          kind: "forbidden" as const,
          message: "ONLY AN OWNER CAN CHANGE HOW MEMBERS GET A COURSE OR ITS PRICE",
        },
      }));
      render(
        <CourseSettings
          opened={included}
          exams={EXAMS}
          actions={actionsWith({ saveCourseAccess })}
          role="owner"
        />,
      );
      await user.click(screen.getByRole("radio", { name: "Sold separately" }));
      await user.click(screen.getByRole("button", { name: "Sell separately" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "ONLY AN OWNER CAN CHANGE HOW MEMBERS GET A COURSE OR ITS PRICE",
      );
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  it("explains why a Course someone owns can't be deleted, and suggests hiding it", () => {
    render(
      <CourseSettings
        opened={{ ...OPENED_COURSE, deleteBlocked: "owned" }}
        exams={EXAMS}
        actions={actionsWith()}
        role="owner"
      />,
    );

    expect(screen.getByRole("button", { name: "Delete course" })).toBeDisabled();
    expect(
      screen.getByText(/Members own this course, so it can’t be deleted\. Hide it instead/),
    ).toBeInTheDocument();
  });
});

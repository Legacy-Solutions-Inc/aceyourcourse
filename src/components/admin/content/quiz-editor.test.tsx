import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type {
  AdminQuestion,
  AdminQuiz,
  AdminQuizSettings,
  DeletedQuestion,
} from "@/services/admin.types";

import {
  ADD_A_QUESTION_FIRST,
  NOW_HIDDEN,
  QuizEditor,
  type QuizEditorActions,
} from "./quiz-editor";

// A Topic's quiz screen (Phase 3, tickets 09 and 10; stories 125–128), with
// stub Server Actions: the settings form's save, field errors and conflict,
// the Visible switch refused while the quiz is empty, the Free Preview
// switch, and the question editor: the questions in order with ▲▼ and
// Delete, and the question form. The server's rules are in
// admin.quiz.test.ts and admin.questions.test.ts.
const { refresh, replace, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

beforeEach(() => {
  refresh.mockClear();
  replace.mockClear();
  toast.mockClear();
});

const OPENED = "2026-11-18T01:00:00.000Z";

const SETTINGS: AdminQuizSettings = {
  id: "quiz-1",
  visibility: "hidden",
  freePreview: false,
  passingScore: 70,
  shuffle: true,
  showAnswers: true,
  stamp: { savedAt: OPENED, savedBy: null },
};

const TOPIC = "11111111-1111-4111-8111-111111111111";

const question = (position: number, text: string): AdminQuestion => ({
  id: `7777777${position}-7777-4777-8777-777777777777`,
  position,
  question: text,
  choices: { A: "1 m", B: "2 m", C: "3 m", D: "4 m" },
  correct: "B",
  explanation: "$L_s = 0.036 V^3/R$",
  figure: null,
  stamp: { savedAt: OPENED, savedBy: null },
});

const QUIZ: AdminQuiz = {
  exam: { code: "CE", name: "Civil Engineering" },
  subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
  topic: { id: TOPIC, name: "Spiral Curves", position: 2 },
  quiz: SETTINGS,
  questions: [question(1, "Length of spiral?")],
};

type Submission = { input: unknown; expected?: { savedAt: string } };

/** A stub Server Action that answers each call in turn. */
function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

function renderEditor(
  quiz: AdminQuiz = QUIZ,
  actions: Partial<QuizEditorActions> = {},
  selected: string | null = null,
) {
  const all: QuizEditorActions = {
    saveQuizSettings: answering<AdminQuizSettings>(),
    saveQuizVisibility: answering<AdminQuizSettings>(),
    saveQuizFreePreview: answering<AdminQuizSettings>(),
    createFigureUpload: answering(),
    addQuestion: answering<AdminQuestion>(),
    saveQuestion: answering<AdminQuestion>(),
    moveQuestionInQuiz: answering<string[]>(),
    removeQuestion: answering<DeletedQuestion>(),
    ...actions,
  };
  render(<QuizEditor quiz={quiz} selected={selected} actions={all} />);
  return all;
}

/** A question as the server keeps it once it's deleted: as it was. */
const deleted = (gone: AdminQuestion, quizHidden: boolean): DeletedQuestion => {
  const { stamp: _, ...rest } = gone;
  return { question: { ...rest, quizId: SETTINGS.id, removedAt: null }, quizHidden };
};

describe("QuizEditor", () => {
  it("saves the settings with the stamp the form opened with, and says so", async () => {
    const saved = { ...SETTINGS, passingScore: 85, shuffle: false };
    const actions = renderEditor(QUIZ, {
      saveQuizSettings: answering<AdminQuizSettings>({
        status: "saved",
        value: { ...saved, stamp: { savedAt: "2026-11-18T02:00:00.000Z", savedBy: "Kim" } },
      }),
    });
    const user = userEvent.setup();

    const score = screen.getByLabelText(/PASSING SCORE/);
    await user.clear(score);
    await user.type(score, "85");
    await user.click(screen.getByRole("switch", { name: "Shuffle questions" }));
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await screen.findByText("✓ SAVED · MEMBERS’ NEXT ATTEMPT USES THESE");
    expect(actions.saveQuizSettings).toHaveBeenCalledWith(expect.anything(), {
      input: { id: "quiz-1", passingScore: "85", shuffle: false, showAnswers: true },
      expected: { savedAt: OPENED },
    });
  });

  it("shows the server's message on the passing score it refused", async () => {
    renderEditor(QUIZ, {
      saveQuizSettings: answering<AdminQuizSettings>({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { passingScore: ["ENTER A WHOLE NUMBER FROM 1 TO 100"] },
        },
      }),
    });
    const user = userEvent.setup();

    const score = screen.getByLabelText(/PASSING SCORE/);
    await user.clear(score);
    await user.type(score, "101");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("ENTER A WHOLE NUMBER FROM 1 TO 100")).toBeInTheDocument();
    expect(score).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("FIX THE FIELDS MARKED IN RED")).toBeInTheDocument();
  });

  it("names the newer save when the settings changed since the form opened", async () => {
    renderEditor(QUIZ, {
      saveQuizSettings: answering<AdminQuizSettings>({
        status: "refused",
        error: { kind: "conflict", savedBy: "Kim", savedAt: "2026-11-18T02:00:00.000Z" },
      }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("switch", { name: "Show answers after" }));
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText(/^Kim saved this quiz’s settings at/)).toBeInTheDocument();
  });

  it("won't make a quiz with no questions Visible, and says why", () => {
    renderEditor({ ...QUIZ, questions: [] });

    const visible = screen.getByRole("switch", { name: "Visible to members" });
    expect(visible).toBeDisabled();
    expect(visible).toHaveAccessibleDescription(ADD_A_QUESTION_FIRST);
  });

  it("makes a quiz with questions Visible, and flags it Free Preview", async () => {
    const actions = renderEditor(QUIZ, {
      saveQuizVisibility: answering<AdminQuizSettings>({
        status: "saved",
        value: { ...SETTINGS, visibility: "visible" },
      }),
      saveQuizFreePreview: answering<AdminQuizSettings>({
        status: "saved",
        value: { ...SETTINGS, freePreview: true },
      }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("switch", { name: "Visible to members" }));
    await waitFor(() =>
      expect(actions.saveQuizVisibility).toHaveBeenCalledWith(expect.anything(), {
        input: { quiz: "quiz-1", visible: true },
      }),
    );
    await user.click(screen.getByRole("switch", { name: "Free Preview" }));
    await waitFor(() =>
      expect(actions.saveQuizFreePreview).toHaveBeenCalledWith(expect.anything(), {
        input: { quiz: "quiz-1", freePreview: true },
      }),
    );
  });

  it("toasts why the server refused a switch", async () => {
    renderEditor(QUIZ, {
      saveQuizVisibility: answering<AdminQuizSettings>({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "ADD A QUESTION FIRST" },
      }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("switch", { name: "Visible to members" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("ADD A QUESTION FIRST"));
  });
});

describe("QuizEditor's questions", () => {
  const FIRST = question(1, "Length of spiral $L_s$?");
  const SECOND = question(2, "Spiral angle?");
  const TWO: AdminQuiz = { ...QUIZ, questions: [FIRST, SECOND] };

  it("lists the questions in order, maths rendered, each with Edit, ▲▼ and Delete", () => {
    renderEditor(TWO);

    const rows = within(screen.getByRole("list", { name: "Questions in Spiral Curves" }));
    expect(rows.getAllByRole("listitem")).toHaveLength(2);
    const edit = rows.getByRole("link", { name: "Edit question 1: Length of spiral $L_s$?" });
    expect(edit).toHaveAttribute("href", `/admin/content/quiz?topic=${TOPIC}&question=${FIRST.id}`);
    expect(edit.querySelector(".katex")).not.toBeNull();
    expect(rows.getByRole("button", { name: "Move up: question 1" })).toBeDisabled();
    expect(rows.getByRole("button", { name: "Move down: question 2" })).toBeDisabled();
    expect(rows.getByRole("button", { name: "Delete question 2" })).toBeEnabled();
    expect(screen.getByRole("form", { name: "New question" })).toBeInTheDocument();
  });

  it("opens the selected question in the form, marked in the list", () => {
    renderEditor(TWO, {}, SECOND.id ?? null);

    expect(screen.getByRole("form", { name: "Question 2" })).toBeInTheDocument();
    expect(screen.getByLabelText("QUESTION")).toHaveValue("Spiral angle?");
    const current = screen
      .getByRole("link", { name: "Edit question 2: Spiral angle?" })
      .closest("li");
    expect(current).toHaveAttribute("aria-current", "true");
  });

  it("moves a question with ▲▼, then reads the quiz again", async () => {
    const actions = renderEditor(TWO, {
      moveQuestionInQuiz: answering<string[]>({
        status: "saved",
        value: [SECOND.id, FIRST.id],
      }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Move up: question 2" }));

    await waitFor(() =>
      expect(actions.moveQuestionInQuiz).toHaveBeenCalledWith(expect.anything(), {
        input: { id: SECOND.id, direction: "up" },
      }),
    );
  });

  it("deletes a question after saying Members keep their attempts and Best Scores", async () => {
    const actions = renderEditor(TWO, {
      removeQuestion: answering<DeletedQuestion>({
        status: "saved",
        value: deleted(FIRST, false),
      }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "It leaves the quiz for new attempts. Members’ past attempts keep it, marked as removed, and their Best Scores stay as they are.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete question" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(actions.removeQuestion).toHaveBeenCalledWith(expect.anything(), {
      input: { id: FIRST.id },
    });
    expect(toast).toHaveBeenCalledWith("✓ DELETED · QUESTION 1");
    expect(screen.queryByText(NOW_HIDDEN)).toBeNull();
  });

  it("says the quiz is now Hidden when its last question goes, and opens a new question's form", async () => {
    const only = question(1, "Only question?");
    renderEditor(
      { ...QUIZ, quiz: { ...SETTINGS, visibility: "visible" }, questions: [only] },
      {
        removeQuestion: answering<DeletedQuestion>({
          status: "saved",
          value: deleted(only, true),
        }),
      },
      only.id,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete question 1" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete question" }),
    );

    expect(await screen.findByText(NOW_HIDDEN)).toBeInTheDocument();
    expect(NOW_HIDDEN).toBe("The quiz is now Hidden because it has no questions.");
    expect(toast).toHaveBeenCalledWith(NOW_HIDDEN);
    expect(replace).toHaveBeenCalledWith(`/admin/content/quiz?topic=${TOPIC}&question=new`);
  });

  it("opens the saved question after “Save” on a new one", async () => {
    const added = question(2, "Spiral angle?");
    renderEditor(QUIZ, {
      addQuestion: answering<AdminQuestion>({ status: "saved", value: added }),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("QUESTION"), "Spiral angle?");
    for (const choice of ["A", "B", "C", "D"]) {
      await user.type(screen.getByLabelText(new RegExp(`^CHOICE ${choice}`)), choice);
    }
    await user.click(screen.getByRole("radio", { name: "B" }));
    await user.type(screen.getByLabelText(/^EXPLANATION/), "Because.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/admin/content/quiz?topic=${TOPIC}&question=${added.id}`,
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("lets a Topic with no quiz write its first question, or import them", () => {
    renderEditor({ ...QUIZ, quiz: null, questions: [] });

    expect(screen.getByText(/Write its first question below/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "import MSTC’s questions from a spreadsheet" }),
    ).toHaveAttribute("href", "/admin/content/import?exam=ce&subject=mstc&kind=quizzes");
    expect(screen.getByRole("form", { name: "New question" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Visible to members" })).toBeNull();
  });
});

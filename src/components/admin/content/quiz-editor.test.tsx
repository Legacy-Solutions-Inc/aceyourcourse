import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminQuiz, AdminQuizSettings } from "@/services/admin.types";

import { ADD_A_QUESTION_FIRST, QuizEditor, type QuizEditorActions } from "./quiz-editor";

// A Topic's quiz screen (Phase 3, ticket 09; stories 126–128), with stub
// Server Actions: the settings form's save, field errors and conflict, the
// Visible switch refused while the quiz is empty, and the Free Preview
// switch. The server's rules are in admin.quiz.test.ts.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

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

const QUIZ: AdminQuiz = {
  exam: { code: "CE", name: "Civil Engineering" },
  subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
  topic: { id: "topic-1", name: "Spiral Curves", position: 2 },
  quiz: SETTINGS,
  questions: [
    {
      id: "q-1",
      position: 1,
      question: "Length of spiral?",
      choices: { A: "1 m", B: "2 m", C: "3 m", D: "4 m" },
      correct: "B",
      explanation: "$L_s = 0.036 V^3/R$",
      figure: null,
    },
  ],
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

function renderEditor(quiz: AdminQuiz = QUIZ, actions: Partial<QuizEditorActions> = {}) {
  const all: QuizEditorActions = {
    saveQuizSettings: answering<AdminQuizSettings>(),
    saveQuizVisibility: answering<AdminQuizSettings>(),
    saveQuizFreePreview: answering<AdminQuizSettings>(),
    ...actions,
  };
  render(<QuizEditor quiz={quiz} actions={all} />);
  return all;
}

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

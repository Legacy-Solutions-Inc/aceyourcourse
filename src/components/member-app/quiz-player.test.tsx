import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuizActionState } from "@/app/app/(shell)/library/actions";
import type { AttemptReview } from "@/lib/quizzes/grading";
import { paths } from "@/paths";
import type { AttemptSummary, QuizQuestion, StudyQuiz } from "@/services/member.types";

import { QuizPlayer, type QuizPlayerProps } from "./quiz-player";

// The quiz screen (stories 98–100, 106 and 133k; mockups `quizStart`, `quiz`
// and `score`): the start screen with the Member's Best Score and past
// attempts, one question at a time with Back and Next, unanswered questions
// flagged before Submit, the questions shuffled afresh for each attempt, and
// the score screen with its review, with "show answers after" on and off.
// Submit is the boundary, so it's replaced: the server marks the answers.
const { refresh, toast } = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: Object.assign(toast, { error: toast }) }));

const QUIZ = "44444444-4444-4444-8444-444444444444";
const id = (n: number) => `5555555${n}-5555-4555-8555-555555555555`;
const ATTEMPT_IDS = [
  "66666661-6666-4666-8666-666666666666",
  "66666662-6666-4666-8666-666666666666",
];

const question = (n: number, text: string, extra: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: id(n),
  question: text,
  choices: { A: `${text} A`, B: `${text} B`, C: `${text} C`, D: `${text} D` },
  figureUrl: null,
  ...extra,
});
const QUESTIONS = [
  question(1, "Degree of curve?", { figureUrl: "/api/dev/card-images/f1" }),
  question(2, "Tangent distance?"),
  question(3, "Long chord?"),
];

const attempt = (n: number, submittedAt: string, score: number): AttemptSummary => ({
  id: `7777777${n}-7777-4777-8777-777777777777`,
  submittedAt,
  correctCount: Math.round((score / 100) * 10),
  questionCount: 10,
  score,
  passingScore: 70,
  passed: score >= 70,
});
const EARLIER = attempt(1, "2026-11-15T02:00:00.000Z", 60);
const LATER = attempt(2, "2026-11-16T02:00:00.000Z", 80);

const quizOf = (overrides: Partial<StudyQuiz> = {}): StudyQuiz => ({
  passingScore: 70,
  shuffle: false,
  showAnswers: true,
  questions: QUESTIONS,
  imagesExpireAt: null,
  bestScore: null,
  attempts: [],
  ...overrides,
});

const REVIEW_WITH_ANSWERS: AttemptReview = {
  showAnswers: true,
  questions: [
    {
      status: "answered",
      number: 1,
      id: id(1),
      question: "Degree of curve?",
      choices: QUESTIONS[0]?.choices ?? { A: "", B: "", C: "", D: "" },
      figureUrl: null,
      chosen: "A",
      isCorrect: true,
      answer: "A",
      explanation: "Arc basis.",
      correctedSince: false,
    },
    {
      status: "answered",
      number: 2,
      id: id(2),
      question: "Tangent distance?",
      choices: QUESTIONS[1]?.choices ?? { A: "", B: "", C: "", D: "" },
      figureUrl: null,
      chosen: "B",
      isCorrect: false,
      answer: "C",
      explanation: "T equals R times the tangent of half the angle.",
      correctedSince: false,
    },
    { status: "removed", number: 3, id: id(3), isCorrect: false },
  ],
};

const REVIEW_WITHOUT_ANSWERS: AttemptReview = {
  showAnswers: false,
  questions: REVIEW_WITH_ANSWERS.questions.map((item) => {
    if (item.status === "removed") return item;
    const {
      answer: _answer,
      explanation: _explanation,
      correctedSince: _corrected,
      ...shown
    } = item as Extract<(typeof REVIEW_WITH_ANSWERS.questions)[number], { answer: unknown }>;
    return shown;
  }),
};

function scoredState(
  overrides: { score?: number; bestScore?: number; review?: AttemptReview } = {},
): QuizActionState {
  const score = overrides.score ?? 33;
  return {
    status: "scored",
    scored: {
      attempt: {
        id: ATTEMPT_IDS[0] ?? "",
        submittedAt: "2026-11-17T03:42:00.000Z",
        correctCount: Math.round((score * 3) / 100),
        questionCount: 3,
        score,
        passingScore: 70,
        passed: score >= 70,
      },
      bestScore: overrides.bestScore ?? 80,
      review: overrides.review ?? REVIEW_WITH_ANSWERS,
    },
  };
}

let user: UserEvent;

function renderPlayer(overrides: Partial<QuizPlayerProps> = {}) {
  const actions = {
    submitQuiz: vi.fn(async (_input: unknown): Promise<QuizActionState> => scoredState()),
  };
  const props: QuizPlayerProps = {
    quizId: QUIZ,
    title: "Simple Curves",
    crumb: "MSTC · PRACTICE QUIZ",
    quiz: quizOf(),
    watermark: "tester@example.com · 3F1A5C2E",
    examCode: "CE",
    contactEmail: "help@example.com",
    back: { href: "/app/library?subject=MSTC", label: "Back to MSTC topics" },
    actions,
    ...overrides,
  };
  const view = render(<QuizPlayer {...props} />);
  return { ...view, actions, props };
}

const start = () => user.click(screen.getByRole("button", { name: "Start quiz" }));
const next = () => user.click(screen.getByRole("button", { name: "Next question" }));
const previous = () => user.click(screen.getByRole("button", { name: "Previous question" }));
const finish = () => user.click(screen.getByRole("button", { name: "Finish quiz" }));
const choice = (letter: string) => screen.getByRole("radio", { name: new RegExp(`^${letter}\\b`) });
const shownQuestion = () => screen.getByRole("radiogroup", { name: /^Question \d+: / });

beforeEach(() => {
  refresh.mockClear();
  toast.mockClear();
  user = userEvent.setup();
  let made = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () =>
      (ATTEMPT_IDS[made++] ??
        ATTEMPT_IDS[1]) as `${string}-${string}-${string}-${string}-${string}`,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the start screen", () => {
  it("gives the question count, the passing score, the Best Score and the past attempts", () => {
    renderPlayer({ quiz: quizOf({ bestScore: 80, attempts: [LATER, EARLIER] }) });

    expect(screen.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeInTheDocument();
    expect(screen.getByText("MSTC · PRACTICE QUIZ")).toBeInTheDocument();
    const facts = screen.getByRole("list", { name: "About this quiz" });
    expect(
      within(facts)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["QUESTIONS3", "PASSING SCORE70%", "YOUR BEST80%"]);
    expect(
      screen.getByText("One question at a time. You can go back before you submit."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No time limit. Your best score counts toward your progress."),
    ).toBeInTheDocument();

    const attempts = screen.getByRole("list", { name: "Your attempts" });
    expect(
      within(attempts)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "16 Nov 2026, 10:00 am · 80% · PASSEDReview",
      "15 Nov 2026, 10:00 am · 60% · NOT PASSEDReview",
    ]);
    expect(
      within(attempts).getByRole("link", { name: "Review your attempt of 16 Nov 2026, 10:00 am" }),
    ).toHaveAttribute("href", paths.memberApp.quizAttempt(QUIZ, LATER.id));
  });

  it("shows no Best Score before the first attempt", () => {
    renderPlayer();
    const facts = screen.getByRole("list", { name: "About this quiz" });
    expect(within(facts).getByText("YOUR BEST").nextSibling).toHaveTextContent("—");
    expect(screen.queryByRole("list", { name: "Your attempts" })).not.toBeInTheDocument();
  });

  it("says when the questions come in a new order each time", () => {
    renderPlayer({ quiz: quizOf({ shuffle: true }) });
    expect(screen.getByText("The questions come in a new order each time.")).toBeInTheDocument();
  });
});

describe("taking the quiz", () => {
  it("goes one question at a time with Back and Next, keeping answers the Member can change", async () => {
    const { actions } = renderPlayer();
    await start();

    expect(screen.getByText("QUESTION 1 / 3")).toBeInTheDocument();
    expect(shownQuestion()).toHaveAccessibleName(/Degree of curve\?/);
    expect(screen.getByRole("button", { name: "Previous question" })).toBeDisabled();
    await user.click(choice("A"));
    await next();

    expect(screen.getByText("QUESTION 2 / 3")).toBeInTheDocument();
    expect(shownQuestion()).toHaveAccessibleName(/Tangent distance\?/);
    expect(choice("A")).not.toBeChecked();
    await previous();

    expect(shownQuestion()).toHaveAccessibleName(/Degree of curve\?/);
    expect(choice("A")).toBeChecked();
    await user.click(choice("C"));
    expect(choice("C")).toBeChecked();
    expect(choice("A")).not.toBeChecked();
    expect(actions.submitQuiz).not.toHaveBeenCalled();
  });

  it("shows a question's figure with it", async () => {
    renderPlayer();
    await start();
    expect(screen.getByRole("img", { name: "Figure for question 1" })).toHaveAttribute(
      "src",
      "/api/dev/card-images/f1",
    );
  });

  it("tiles the Member's watermark over each question, which can't be selected", async () => {
    const { container } = renderPlayer();
    await start();
    const watermark = container.querySelector("[data-watermark]");
    expect(watermark).toHaveStyle({
      backgroundImage: expect.stringContaining("data:image/svg+xml"),
    });
    expect(screen.getByRole("region", { name: "Simple Curves quiz" })).toHaveClass("select-none");
  });

  it("flags the questions left unanswered before submitting, and goes to one", async () => {
    const { actions } = renderPlayer();
    await start();
    await user.click(choice("A"));
    await next();
    await next();
    await user.click(choice("C"));
    await finish();

    const flagged = screen.getByRole("region", { name: "Unanswered questions" });
    expect(flagged).toHaveTextContent(
      "1 QUESTION UNANSWERED · UNANSWERED QUESTIONS COUNT AS WRONG",
    );
    expect(actions.submitQuiz).not.toHaveBeenCalled();
    await user.click(within(flagged).getByRole("button", { name: "Go to question 2" }));

    expect(screen.getByText("QUESTION 2 / 3")).toBeInTheDocument();
    await user.click(choice("B"));
    await next();
    await finish();
    expect(actions.submitQuiz).toHaveBeenCalledTimes(1);
  });

  it("submits anyway with every question in the order shown, unanswered ones as null, and the attempt's own id", async () => {
    const { actions } = renderPlayer();
    await start();
    await user.click(choice("B"));
    await next();
    await next();
    await finish();
    await user.click(screen.getByRole("button", { name: "Submit anyway" }));

    expect(actions.submitQuiz).toHaveBeenCalledWith({
      attemptId: ATTEMPT_IDS[0],
      quizId: QUIZ,
      answers: [
        { questionId: id(1), choice: "B" },
        { questionId: id(2), choice: null },
        { questionId: id(3), choice: null },
      ],
    });
  });

  it("shows the questions in a new order for each attempt when the quiz shuffles", async () => {
    // Every number 0 turns 1 2 3 into 2 3 1; 0.99 leaves it as it is.
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const { actions } = renderPlayer({ quiz: quizOf({ shuffle: true }) });
    await start();
    expect(shownQuestion()).toHaveAccessibleName(/Tangent distance\?/);
    await next();
    await next();
    await finish();
    await user.click(screen.getByRole("button", { name: "Submit anyway" }));
    expect(
      actions.submitQuiz.mock.calls[0]?.[0] as { answers: { questionId: string }[] },
    ).toMatchObject({
      answers: [{ questionId: id(2) }, { questionId: id(3) }, { questionId: id(1) }],
    });

    random.mockReturnValue(0.99);
    await user.click(await screen.findByRole("button", { name: "Retake quiz" }));
    await start();
    expect(shownQuestion()).toHaveAccessibleName(/Degree of curve\?/);
    expect(screen.getByText("QUESTION 1 / 3")).toBeInTheDocument();
  });

  it("keeps the attempt going when the page reads the quiz again for fresh figure URLs", async () => {
    const { rerender, props } = renderPlayer();
    await start();
    await user.click(choice("D"));

    const fresh = QUESTIONS.map((q) => (q.figureUrl ? { ...q, figureUrl: "/fresh/f1" } : q));
    rerender(<QuizPlayer {...props} quiz={quizOf({ questions: fresh })} />);

    expect(screen.getByText("QUESTION 1 / 3")).toBeInTheDocument();
    expect(choice("D")).toBeChecked();
    expect(screen.getByRole("img", { name: "Figure for question 1" })).toHaveAttribute(
      "src",
      "/fresh/f1",
    );
  });
});

describe("submitting", () => {
  async function answerAllAndFinish() {
    await start();
    for (const letter of ["A", "B", "C"]) {
      await user.click(choice(letter));
      if (letter !== "C") await next();
    }
    await finish();
  }

  it("shows the score, pass or fail, the Best Score and each missed question with the answer and explanation", async () => {
    renderPlayer({ quiz: quizOf({ bestScore: 80, attempts: [LATER, EARLIER] }) });
    await answerAllAndFinish();

    const score = screen.getByRole("region", { name: /^1 \/ 3/ });
    expect(within(score).getByText("QUIZ COMPLETE · SIMPLE CURVES")).toBeInTheDocument();
    expect(within(score).getByText("33% · BEST IS 80%")).toBeInTheDocument();
    expect(within(score).getByText("NOT PASSED · PASSING SCORE 70%")).toBeInTheDocument();
    expect(within(score).getByText("Previous attempts: 80% · 60%")).toBeInTheDocument();

    const missed = screen.getByRole("list", { name: "Missed questions" });
    const items = within(missed).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Q2 · INCORRECT");
    expect(items[0]).toHaveTextContent("Tangent distance?");
    expect(items[0]).toHaveTextContent("Your answer: B · Tangent distance? B");
    expect(items[0]).toHaveTextContent("Correct: C · Tangent distance? C");
    expect(items[0]).toHaveTextContent("T equals R times the tangent of half the angle.");
    expect(items[1]).toHaveTextContent("Q3 · This question has since been removed");

    const all = screen.getByRole("list", { name: "All answers" });
    expect(
      within(all)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Q1✓ RIGHTDegree of curve?",
      "Q2✗ WRONGTangent distance?",
      "Q3This question has since been removed",
    ]);
  });

  it("says when the score is the best so far, and passed", async () => {
    const { actions } = renderPlayer();
    actions.submitQuiz.mockResolvedValue(scoredState({ score: 100, bestScore: 100 }));
    await answerAllAndFinish();

    expect(screen.getByText("100% · BEST SO FAR")).toBeInTheDocument();
    expect(screen.getByText("✓ PASSED · PASSING SCORE 70%")).toBeInTheDocument();
  });

  it("with “show answers after” off, says which were missed and never a correct answer", async () => {
    const { actions } = renderPlayer({ quiz: quizOf({ showAnswers: false }) });
    actions.submitQuiz.mockResolvedValue(scoredState({ review: REVIEW_WITHOUT_ANSWERS }));
    await answerAllAndFinish();

    const missed = screen.getByRole("list", { name: "Missed questions" });
    expect(missed).toHaveTextContent("Your answer: B · Tangent distance? B");
    expect(screen.queryByText(/^Correct:/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This quiz doesn’t show the correct answers. Review the Topic and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("goes back to the start for a retake, reading the quiz again", async () => {
    renderPlayer();
    await answerAllAndFinish();
    await user.click(screen.getByRole("button", { name: "Retake quiz" }));

    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to MSTC topics" })).toHaveAttribute(
      "href",
      "/app/library?subject=MSTC",
    );
  });

  it("shows why a refused submit wasn't saved, in place of the quiz", async () => {
    const { actions } = renderPlayer();
    actions.submitQuiz.mockResolvedValue({ status: "refused", decision: { outcome: "locked" } });
    await answerAllAndFinish();

    expect(screen.getByRole("heading", { name: "Unlock with CE All-Access" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("says the quiz changed when the answers no longer match it, and starts again", async () => {
    const { actions } = renderPlayer();
    actions.submitQuiz.mockResolvedValue({ status: "mismatch" });
    await answerAllAndFinish();

    expect(
      screen.getByText(
        "This quiz changed while you were taking it. Start again to see it as it is now.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeInTheDocument();
  });

  it("says the quiz is gone when Submit finds no quiz, with the way back", async () => {
    const { actions } = renderPlayer();
    actions.submitQuiz.mockResolvedValue({ status: "not-found" });
    await answerAllAndFinish();

    expect(
      screen.getByText("This quiz isn’t here any more. Your attempt wasn’t saved."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/This quiz changed/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to MSTC topics" })).toBeInTheDocument();
  });

  it("keeps the answers when the connection drops, and sends the same attempt again", async () => {
    const { actions } = renderPlayer();
    actions.submitQuiz.mockRejectedValueOnce(new Error("offline"));
    await answerAllAndFinish();

    expect(toast).toHaveBeenCalledWith(
      "Couldn’t submit your answers. Check your connection and try again.",
    );
    expect(choice("C")).toBeChecked();
    await finish();

    expect(actions.submitQuiz).toHaveBeenCalledTimes(2);
    const [first, second] = actions.submitQuiz.mock.calls.map(
      ([input]) => (input as { attemptId: string }).attemptId,
    );
    expect(second).toBe(first);
    expect(await screen.findByText("QUIZ COMPLETE · SIMPLE CURVES")).toBeInTheDocument();
  });
});

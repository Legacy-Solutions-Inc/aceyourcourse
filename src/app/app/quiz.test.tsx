import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { AdminQuestion } from "@/services/admin.types";
import {
  addBetaTester,
  createQuestion,
  deleteQuestion,
  setQuizFreePreview,
  updateQuizSettings,
} from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  listStudyDays,
  recordConsent,
} from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";
import { submitQuizAttempt } from "./(shell)/library/actions";

// Taking a quiz in the Member App (Phase 3, ticket 11; stories 98–100, 106,
// 133k and 133l), on sample data: the quiz page as a browser loads it, a past
// attempt's page, and Submit as a browser posts it. The quiz screen itself is
// in quiz-player.test.tsx; the seam's rules in member.quiz.test.ts. It's 17
// Nov 2026, 11:42 in Manila. The sample quizzes: CE MSTC Simple Curves' is
// Visible, Spiral Curves' Hidden, CE HPGE Hydrostatics' Visible and Free
// Preview, all with no questions until an Editor writes them. The tester's
// CE pass ends in 90 days, the lapsed tester's ended 3 days ago, and the
// stranger has none.
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
  usePathname: () => "/app/library/quiz",
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const TESTER = "tester@example.com";

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const HYDROSTATICS = sampleTopicId("CE", "HPGE", "Hydrostatics");
const PASS_QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const HIDDEN_QUIZ = sampleContentId(sampleTopicId("CE", "MSTC", "Spiral Curves"), "quiz");
const FREE_QUIZ = sampleContentId(HYDROSTATICS, "quiz");
const ATTEMPT = "6a1f0e1c-5b55-4a51-9d0e-0a1b2c3d4e5f";
const quizPage = (id: string) => `/app/library/quiz/${id}`;

const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** Signed in as this sample User, a Member who has agreed, with CE selected, on this browser. */
async function memberOnDevice(email: string, name: string) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
  await onThisDevice(userId);
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}
const asTester = () => memberOnDevice(TESTER, "Bea Tester");
const asLapsed = () => memberOnDevice("lapsed@example.com", "Lou Lapsed");
async function asNewTester() {
  await addBetaTester(OWNER, { email: "stranger@example.com" });
  return memberOnDevice("stranger@example.com", "Sam Stranger");
}

/** An Editor writes questions in a Topic's quiz, in order, each with its correct choice. */
async function writeQuestions(
  topicId: string,
  ...questions: [text: string, correct: QuizChoice][]
): Promise<AdminQuestion[]> {
  const written: AdminQuestion[] = [];
  for (const [text, correct] of questions) {
    const added = await createQuestion(EDITOR, {
      topic: topicId,
      question: text,
      choices: { A: `${text} A`, B: `${text} B`, C: `${text} C`, D: `${text} D` },
      correct,
      explanation: `Worked solution for ${text}`,
      figure: null,
    });
    if (!added.ok) throw new Error("Not added");
    written.push(added.value);
  }
  return written;
}

const opening = async (id: string, attempt?: string) =>
  (await import("./(shell)/library/[kind]/[id]/page")).default({
    params: Promise.resolve({ kind: "quiz", id }),
    searchParams: Promise.resolve(attempt === undefined ? {} : { attempt }),
  });

/** Submit, as the quiz screen posts it, with an answer per question in the order given. */
const submitting = (
  quizId: string,
  answers: [AdminQuestion | undefined, QuizChoice | null][],
  attemptId = ATTEMPT,
) =>
  submitQuizAttempt({
    attemptId,
    quizId,
    answers: answers.map(([question, choice]) => ({ questionId: question?.id, choice })),
  });

const savedAttempts = () => getSampleStore().quizAttempts;

/**
 * Everything in a page's element tree but the components themselves: the
 * props a browser could be sent, and the text rendered on the server.
 */
const payloadOf = (page: unknown) =>
  JSON.stringify(page, (key, value: unknown) => (key === "type" ? undefined : value));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the quiz page", () => {
  it("opens a quiz the tester's pass allows on its start screen, as a focus screen", async () => {
    await asTester();
    await writeQuestions(SIMPLE_CURVES, ["Degree of curve?", "A"], ["Tangent distance?", "C"]);
    render(await opening(PASS_QUIZ));

    expect(screen.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeInTheDocument();
    expect(screen.getByText("MSTC · PRACTICE QUIZ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeEnabled();
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("MSTC · QUIZ"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Back" })).getByRole("link", {
        name: "Back to MSTC topics",
      }),
    ).toHaveAttribute("href", "/app/library?subject=MSTC");
  });

  it("never puts a correct choice or an explanation in what the browser gets", async () => {
    await asTester();
    await writeQuestions(SIMPLE_CURVES, ["Degree of curve?", "A"]);
    const page = await opening(PASS_QUIZ);
    render(page);

    expect(payloadOf(page)).not.toMatch(/Worked solution|"correct"|"explanation"/);
    expect(document.body.innerHTML).not.toContain("Worked solution");
  });

  it("opens a Free Preview quiz for a new tester with no pass", async () => {
    await asNewTester();
    await writeQuestions(HYDROSTATICS, ["Pressure at depth?", "B"]);
    render(await opening(FREE_QUIZ));
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeInTheDocument();
  });

  it("says a quiz with no questions yet is still being prepared", async () => {
    await asNewTester();
    render(await opening(FREE_QUIZ));

    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "This quiz is still being prepared. Its questions will show up here automatically.",
      ),
    ).toBeInTheDocument();
  });

  it("never sends a locked quiz's questions to the browser, showing the unlock prompt", async () => {
    await asNewTester();
    await writeQuestions(SIMPLE_CURVES, ["A secret question", "A"]);
    const page = await opening(PASS_QUIZ);
    render(page);

    expect(
      screen.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeInTheDocument();
    expect(payloadOf(page)).not.toContain("A secret question");
  });

  it("tells the lapsed tester their pass ended, with their progress in CE kept and Renew access", async () => {
    await asLapsed();
    const [question] = await writeQuestions(HYDROSTATICS, ["Pressure at depth?", "B"]);
    await submitting(FREE_QUIZ, [[question, "B"]]);
    await setQuizFreePreview(EDITOR, FREE_QUIZ, false);
    render(await opening(FREE_QUIZ));

    expect(
      screen.getByRole("heading", { level: 2, name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Renew to keep reviewing\. Your progress is kept: 1 quiz taken\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
  });

  it("says a Hidden quiz is no longer available", async () => {
    await asTester();
    render(await opening(HIDDEN_QUIZ));
    expect(
      screen.getByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeInTheDocument();
  });

  it("lists the Member's attempts with their Best Score", async () => {
    await asTester();
    const [first, second] = await writeQuestions(SIMPLE_CURVES, ["First", "A"], ["Second", "B"]);
    await submitting(PASS_QUIZ, [
      [first, "A"],
      [second, "B"],
    ]);
    vi.setSystemTime(new Date(BOOT.getTime() + 60 * 60 * 1000));
    await submitting(
      PASS_QUIZ,
      [
        [first, "A"],
        [second, "A"],
      ],
      "6a1f0e1c-5b55-4a51-9d0e-0a1b2c3d4e60",
    );
    render(await opening(PASS_QUIZ));

    const facts = screen.getByRole("list", { name: "About this quiz" });
    expect(within(facts).getByText("YOUR BEST").nextSibling).toHaveTextContent("100%");
    expect(
      within(screen.getByRole("list", { name: "Your attempts" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "17 Nov 2026, 12:42 pm · 50% · NOT PASSEDReview",
      "17 Nov 2026, 11:42 am · 100% · PASSEDReview",
    ]);
  });

  it("answers 404 for a quiz that isn't there", async () => {
    await asTester();
    await expect(opening("3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a replaced device to the Active Device screen, coming back to the quiz", async () => {
    await asTester();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    await expect(opening(PASS_QUIZ)).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(quizPage(PASS_QUIZ))}`),
    );
  });
});

describe("a past attempt's page", () => {
  it("reviews the attempt: its score, the Best Score, and each missed question with the answer", async () => {
    await asTester();
    const [first, second] = await writeQuestions(SIMPLE_CURVES, ["First", "A"], ["Second", "B"]);
    await submitting(PASS_QUIZ, [
      [first, "A"],
      [second, "D"],
    ]);
    render(await opening(PASS_QUIZ, ATTEMPT));

    expect(
      screen.getByRole("heading", { level: 1, name: "Your attempt of 17 Nov 2026, 11:42 am" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50% · BEST SO FAR")).toBeInTheDocument();
    expect(screen.getByText("NOT PASSED · PASSING SCORE 70%")).toBeInTheDocument();
    const missed = screen.getByRole("list", { name: "Missed questions" });
    expect(missed).toHaveTextContent("Your answer: D · Second D");
    expect(missed).toHaveTextContent("Correct: B · Second B");
    expect(missed).toHaveTextContent("Worked solution for Second");
    expect(screen.getByRole("link", { name: "Back to the quiz" })).toHaveAttribute(
      "href",
      quizPage(PASS_QUIZ),
    );
  });

  it("shows a question removed since as removed, keeping the attempt's score", async () => {
    await asTester();
    const [kept, removed] = await writeQuestions(SIMPLE_CURVES, ["Kept", "A"], ["Gone", "B"]);
    await submitting(PASS_QUIZ, [
      [kept, "A"],
      [removed, "C"],
    ]);
    await deleteQuestion(EDITOR, removed?.id ?? "");
    const page = await opening(PASS_QUIZ, ATTEMPT);
    render(page);

    expect(screen.getByText("50% · BEST SO FAR")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "All answers" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Q1✓ RIGHTKept", "Q2This question has since been removed"]);
    expect(payloadOf(page)).not.toContain("Gone");
    expect(document.body.innerHTML).not.toContain("Gone");
  });

  it("gives no correct answer or explanation when the quiz doesn't show answers after", async () => {
    await asTester();
    const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
    await submitting(PASS_QUIZ, [[question, "B"]]);
    await updateQuizSettings(EDITOR, {
      id: PASS_QUIZ,
      passingScore: 70,
      shuffle: true,
      showAnswers: false,
    });
    const page = await opening(PASS_QUIZ, ATTEMPT);
    render(page);

    expect(screen.getByRole("list", { name: "Missed questions" })).toHaveTextContent(
      "Your answer: B · Only B",
    );
    expect(payloadOf(page)).not.toMatch(/Worked solution|"answer"|"explanation"/);
    expect(document.body.innerHTML).not.toContain("Worked solution");
  });

  it.each([
    ["an attempt that isn't there", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b"],
    ["an id that isn't one", "attempt-1"],
    ["an overlong address", "a".repeat(500)],
  ])("answers 404 for %s", async (_case, attempt) => {
    await asTester();
    await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
    await expect(opening(PASS_QUIZ, attempt)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 for another Member's attempt", async () => {
    await asTester();
    const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
    await submitting(FREE_QUIZ, [[question, "A"]]);
    await asNewTester();

    await expect(opening(FREE_QUIZ, ATTEMPT)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the unlock prompt, not the attempt, once the quiz is locked to the Member", async () => {
    await asLapsed();
    const [question] = await writeQuestions(HYDROSTATICS, ["A secret question", "A"]);
    await submitting(FREE_QUIZ, [[question, "A"]]);
    await setQuizFreePreview(EDITOR, FREE_QUIZ, false);
    const page = await opening(FREE_QUIZ, ATTEMPT);
    render(page);

    expect(screen.getByRole("heading", { level: 2, name: /ended on/ })).toBeInTheDocument();
    expect(payloadOf(page)).not.toContain("A secret question");
  });

  it("sends a replaced device to the Active Device screen, coming back to the attempt", async () => {
    await asTester();
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");
    await expect(opening(PASS_QUIZ, ATTEMPT)).rejects.toThrow(
      redirectsTo(
        `/app/device?next=${encodeURIComponent(`${quizPage(PASS_QUIZ)}?attempt=${ATTEMPT}`)}`,
      ),
    );
  });
});

describe("Submit", () => {
  it("marks the answers, saves the attempt, and records today as a Study Day", async () => {
    const userId = await asTester();
    const [first, second] = await writeQuestions(SIMPLE_CURVES, ["First", "A"], ["Second", "B"]);

    const state = await submitting(PASS_QUIZ, [
      [first, "A"],
      [second, null],
    ]);
    expect(state).toMatchObject({
      status: "scored",
      scored: {
        attempt: { id: ATTEMPT, correctCount: 1, questionCount: 2, score: 50 },
        bestScore: 50,
      },
    });
    expect(savedAttempts()).toHaveLength(1);
    expect(await listStudyDays(userId)).toEqual(["2026-11-17"]);
  });

  it("saves one attempt when the same Submit is sent twice", async () => {
    await asTester();
    const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);

    const first = await submitting(PASS_QUIZ, [[question, "A"]]);
    const again = await submitting(PASS_QUIZ, [[question, "A"]]);
    expect(again).toEqual(first);
    expect(savedAttempts()).toHaveLength(1);
  });

  it("refuses a forged Submit for a locked quiz, saving nothing", async () => {
    await asNewTester();
    const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);

    expect(await submitting(PASS_QUIZ, [[question, "A"]])).toEqual({
      status: "refused",
      decision: { outcome: "locked" },
    });
    expect(savedAttempts()).toEqual([]);
  });

  it("sends a replaced device's Submit to the Active Device screen, saving nothing", async () => {
    await asTester();
    const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
    jar.set(DEVICE_COOKIE, "a-token-from-before-the-switch");

    await expect(submitting(PASS_QUIZ, [[question, "A"]])).rejects.toThrow(
      redirectsTo(`/app/device?next=${encodeURIComponent(quizPage(PASS_QUIZ))}`),
    );
    expect(savedAttempts()).toEqual([]);
  });

  it("answers a mismatch for answers to another quiz's question, or a Submit it can't read", async () => {
    await asTester();
    const [mine] = await writeQuestions(SIMPLE_CURVES, ["Mine", "A"]);
    const [elsewhere] = await writeQuestions(HYDROSTATICS, ["Elsewhere", "A"]);

    expect(
      await submitting(PASS_QUIZ, [
        [mine, "A"],
        [elsewhere, "A"],
      ]),
    ).toEqual({ status: "mismatch" });
    expect(await submitting(PASS_QUIZ, [[mine, "E" as QuizChoice]])).toEqual({
      status: "mismatch",
    });
    expect(await submitQuizAttempt({ quizId: PASS_QUIZ, answers: "all of them" })).toEqual({
      status: "mismatch",
    });
    expect(savedAttempts()).toEqual([]);
  });

  it("never lets one Member's Submit touch another's attempt", async () => {
    await asTester();
    const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
    await submitting(FREE_QUIZ, [[question, "A"]]);
    await asNewTester();

    expect(await submitting(FREE_QUIZ, [[question, "B"]])).toEqual({ status: "not-found" });
    expect(savedAttempts().map((attempt) => attempt.userId)).toEqual([sampleUserId(TESTER)]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { AdminQuestion } from "@/services/admin.types";
import type { QuizSubmitInput } from "@/services/member.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";

import { sampleActor } from "../../test/admin-inputs";
import { loadCardImage } from "../../test/card-images";
import { imageBytes } from "../../test/image-bytes";
import { MEMBER_ARMS } from "../../test/member-arms";

// ─────────────────────────────────────────────────────────────────────────────
// Taking a quiz through the Member seam (spec, Phase 3 → Quizzes are graded
// on the server, Corrections never cost progress, Progress storage; stories
// 98–100, 133k, 133l), run against every arm: opening a quiz through the
// access decision without a correct choice or an explanation in sight,
// marking a submit on the server (a missing answer is wrong, a question that
// isn't the quiz's refuses it, the same attempt posted twice saves once), the
// Best Score, the Study Day, and reviewing past attempts under the quiz's
// "show answers after" rule, with a question removed since shown as removed.
// The sample quizzes: CE MSTC Simple Curves' is Visible, Spiral Curves'
// Hidden, and CE HPGE Hydrostatics' Visible and Free Preview; they start with
// no questions, so each test has an Editor write the ones it needs. It's 17
// Nov 2026, 11:42 in Manila. The tester's CE pass ends 90 days after; the
// lapsed tester's ended 3 days before; the stranger has none.
// ─────────────────────────────────────────────────────────────────────────────

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const EDITOR = sampleActor("editor");

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const HYDROSTATICS = sampleTopicId("CE", "HPGE", "Hydrostatics");
const quizOf = (topicId: string) => sampleContentId(topicId, "quiz");
const PASS_QUIZ = quizOf(SIMPLE_CURVES);
const HIDDEN_QUIZ = quizOf(SPIRAL_CURVES);
const FREE_QUIZ = quizOf(HYDROSTATICS);
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  lapsed: { email: "lapsed@example.com", name: "Lou Lapsed" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);

/** Each question's explanation: words no question read may ever carry. */
const explanationOf = (text: string) => `Worked solution for ${text}`;

describe.each(MEMBER_ARMS)("Member seam quizzes ($name)", (arm) => {
  const { seam } = arm;
  let attempts = 0;

  /** A fresh attempt id, as the quiz screen makes one when an attempt starts. */
  const newAttempt = () => `6a1f0e1c-5b55-4a51-9d0e-${(attempts++).toString(16).padStart(12, "0")}`;

  async function accessOf(who: Who, overrides: Partial<MemberAccess> = {}): Promise<MemberAccess> {
    return {
      gate: "open",
      device: "active",
      activeStaff: false,
      passes: (await seam.listAccessPasses(userOf(who))).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
      })),
      now: new Date(),
      ...overrides,
    };
  }

  /** An Editor writes questions in a Topic's quiz, in order, each with its correct choice. */
  async function writeQuestions(
    topicId: string,
    ...questions: [text: string, correct: QuizChoice][]
  ): Promise<AdminQuestion[]> {
    const written: AdminQuestion[] = [];
    for (const [text, correct] of questions) {
      const added = await arm.admin.createQuestion(EDITOR, {
        topic: topicId,
        question: text,
        choices: { A: `${text}: A`, B: `${text}: B`, C: `${text}: C`, D: `${text}: D` },
        correct,
        explanation: explanationOf(text),
        figure: null,
      });
      if (!added.ok) throw new Error(`Not added: ${JSON.stringify(added)}`);
      written.push(added.value);
    }
    return written;
  }

  /** Sets a quiz's settings as an Editor would, without the conflict check. */
  async function settings(
    quizId: string,
    { passingScore = 70, shuffle = true, showAnswers = true } = {},
  ) {
    const saved = await arm.admin.updateQuizSettings(EDITOR, {
      id: quizId,
      passingScore,
      shuffle,
      showAnswers,
    });
    if (!saved.ok) throw new Error(`Not saved: ${JSON.stringify(saved)}`);
  }

  const open = async (who: Who, quizId: string, overrides: Partial<MemberAccess> = {}) =>
    seam.openQuiz(userOf(who), quizId, await accessOf(who, overrides));

  /** Submits answers to questions, by question, in the order given, as one attempt. */
  async function submit(
    who: Who,
    quizId: string,
    answers: [AdminQuestion | undefined, QuizChoice | null][],
    { attemptId = newAttempt(), overrides = {} as Partial<MemberAccess> } = {},
  ) {
    const input: QuizSubmitInput = {
      attemptId,
      quizId,
      answers: answers.map(([question, choice]) => ({ questionId: question?.id ?? "", choice })),
    };
    return seam.submitQuiz(userOf(who), input, await accessOf(who, overrides));
  }

  const review = async (
    who: Who,
    quizId: string,
    attemptId: string,
    overrides: Partial<MemberAccess> = {},
  ) => seam.reviewQuizAttempt(userOf(who), { quizId, attemptId }, await accessOf(who, overrides));

  /** The scored attempt a submit gave, which must have been scored. */
  async function scored(promise: ReturnType<typeof submit>) {
    const result = await promise;
    if (!result.ok) throw new Error(`Not scored: ${JSON.stringify(result)}`);
    return result.value;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    for (const who of Object.keys(MEMBERS) as Who[]) {
      await seam.getOrCreateMember({ userId: userOf(who), ...MEMBERS[who] });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("openQuiz", () => {
    it("opens a quiz the Member's pass allows: its questions in order, with no correct choice or explanation", async () => {
      const [first, second] = await writeQuestions(
        SIMPLE_CURVES,
        ["Degree of curve, $R = 200$ m?", "A"],
        ["Tangent distance?", "C"],
      );

      const opening = await open("tester", PASS_QUIZ);
      expect(opening).toEqual({
        status: "allowed",
        via: "pass",
        item: expect.objectContaining({
          kind: "quiz",
          id: PASS_QUIZ,
          subjectCode: "MSTC",
          topicName: "Simple Curves",
        }),
        quiz: {
          passingScore: 70,
          shuffle: true,
          showAnswers: true,
          questions: [
            {
              id: first?.id,
              question: "Degree of curve, $R = 200$ m?",
              choices: {
                A: "Degree of curve, $R = 200$ m?: A",
                B: "Degree of curve, $R = 200$ m?: B",
                C: "Degree of curve, $R = 200$ m?: C",
                D: "Degree of curve, $R = 200$ m?: D",
              },
              figureUrl: null,
            },
            {
              id: second?.id,
              question: "Tangent distance?",
              choices: {
                A: "Tangent distance?: A",
                B: "Tangent distance?: B",
                C: "Tangent distance?: C",
                D: "Tangent distance?: D",
              },
              figureUrl: null,
            },
          ],
          imagesExpireAt: null,
          bestScore: null,
          attempts: [],
        },
      });
      // Nothing the browser gets names the right choice or explains it.
      const payload = JSON.stringify(opening);
      expect(payload).not.toMatch(/"correct"|"answer"|"explanation"|Worked solution/);
    });

    it("gives the quiz's settings as an Editor set them", async () => {
      await writeQuestions(SIMPLE_CURVES, ["Only question", "B"]);
      await settings(PASS_QUIZ, { passingScore: 85, shuffle: false, showAnswers: false });

      expect(await open("tester", PASS_QUIZ)).toMatchObject({
        status: "allowed",
        quiz: { passingScore: 85, shuffle: false, showAnswers: false },
      });
    });

    it("opens a Free Preview quiz for a Member with no pass", async () => {
      await writeQuestions(HYDROSTATICS, ["Pressure at depth?", "B"]);
      expect(await open("stranger", FREE_QUIZ)).toMatchObject({
        status: "allowed",
        via: "free-preview",
      });
    });

    it("gives a Visible quiz with no questions yet as empty: it's still being prepared", async () => {
      expect(await open("tester", PASS_QUIZ)).toMatchObject({
        status: "allowed",
        quiz: { questions: [], bestScore: null, attempts: [] },
      });
    });

    it("leaves out a question an Editor removed", async () => {
      const [first, second] = await writeQuestions(SIMPLE_CURVES, ["Kept", "A"], ["Removed", "B"]);
      await arm.admin.deleteQuestion(EDITOR, second?.id ?? "");

      const opening = await open("tester", PASS_QUIZ);
      expect(opening.status === "allowed" && opening.quiz.questions.map((q) => q.id)).toEqual([
        first?.id,
      ]);
    });

    it("never reads a locked quiz's questions, saying it's locked", async () => {
      await writeQuestions(SIMPLE_CURVES, ["A secret question", "A"]);

      const opening = await open("stranger", PASS_QUIZ);
      expect(opening).toEqual({
        status: "refused",
        item: expect.objectContaining({ id: PASS_QUIZ, topicName: "Simple Curves" }),
        decision: { outcome: "locked" },
        attemptCount: 0,
        bestScore: null,
      });
      expect(JSON.stringify(opening)).not.toContain("A secret question");
    });

    it("says an ended pass expired, keeping the Member's attempts and Best Score", async () => {
      // The lapsed tester took the quiz while it was Free Preview, then Staff ended that.
      const [question] = await writeQuestions(HYDROSTATICS, ["Pressure at depth?", "B"]);
      await scored(submit("lapsed", FREE_QUIZ, [[question, "B"]]));
      await arm.admin.setQuizFreePreview(EDITOR, FREE_QUIZ, false);

      expect(await open("lapsed", FREE_QUIZ)).toEqual({
        status: "refused",
        item: expect.objectContaining({ id: FREE_QUIZ }),
        decision: {
          outcome: "expired",
          passEndedAt: new Date(BOOT.getTime() - 3 * DAY).toISOString(),
        },
        attemptCount: 1,
        bestScore: 100,
      });
    });

    it("never opens a Hidden quiz, even for Staff", async () => {
      await writeQuestions(SPIRAL_CURVES, ["Spiral angle?", "D"]);

      for (const opening of [
        await open("tester", HIDDEN_QUIZ),
        await open("tester", HIDDEN_QUIZ, { activeStaff: true }),
      ]) {
        expect(opening).toMatchObject({ status: "refused", decision: { outcome: "unavailable" } });
        expect(JSON.stringify(opening)).not.toContain("Spiral angle?");
      }
    });

    it.each([
      ["a replaced device", { device: "replaced" }, "device-replaced"],
      ["a request with no device token", { device: "no-token" }, "no-token"],
      ["a Member the gate no longer lets in", { gate: "not-open-yet" }, "not-open-yet"],
    ] as const)("refuses %s, reading no question", async (_case, overrides, outcome) => {
      await writeQuestions(HYDROSTATICS, ["Buoyant force?", "A"]);

      const opening = await open("tester", FREE_QUIZ, overrides);
      expect(opening).toMatchObject({ status: "refused", decision: { outcome } });
      expect(JSON.stringify(opening)).not.toContain("Buoyant force?");
    });

    it.each([
      ["an unknown id", UNKNOWN],
      ["a deck's id", sampleContentId(SIMPLE_CURVES, "deck")],
      ["an id that isn't one", "simple-curves"],
    ])("finds nothing for %s", async (_case, id) => {
      expect(await open("tester", id)).toEqual({ status: "not-found" });
    });
  });

  describe("figures", () => {
    it("hands out each figure as a signed URL that works for about 10 minutes", async () => {
      const bytes = imageBytes("image/png");
      const figure = await arm.uploadCardImage(bytes);
      const added = await arm.admin.createQuestion(EDITOR, {
        topic: SIMPLE_CURVES,
        question: "The curve shown?",
        choices: { A: "1", B: "2", C: "3", D: "4" },
        correct: "A",
        explanation: "Because.",
        figure,
      });
      if (!added.ok) throw new Error("Not added");

      const opening = await open("tester", PASS_QUIZ);
      if (opening.status !== "allowed") throw new Error(`Not opened: ${opening.status}`);
      expect(opening.quiz.imagesExpireAt).toBe(
        new Date(BOOT.getTime() + 10 * MINUTE).toISOString(),
      );
      expect(await loadCardImage(opening.quiz.questions[0]?.figureUrl ?? "")).toEqual(bytes);
    });

    it("signs no figure for a locked quiz", async () => {
      const figure = await arm.uploadCardImage(imageBytes("image/png"));
      await arm.admin.createQuestion(EDITOR, {
        topic: SIMPLE_CURVES,
        question: "The curve shown?",
        choices: { A: "1", B: "2", C: "3", D: "4" },
        correct: "A",
        explanation: "Because.",
        figure,
      });

      const opening = await open("stranger", PASS_QUIZ);
      expect(opening.status).toBe("refused");
      expect(JSON.stringify(opening)).not.toMatch(/figureUrl|card-images|\/sign\//);
    });
  });

  describe("submitQuiz", () => {
    it("marks the answers on the server, saves the attempt, and gives the score, the Best Score and the review", async () => {
      const [first, second, third] = await writeQuestions(
        SIMPLE_CURVES,
        ["First", "A"],
        ["Second", "B"],
        ["Third", "C"],
      );

      const result = await submit("tester", PASS_QUIZ, [
        [third, "C"],
        [first, "D"],
        [second, "B"],
      ]);
      expect(result).toEqual({
        ok: true,
        value: {
          attempt: {
            id: expect.any(String),
            submittedAt: BOOT.toISOString(),
            correctCount: 2,
            questionCount: 3,
            score: 66,
            passingScore: 70,
            passed: false,
          },
          bestScore: 66,
          review: {
            showAnswers: true,
            questions: [
              expect.objectContaining({ number: 1, id: third?.id, chosen: "C", isCorrect: true }),
              expect.objectContaining({
                number: 2,
                id: first?.id,
                question: "First",
                chosen: "D",
                isCorrect: false,
                answer: "A",
                explanation: explanationOf("First"),
              }),
              expect.objectContaining({ number: 3, id: second?.id, chosen: "B", isCorrect: true }),
            ],
          },
        },
      });

      expect(await arm.quizAttempts()).toEqual([
        {
          id: result.ok ? result.value.attempt.id : "",
          userId: userOf("tester"),
          quizId: PASS_QUIZ,
          submittedAt: BOOT.toISOString(),
          correctCount: 2,
          questionCount: 3,
          score: 66,
          passingScore: 70,
          answers: [
            { questionId: third?.id, choice: "C", isCorrect: true },
            { questionId: first?.id, choice: "D", isCorrect: false },
            { questionId: second?.id, choice: "B", isCorrect: true },
          ],
        },
      ]);
    });

    it("scores a question left unanswered, or left out of the submit, as wrong", async () => {
      const [first, second, third, fourth] = await writeQuestions(
        SIMPLE_CURVES,
        ["First", "A"],
        ["Second", "B"],
        ["Third", "C"],
        ["Fourth", "D"],
      );

      const { attempt, review } = await scored(
        submit("tester", PASS_QUIZ, [
          [first, "A"],
          [second, null],
          [fourth, "D"],
        ]),
      );
      expect(attempt).toMatchObject({ correctCount: 2, questionCount: 4, score: 50 });
      expect(review.questions.map((q) => [q.id, q.status === "answered" && q.chosen])).toEqual([
        [first?.id, "A"],
        [second?.id, null],
        [fourth?.id, "D"],
        [third?.id, null],
      ]);
    });

    it("passes at exactly the passing score, and not one question below it", async () => {
      const questions = await writeQuestions(
        SIMPLE_CURVES,
        ["First", "A"],
        ["Second", "A"],
        ["Third", "A"],
        ["Fourth", "A"],
      );
      await settings(PASS_QUIZ, { passingScore: 50 });
      const answering = (right: number) =>
        questions.map((q, index): [AdminQuestion, QuizChoice] => [q, index < right ? "A" : "B"]);

      expect((await scored(submit("tester", PASS_QUIZ, answering(2)))).attempt).toMatchObject({
        score: 50,
        passingScore: 50,
        passed: true,
      });
      expect((await scored(submit("tester", PASS_QUIZ, answering(1)))).attempt).toMatchObject({
        score: 25,
        passed: false,
      });
    });

    it("keeps the higher Best Score after a lower retake, and lists every attempt, newest first", async () => {
      const [first, second] = await writeQuestions(SIMPLE_CURVES, ["First", "A"], ["Second", "B"]);
      const best = await scored(
        submit("tester", PASS_QUIZ, [
          [first, "A"],
          [second, "B"],
        ]),
      );
      vi.setSystemTime(new Date(BOOT.getTime() + 5 * MINUTE));
      const retake = await scored(
        submit("tester", PASS_QUIZ, [
          [first, "A"],
          [second, "C"],
        ]),
      );

      expect(retake.attempt.score).toBe(50);
      expect(retake.bestScore).toBe(100);
      const opening = await open("tester", PASS_QUIZ);
      expect(opening.status === "allowed" && opening.quiz).toMatchObject({
        bestScore: 100,
        attempts: [
          { id: retake.attempt.id, score: 50, submittedAt: retake.attempt.submittedAt },
          { id: best.attempt.id, score: 100, submittedAt: BOOT.toISOString() },
        ],
      });
    });

    it("records the day it's submitted, in Manila, as a Study Day", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
      // 00:30 on 18 Nov in Manila.
      vi.setSystemTime(new Date("2026-11-17T16:30:00.000Z"));
      await scored(submit("tester", PASS_QUIZ, [[question, "B"]]));

      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-18"]);
    });

    it("saves one attempt when the same attempt is posted twice, giving the first marking both times", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
      const attemptId = newAttempt();

      const first = await submit("tester", PASS_QUIZ, [[question, "A"]], { attemptId });
      vi.setSystemTime(new Date(BOOT.getTime() + MINUTE));
      const again = await submit("tester", PASS_QUIZ, [[question, "B"]], { attemptId });

      expect(again).toEqual(first);
      expect(await arm.quizAttempts()).toHaveLength(1);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);
    });

    it("refuses a submit naming a question that isn't the quiz's, saving nothing", async () => {
      const [mine] = await writeQuestions(SIMPLE_CURVES, ["Mine", "A"]);
      const [elsewhere] = await writeQuestions(HYDROSTATICS, ["Elsewhere", "A"]);

      for (const stranger of [elsewhere, { id: UNKNOWN } as AdminQuestion]) {
        expect(
          await submit("tester", PASS_QUIZ, [
            [mine, "A"],
            [stranger, "A"],
          ]),
        ).toEqual({ ok: false, refusal: { reason: "mismatch" } });
      }
      expect(await arm.quizAttempts()).toEqual([]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual([]);
    });

    it("refuses a submit answering a question taken out of the quiz while the Member took it, saving nothing", async () => {
      const [kept, removed] = await writeQuestions(SIMPLE_CURVES, ["Kept", "A"], ["Removed", "B"]);
      await arm.admin.deleteQuestion(EDITOR, removed?.id ?? "");

      expect(
        await submit("tester", PASS_QUIZ, [
          [kept, "A"],
          [removed, "B"],
        ]),
      ).toEqual({ ok: false, refusal: { reason: "mismatch" } });
      expect(await arm.quizAttempts()).toEqual([]);
    });

    it("refuses a submit answering a question twice, saving nothing", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);

      expect(
        await submit("tester", PASS_QUIZ, [
          [question, "B"],
          [question, "A"],
        ]),
      ).toEqual({ ok: false, refusal: { reason: "mismatch" } });
      expect(await arm.quizAttempts()).toEqual([]);
    });

    it("refuses a forged submit for a locked quiz, saving nothing", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);

      expect(await submit("stranger", PASS_QUIZ, [[question, "A"]])).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "locked" } },
      });
      expect(await arm.quizAttempts()).toEqual([]);
      expect(await seam.listStudyDays(userOf("stranger"))).toEqual([]);
    });

    it.each([
      ["a replaced device", FREE_QUIZ, { device: "replaced" }, "device-replaced"],
      ["a request with no device token", FREE_QUIZ, { device: "no-token" }, "no-token"],
      ["a Hidden quiz", HIDDEN_QUIZ, {}, "unavailable"],
    ] as const)(
      "refuses a submit from %s, saving nothing",
      async (_case, quizId, overrides, outcome) => {
        const topic = quizId === FREE_QUIZ ? HYDROSTATICS : SPIRAL_CURVES;
        const [question] = await writeQuestions(topic, ["Only", "A"]);

        expect(await submit("tester", quizId, [[question, "A"]], { overrides })).toEqual({
          ok: false,
          refusal: { reason: "refused", decision: { outcome } },
        });
        expect(await arm.quizAttempts()).toEqual([]);
      },
    );

    it("with “show answers after” off, gives no correct answer or explanation", async () => {
      const [first, second] = await writeQuestions(SIMPLE_CURVES, ["First", "A"], ["Second", "B"]);
      await settings(PASS_QUIZ, { showAnswers: false });

      const result = await scored(
        submit("tester", PASS_QUIZ, [
          [first, "C"],
          [second, "B"],
        ]),
      );
      expect(result.review).toEqual({
        showAnswers: false,
        questions: [
          expect.objectContaining({ id: first?.id, chosen: "C", isCorrect: false }),
          expect.objectContaining({ id: second?.id, chosen: "B", isCorrect: true }),
        ],
      });
      expect(JSON.stringify(result)).not.toMatch(/"answer"|"explanation"|Worked solution/);
    });

    it("finds nothing for a quiz that isn't one, saving nothing", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
      for (const quizId of [UNKNOWN, "simple-curves"]) {
        expect(await submit("tester", quizId, [[question, "A"]])).toEqual({
          ok: false,
          refusal: { reason: "not-found" },
        });
      }
      expect(await arm.quizAttempts()).toEqual([]);
    });

    it("refuses an attempt id another Member used, saving nothing and giving nothing of theirs", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
      const attemptId = newAttempt();
      await scored(submit("tester", FREE_QUIZ, [[question, "A"]], { attemptId }));

      const theirs = await submit("stranger", FREE_QUIZ, [[question, "B"]], { attemptId });
      expect(theirs).toEqual({ ok: false, refusal: { reason: "not-found" } });
      expect((await arm.quizAttempts()).map((attempt) => attempt.userId)).toEqual([
        userOf("tester"),
      ]);
    });

    it("refuses the same attempt sent again for another quiz", async () => {
      const [mine] = await writeQuestions(SIMPLE_CURVES, ["Mine", "A"]);
      const [free] = await writeQuestions(HYDROSTATICS, ["Free", "A"]);
      const attemptId = newAttempt();
      await scored(submit("tester", PASS_QUIZ, [[mine, "A"]], { attemptId }));

      expect(await submit("tester", FREE_QUIZ, [[free, "A"]], { attemptId })).toEqual({
        ok: false,
        refusal: { reason: "not-found" },
      });
      expect(await arm.quizAttempts()).toHaveLength(1);
    });

    it("throws for a submit the quiz screen can't send", async () => {
      const [question] = await writeQuestions(SIMPLE_CURVES, ["Only", "A"]);
      const access = await accessOf("tester");
      const answers = [{ questionId: question?.id ?? "", choice: "A" as const }];

      await expect(
        seam.submitQuiz(
          userOf("tester"),
          { attemptId: "attempt-1", quizId: PASS_QUIZ, answers },
          access,
        ),
      ).rejects.toThrow();
      await expect(
        seam.submitQuiz(
          userOf("tester"),
          {
            attemptId: newAttempt(),
            quizId: PASS_QUIZ,
            answers: [{ questionId: question?.id ?? "", choice: "E" as QuizChoice }],
          },
          access,
        ),
      ).rejects.toThrow();
      expect(await arm.quizAttempts()).toEqual([]);
    });
  });

  describe("reviewQuizAttempt", () => {
    it("reviews a past attempt as the score screen showed it", async () => {
      const [first, second] = await writeQuestions(HYDROSTATICS, ["First", "A"], ["Second", "B"]);
      const submitted = await scored(
        submit("tester", FREE_QUIZ, [
          [first, "B"],
          [second, "B"],
        ]),
      );
      vi.setSystemTime(new Date(BOOT.getTime() + DAY));

      expect(await review("tester", FREE_QUIZ, submitted.attempt.id)).toEqual({
        status: "allowed",
        via: "pass",
        item: expect.objectContaining({ id: FREE_QUIZ }),
        attempt: submitted.attempt,
        bestScore: 50,
        review: submitted.review,
      });
    });

    it("follows the quiz's “show answers after” as it is now", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
      const submitted = await scored(submit("tester", FREE_QUIZ, [[question, "B"]]));
      await settings(FREE_QUIZ, { showAnswers: false });

      const opening = await review("tester", FREE_QUIZ, submitted.attempt.id);
      expect(opening).toMatchObject({ status: "allowed", review: { showAnswers: false } });
      expect(JSON.stringify(opening)).not.toMatch(/"answer"|"explanation"|Worked solution/);
    });

    it("shows a question removed since as removed, keeping the score; retakes use the current questions", async () => {
      const [kept, removed] = await writeQuestions(
        HYDROSTATICS,
        ["Kept", "A"],
        ["Removed later", "B"],
      );
      const submitted = await scored(
        submit("tester", FREE_QUIZ, [
          [kept, "A"],
          [removed, "B"],
        ]),
      );
      await arm.admin.deleteQuestion(EDITOR, removed?.id ?? "");

      const opening = await review("tester", FREE_QUIZ, submitted.attempt.id);
      expect(opening).toMatchObject({
        status: "allowed",
        attempt: { score: 100, correctCount: 2, questionCount: 2 },
        bestScore: 100,
        review: {
          questions: [
            expect.objectContaining({ status: "answered", id: kept?.id }),
            { status: "removed", number: 2, id: removed?.id, isCorrect: true },
          ],
        },
      });
      expect(JSON.stringify(opening)).not.toContain("Removed later");

      const retake = await open("tester", FREE_QUIZ);
      expect(retake.status === "allowed" && retake.quiz.questions.map((q) => q.id)).toEqual([
        kept?.id,
      ]);
      expect(retake.status === "allowed" && retake.quiz.bestScore).toBe(100);
    });

    it("keeps an attempt's verdicts when an Editor corrects a question, saying it was corrected", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["Pressure at depth?", "A"]);
      const submitted = await scored(submit("tester", FREE_QUIZ, [[question, "A"]]));
      const corrected = await arm.admin.updateQuestion(EDITOR, {
        id: question?.id ?? "",
        question: "Pressure at depth?",
        choices: {
          A: "Pressure at depth?: A",
          B: "Pressure at depth?: B",
          C: "Pressure at depth?: C",
          D: "Pressure at depth?: D",
        },
        correct: "C",
        explanation: "Corrected.",
        figure: null,
      });
      if (!corrected.ok) throw new Error("Not corrected");

      const opening = await review("tester", FREE_QUIZ, submitted.attempt.id);
      expect(opening).toMatchObject({
        status: "allowed",
        attempt: { score: 100 },
        bestScore: 100,
        review: {
          questions: [
            expect.objectContaining({
              chosen: "A",
              isCorrect: true,
              answer: "C",
              correctedSince: true,
            }),
          ],
        },
      });
    });

    it("never gives one Member's attempts to another", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
      const theirs = await scored(submit("tester", FREE_QUIZ, [[question, "A"]]));

      expect(await review("stranger", FREE_QUIZ, theirs.attempt.id)).toEqual({
        status: "not-found",
      });
      expect(await open("stranger", FREE_QUIZ)).toMatchObject({
        status: "allowed",
        quiz: { bestScore: null, attempts: [] },
      });
    });

    it("refuses a review of a quiz the Member can no longer open, showing nothing of it", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["A secret question", "A"]);
      const submitted = await scored(submit("lapsed", FREE_QUIZ, [[question, "B"]]));
      await arm.admin.setQuizFreePreview(EDITOR, FREE_QUIZ, false);

      const opening = await review("lapsed", FREE_QUIZ, submitted.attempt.id);
      expect(opening).toMatchObject({
        status: "refused",
        decision: { outcome: "expired" },
        attemptCount: 1,
        bestScore: 0,
      });
      expect(JSON.stringify(opening)).not.toContain("A secret question");

      expect(
        await review("tester", FREE_QUIZ, submitted.attempt.id, { device: "replaced" }),
      ).toMatchObject({ status: "refused", decision: { outcome: "device-replaced" } });
    });

    it("finds nothing for an attempt at another quiz, or one that isn't there", async () => {
      const [question] = await writeQuestions(HYDROSTATICS, ["Only", "A"]);
      await writeQuestions(SIMPLE_CURVES, ["Other", "A"]);
      const submitted = await scored(submit("tester", FREE_QUIZ, [[question, "A"]]));

      for (const [quizId, attemptId] of [
        [PASS_QUIZ, submitted.attempt.id],
        [FREE_QUIZ, UNKNOWN],
        [FREE_QUIZ, "attempt-1"],
        [FREE_QUIZ, "a".repeat(500)],
        ["hydrostatics", submitted.attempt.id],
      ]) {
        expect(await review("tester", quizId ?? "", attemptId ?? "")).toEqual({
          status: "not-found",
        });
      }
    });
  });
});

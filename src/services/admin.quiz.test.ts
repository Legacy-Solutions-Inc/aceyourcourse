import { beforeEach, describe, expect, it } from "vitest";

import type { AdminQuiz, AdminQuizSettings } from "@/services/admin.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";
import { importZip, quizCsv } from "../../test/import-files";
import { imageBytes } from "../../test/image-bytes";

// The Admin seam's quiz screen (Phase 3, ticket 09; spec, Phase 3 → Content
// model; stories 126–128), run against every arm: a Topic's quiz with its
// questions, its settings (passing score, shuffle, "show answers after") with
// the conflict check, and its Visible and Free Preview toggles, Visible
// refused while it has no questions. Each change goes in Staff Activity. The
// sample data's CE MSTC Topics: Simple Curves (a Visible quiz, no
// questions), Spiral Curves (a Hidden quiz, no questions), Surveying (empty).

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const PNG = imageBytes("image/png", 80);
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";
const PASSING_SCORE_ERROR = "ENTER A WHOLE NUMBER FROM 1 TO 100";

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SIMPLE_CURVES_QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SPIRAL_CURVES_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");

describe.each(ADMIN_ARMS)("Admin seam: quizzes ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  /** Imports questions into Spiral Curves' Hidden quiz, the second with a figure. */
  async function withQuestions() {
    const paths = await arm.uploadImport({
      csv: quizCsv([
        "Spiral Curves,Length of spiral?,1,2,3,4,B,$L_s = 0.036 V^3/R$,",
        "Spiral Curves,Spiral angle?,a,b,c,d,D,Because.,spiral.png",
      ]),
      zip: importZip({ "spiral.png": PNG }),
    });
    const input = { exam: "ce", subject: "mstc", mode: "add", ...paths } as const;
    const planned = await seam.planQuizImport(EDITOR, input);
    if (!planned.ok) throw new Error(JSON.stringify(planned.error));
    const confirmed = await seam.confirmQuizImport(EDITOR, {
      ...input,
      basedOn: planned.value.basedOn,
    });
    if (!confirmed.ok) throw new Error(JSON.stringify(confirmed.error));
  }

  /** The quiz screen, which the test expects there. */
  async function quizScreen(topicId: string): Promise<AdminQuiz> {
    const quiz = await seam.getQuizForAdmin(EDITOR, topicId);
    if (!quiz) throw new Error("The Topic isn't there");
    return quiz;
  }

  /** Staff Activity, the imports' records left out. */
  async function quizActivity() {
    return (await arm.staffActivity()).filter((record) => record.entity === "quiz");
  }

  describe("getQuizForAdmin", () => {
    it("gives a Topic with no quiz, as none", async () => {
      expect(await seam.getQuizForAdmin(EDITOR, SURVEYING)).toEqual({
        exam: { code: "CE", name: "Civil Engineering" },
        subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
        topic: { id: SURVEYING, name: "Surveying", position: 3 },
        quiz: null,
        questions: [],
      } satisfies AdminQuiz);
    });

    it("gives the quiz's settings, as no one has saved them, and its questions in order", async () => {
      await withQuestions();

      const quiz = await quizScreen(SPIRAL_CURVES);

      expect(quiz.quiz).toEqual({
        id: SPIRAL_CURVES_QUIZ,
        visibility: "hidden",
        freePreview: false,
        passingScore: 70,
        shuffle: true,
        showAnswers: true,
        stamp: { savedAt: expect.any(String), savedBy: null },
      } satisfies AdminQuizSettings);
      expect(quiz.questions).toEqual([
        {
          id: expect.any(String),
          position: 1,
          question: "Length of spiral?",
          choices: { A: "1", B: "2", C: "3", D: "4" },
          correct: "B",
          explanation: "$L_s = 0.036 V^3/R$",
          figure: null,
        },
        expect.objectContaining({
          position: 2,
          question: "Spiral angle?",
          correct: "D",
          figure: expect.stringMatching(/^quizzes\//),
        }),
      ]);
    });

    it("leaves out the questions a Replace took out", async () => {
      await withQuestions();
      const paths = await arm.uploadImport({
        csv: quizCsv(["Spiral Curves,Length of spiral?,1,2,3,4,B,Shorter.,"]),
      });
      const input = { exam: "ce", subject: "mstc", mode: "replace", ...paths } as const;
      const planned = await seam.planQuizImport(EDITOR, input);
      if (!planned.ok) throw new Error(JSON.stringify(planned.error));
      await seam.confirmQuizImport(EDITOR, { ...input, basedOn: planned.value.basedOn });

      const quiz = await quizScreen(SPIRAL_CURVES);
      expect(quiz.questions.map((q) => [q.position, q.question, q.explanation])).toEqual([
        [1, "Length of spiral?", "Shorter."],
      ]);
      expect((await arm.questions()).filter((q) => q.removedAt !== null)).toHaveLength(1);
    });

    it("gives nothing for a Topic that isn't there", async () => {
      expect(await seam.getQuizForAdmin(EDITOR, UNKNOWN)).toBeNull();
      expect(await seam.getQuizForAdmin(EDITOR, "not-an-id")).toBeNull();
    });
  });

  describe("getQuestionFigureForAdmin", () => {
    it("gives a question's figure from the private bucket, and nothing for one without", async () => {
      await withQuestions();
      const [plain, withFigure] = (await quizScreen(SPIRAL_CURVES)).questions;

      expect(await seam.getQuestionFigureForAdmin(EDITOR, withFigure?.id ?? "")).toEqual({
        contentType: "image/png",
        bytes: PNG,
      });
      expect(await seam.getQuestionFigureForAdmin(EDITOR, plain?.id ?? "")).toBeNull();
      expect(await seam.getQuestionFigureForAdmin(EDITOR, UNKNOWN)).toBeNull();
      expect(await seam.getQuestionFigureForAdmin(EDITOR, "not-an-id")).toBeNull();
    });
  });

  describe("updateQuizSettings", () => {
    it("saves the passing score, shuffle and show answers, with a new stamp and a Staff Activity record", async () => {
      const opened = (await quizScreen(SPIRAL_CURVES)).quiz;

      const saved = await seam.updateQuizSettings(
        OWNER,
        { id: SPIRAL_CURVES_QUIZ, passingScore: "85", shuffle: false, showAnswers: false },
        { savedAt: opened?.stamp.savedAt ?? "" },
      );

      expect(saved).toEqual({
        ok: true,
        value: {
          id: SPIRAL_CURVES_QUIZ,
          visibility: "hidden",
          freePreview: false,
          passingScore: 85,
          shuffle: false,
          showAnswers: false,
          stamp: { savedAt: expect.any(String), savedBy: OWNER.name },
        },
        tags: [],
      });
      expect((await quizScreen(SPIRAL_CURVES)).quiz).toEqual(saved.ok && saved.value);
      expect(await quizActivity()).toEqual([
        {
          id: expect.any(String),
          at: expect.any(String),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "quiz",
          entityId: SPIRAL_CURVES_QUIZ,
          action: "settings",
          before: { passingScore: 70, shuffle: true, showAnswers: true },
          after: { passingScore: 85, shuffle: false, showAnswers: false },
        },
      ]);
    });

    it.each([
      ["1", 1],
      ["100", 100],
      [" 85% ", 85],
      [60, 60],
    ])("takes a passing score of %j as %d", async (typed, score) => {
      const saved = await seam.updateQuizSettings(EDITOR, {
        id: SPIRAL_CURVES_QUIZ,
        passingScore: typed,
        shuffle: true,
        showAnswers: true,
      });

      expect(saved.ok && saved.value.passingScore).toBe(score);
    });

    it.each(["0", "101", "abc", "70.5", "", 0, 101, -5, null])(
      "refuses a passing score of %j, saving nothing",
      async (typed) => {
        const before = await quizScreen(SPIRAL_CURVES);

        expect(
          await seam.updateQuizSettings(EDITOR, {
            id: SPIRAL_CURVES_QUIZ,
            passingScore: typed,
            shuffle: false,
            showAnswers: true,
          }),
        ).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: { passingScore: [PASSING_SCORE_ERROR] } },
        });
        expect(await quizScreen(SPIRAL_CURVES)).toEqual(before);
        expect(await quizActivity()).toEqual([]);
      },
    );

    it("refuses a stale form with the conflict check, naming the save it missed", async () => {
      const opened = (await quizScreen(SPIRAL_CURVES)).quiz?.stamp.savedAt ?? "";
      const first = await seam.updateQuizSettings(
        OWNER,
        { id: SPIRAL_CURVES_QUIZ, passingScore: 80, shuffle: true, showAnswers: true },
        { savedAt: opened },
      );

      const stale = await seam.updateQuizSettings(
        EDITOR,
        { id: SPIRAL_CURVES_QUIZ, passingScore: 50, shuffle: true, showAnswers: true },
        { savedAt: opened },
      );

      expect(stale).toEqual({
        ok: false,
        error: {
          kind: "conflict",
          savedBy: OWNER.name,
          savedAt: first.ok ? first.value.stamp.savedAt : "",
        },
      });
      expect((await quizScreen(SPIRAL_CURVES)).quiz?.passingScore).toBe(80);
    });

    it("saves nothing, and records nothing, when the settings are unchanged", async () => {
      const opened = (await quizScreen(SPIRAL_CURVES)).quiz;

      const saved = await seam.updateQuizSettings(
        EDITOR,
        { id: SPIRAL_CURVES_QUIZ, passingScore: "70", shuffle: true, showAnswers: true },
        { savedAt: opened?.stamp.savedAt ?? "" },
      );

      expect(saved).toEqual({ ok: true, value: opened, tags: [] });
      expect((await quizScreen(SPIRAL_CURVES)).quiz).toEqual(opened);
      expect(await quizActivity()).toEqual([]);
    });

    it("answers not found for a quiz that isn't there", async () => {
      expect(
        await seam.updateQuizSettings(EDITOR, {
          id: UNKNOWN,
          passingScore: 70,
          shuffle: true,
          showAnswers: true,
        }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("setQuizVisibility", () => {
    it("refuses to make a quiz with no questions Visible, changing nothing", async () => {
      expect(await seam.setQuizVisibility(EDITOR, SPIRAL_CURVES_QUIZ, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "ADD A QUESTION FIRST" },
      });
      expect((await quizScreen(SPIRAL_CURVES)).quiz?.visibility).toBe("hidden");
      expect(await quizActivity()).toEqual([]);
    });

    it("makes a quiz with questions Visible, then Hidden again, recording each", async () => {
      await withQuestions();

      const shown = await seam.setQuizVisibility(EDITOR, SPIRAL_CURVES_QUIZ, true);
      expect(shown.ok && shown.value.visibility).toBe("visible");
      expect((await quizScreen(SPIRAL_CURVES)).quiz?.visibility).toBe("visible");
      const hidden = await seam.setQuizVisibility(EDITOR, SPIRAL_CURVES_QUIZ, false);
      expect(hidden.ok && hidden.value.visibility).toBe("hidden");

      expect((await quizActivity()).map((r) => [r.action, r.before, r.after])).toEqual([
        ["show", { visibility: "hidden" }, { visibility: "visible" }],
        ["hide", { visibility: "visible" }, { visibility: "hidden" }],
      ]);
    });

    it("always lets an empty quiz be Hidden", async () => {
      const hidden = await seam.setQuizVisibility(EDITOR, SIMPLE_CURVES_QUIZ, false);

      expect(hidden.ok && hidden.value.visibility).toBe("hidden");
    });

    it("records nothing when the quiz is already as asked", async () => {
      await seam.setQuizVisibility(EDITOR, SPIRAL_CURVES_QUIZ, false);

      expect(await quizActivity()).toEqual([]);
    });

    it("answers not found for a quiz that isn't there", async () => {
      expect(await seam.setQuizVisibility(EDITOR, UNKNOWN, false)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("setQuizFreePreview", () => {
    it("flags a quiz Free Preview, and records it", async () => {
      const saved = await seam.setQuizFreePreview(EDITOR, SPIRAL_CURVES_QUIZ, true);

      expect(saved.ok && saved.value.freePreview).toBe(true);
      expect((await quizScreen(SPIRAL_CURVES)).quiz?.freePreview).toBe(true);
      expect((await quizActivity()).map((r) => [r.action, r.before, r.after])).toEqual([
        ["free-preview", { freePreview: false }, { freePreview: true }],
      ]);
    });

    it("refuses an input that isn't on or off", async () => {
      expect(
        // @ts-expect-error Not on or off, as a forged request might send.
        await seam.setQuizFreePreview(EDITOR, SPIRAL_CURVES_QUIZ, "yes"),
      ).toMatchObject({ ok: false, error: { kind: "invalid" } });
    });
  });
});

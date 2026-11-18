import { beforeEach, describe, expect, it } from "vitest";

import { MAX_CARD_IMAGE_BYTES } from "@/lib/cards/card-rules";
import type { NewQuestionForm } from "@/services/admin.schema";
import type { AdminQuestion, StaffActor } from "@/services/admin.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";

import { sampleActor } from "../../test/admin-inputs";
import { ADMIN_ARMS } from "../../test/admin-arms";
import { imageBytes, textBytes } from "../../test/image-bytes";

// ─────────────────────────────────────────────────────────────────────────────
// The question editor through the Admin seam (Phase 3, ticket 10; spec, Phase
// 3 → Content model, Corrections never cost progress; stories 125, 127,
// 133l): any Staff User adds, edits, moves and deletes a Topic's quiz
// questions one at a time, as the card editor does cards. Every rule is the
// seam's: a question's text (question-fields.ts), exactly one correct choice,
// its figure (a finished "card-image" upload, a JPEG, PNG or WebP of at most
// 5 MB), the conflict check on an edit, and the last question's delete hiding
// a Visible quiz. A deleted question is never erased: it's kept, marked
// removed, with every field as it was, for Members' old attempts and Best
// Scores. Each change appends Staff Activity.
// The sample data's CE MSTC Topics: Simple Curves (a Visible quiz with no
// questions), Spiral Curves (a Hidden quiz with none), Surveying (no quiz).
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SIMPLE_CURVES_QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SPIRAL_CURVES_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const PNG = imageBytes("image/png", 80);
const FORMULA = "$D = \\frac{1145.916}{R}$";
const CHOICES = { A: "$5.73°$", B: "$11.46°$", C: "$2.86°$", D: "$1.43°$" };

describe.each(ADMIN_ARMS)("the question editor ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  async function quizOf(topic: string) {
    const quiz = await seam.getQuizForAdmin(EDITOR, topic);
    if (!quiz) throw new Error(`${topic} isn't in the sample data`);
    return quiz;
  }

  /** Adds a question to a Topic's quiz, which must save. */
  async function addQuestion(
    topic: string,
    question: string,
    fields: Partial<Omit<NewQuestionForm, "topic" | "question">> = {},
    actor: StaffActor = EDITOR,
  ): Promise<AdminQuestion> {
    const result = await seam.createQuestion(actor, {
      topic,
      question,
      choices: CHOICES,
      correct: "A",
      explanation: FORMULA,
      figure: null,
      ...fields,
    });
    if (!result.ok) throw new Error(`The question wasn't added: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  const texts = async (topic: string) =>
    (await quizOf(topic)).questions.map((question) => question.question);

  /** Runs `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    return { result, appended: (await arm.staffActivity()).slice(before.length) };
  }

  /** The question as the quiz holds it now, removed or not, read behind the seam's back. */
  async function stored(id: string) {
    return (await arm.questions()).find((question) => question.id === id);
  }

  describe("reading a quiz", () => {
    it("gives each question with the stamp an edit's conflict check compares", async () => {
      const added = await addQuestion(SPIRAL_CURVES, "Degree of curve?");

      expect((await quizOf(SPIRAL_CURVES)).questions).toEqual([
        {
          id: added.id,
          position: 1,
          question: "Degree of curve?",
          choices: CHOICES,
          correct: "A",
          explanation: FORMULA,
          figure: null,
          stamp: { savedAt: added.stamp.savedAt, savedBy: EDITOR.name },
        },
      ]);
    });
  });

  describe("adding a question", () => {
    it("adds a question with maths last in the quiz, as saved, and records it", async () => {
      await addQuestion(SPIRAL_CURVES, "First?");
      const { result, appended } = await appendedBy(() =>
        seam.createQuestion(EDITOR, {
          topic: SPIRAL_CURVES,
          question: "  Degree of curve for $R = 200$?  ",
          choices: { A: " 1 ", B: "2", C: "3", D: "4\n" },
          correct: "C",
          explanation: `${FORMULA}\n`,
          figure: null,
        }),
      );

      const question = {
        question: "Degree of curve for $R = 200$?",
        choices: { A: "1", B: "2", C: "3", D: "4" },
        correct: "C",
        explanation: FORMULA,
        figure: null,
      };
      expect(result).toEqual({
        ok: true,
        value: {
          id: expect.any(String),
          position: 2,
          ...question,
          stamp: { savedAt: expect.any(String), savedBy: EDITOR.name },
        },
        tags: [],
      });
      expect(await texts(SPIRAL_CURVES)).toEqual(["First?", "Degree of curve for $R = 200$?"]);
      expect(appended).toEqual([
        {
          id: expect.any(String),
          at: expect.any(String),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "question",
          entityId: result.ok ? result.value.id : "",
          action: "add",
          before: null,
          after: { quiz: SPIRAL_CURVES_QUIZ, position: 2, ...question },
        },
      ]);
    });

    it("gives a Topic with no quiz one, Hidden, not Free Preview, with the default settings", async () => {
      const { result, appended } = await appendedBy(() =>
        seam.createQuestion(OWNER, {
          topic: SURVEYING,
          question: "Bearing of a line due east?",
          choices: { A: "N 90° E", B: "S 90° E", C: "N 0° E", D: "S 0° W" },
          correct: "A",
          explanation: "Measured from north.",
        }),
      );

      const quiz = await quizOf(SURVEYING);
      expect(quiz.quiz).toEqual({
        id: expect.any(String),
        visibility: "hidden",
        freePreview: false,
        passingScore: 70,
        shuffle: true,
        showAnswers: true,
        stamp: expect.any(Object),
      });
      expect(quiz.questions.map((question) => question.id)).toEqual([
        result.ok ? result.value.id : "",
      ]);
      expect(appended.map((record) => [record.entity, record.action, record.entityId])).toEqual([
        ["quiz", "add", quiz.quiz?.id],
        ["question", "add", result.ok ? result.value.id : ""],
      ]);
    });

    it("stores its figure under the quiz in the private bucket, and deletes the upload", async () => {
      const upload = await arm.uploadCardImage(PNG);

      const added = await addQuestion(SPIRAL_CURVES, "Read the figure", { figure: upload });

      expect(added.figure).toMatch(
        new RegExp(`^quizzes/${SPIRAL_CURVES_QUIZ}/[0-9a-f-]{36}\\.png$`),
      );
      expect(await arm.storedFile(added.figure ?? "")).toEqual(PNG);
      expect(await seam.getQuestionFigureForAdmin(EDITOR, added.id)).toEqual({
        contentType: "image/png",
        bytes: PNG,
      });
      expect(await arm.contentFiles.readUpload(upload, "card-image")).toBeNull();
    });

    it("refuses a question with no correct choice picked, saving nothing", async () => {
      const { result, appended } = await appendedBy(() =>
        seam.createQuestion(EDITOR, {
          topic: SPIRAL_CURVES,
          question: "Which?",
          choices: CHOICES,
          correct: "",
          explanation: "Because.",
        }),
      );

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { correct: ["PICK THE CORRECT CHOICE TO SAVE"] },
        },
      });
      expect(await texts(SPIRAL_CURVES)).toEqual([]);
      expect(appended).toEqual([]);
    });

    it("refuses a correct choice that isn't A–D, as a forged request might send", async () => {
      const result = await seam.createQuestion(EDITOR, {
        topic: SPIRAL_CURVES,
        question: "Which?",
        choices: CHOICES,
        correct: "E",
        explanation: "Because.",
      });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { correct: ["PICK THE CORRECT CHOICE TO SAVE"] } },
      });
    });

    it("refuses an empty choice, and a question or explanation of spaces, saying which", async () => {
      const result = await seam.createQuestion(EDITOR, {
        topic: SPIRAL_CURVES,
        question: "   ",
        choices: { ...CHOICES, B: "", D: "  " },
        correct: "A",
        explanation: "",
      });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            question: ["ADD THE QUESTION TO SAVE"],
            "choices.B": ["ADD CHOICE B TO SAVE"],
            "choices.D": ["ADD CHOICE D TO SAVE"],
            explanation: ["ADD AN EXPLANATION TO SAVE"],
          },
        },
      });
      expect(await texts(SPIRAL_CURVES)).toEqual([]);
    });

    it("refuses a formula that won't render, naming the field", async () => {
      const result = await seam.createQuestion(EDITOR, {
        topic: SPIRAL_CURVES,
        question: "Degree?",
        choices: { ...CHOICES, C: "$\\frac{1}{$" },
        correct: "A",
        explanation: "Because.",
      });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            "choices.C": [expect.stringMatching(/^Choice C has a formula that won’t render/)],
          },
        },
      });
      expect(await texts(SPIRAL_CURVES)).toEqual([]);
    });

    it.each([
      [
        "a file that isn't an image",
        () => arm.uploadCardImage(textBytes()),
        "USE A JPEG, PNG OR WEBP IMAGE",
      ],
      [
        "an upload whose file never arrived",
        () => arm.uploadCardImage(PNG, { send: false }),
        "UPLOAD THE IMAGE AGAIN",
      ],
      [
        "an image over 5 MB",
        () => arm.uploadCardImage(imageBytes("image/png", MAX_CARD_IMAGE_BYTES + 1)),
        "KEEP THE IMAGE TO 5 MB",
      ],
    ])("refuses %s as its figure, saving nothing", async (_, upload, message) => {
      const figure = await upload();

      expect(
        await seam.createQuestion(EDITOR, {
          topic: SPIRAL_CURVES,
          question: "Read the figure",
          choices: CHOICES,
          correct: "A",
          explanation: "Because.",
          figure,
        }),
      ).toEqual({ ok: false, error: { kind: "invalid", fieldErrors: { figure: [message] } } });
      expect(await texts(SPIRAL_CURVES)).toEqual([]);
    });

    it("answers not found for a Topic that isn't there", async () => {
      expect(
        await seam.createQuestion(EDITOR, {
          topic: UNKNOWN,
          question: "Degree?",
          choices: CHOICES,
          correct: "A",
          explanation: "Because.",
        }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("editing a question", () => {
    it("saves its fields, with a new stamp and the values before and after in Staff Activity", async () => {
      const added = await addQuestion(SPIRAL_CURVES, "Degree?");

      const { result, appended } = await appendedBy(() =>
        seam.updateQuestion(
          OWNER,
          {
            id: added.id,
            question: "Degree of curve?",
            choices: { ...CHOICES, D: "$2.29°$" },
            correct: "D",
            explanation: "Arc definition.",
            figure: null,
          },
          { savedAt: added.stamp.savedAt },
        ),
      );

      expect(result).toEqual({
        ok: true,
        value: {
          ...added,
          question: "Degree of curve?",
          choices: { ...CHOICES, D: "$2.29°$" },
          correct: "D",
          explanation: "Arc definition.",
          stamp: { savedAt: expect.any(String), savedBy: OWNER.name },
        },
        tags: [],
      });
      expect((await quizOf(SPIRAL_CURVES)).questions).toEqual([result.ok && result.value]);
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "question",
          entityId: added.id,
          action: "edit",
          before: {
            question: "Degree?",
            choices: CHOICES,
            correct: "A",
            explanation: FORMULA,
            figure: null,
          },
          after: {
            question: "Degree of curve?",
            choices: { ...CHOICES, D: "$2.29°$" },
            correct: "D",
            explanation: "Arc definition.",
            figure: null,
          },
        }),
      ]);
    });

    it("refuses a stale edit with the conflict check, naming the save it missed", async () => {
      const added = await addQuestion(SPIRAL_CURVES, "Degree?");
      const opened = { savedAt: added.stamp.savedAt };
      const first = await seam.updateQuestion(
        OWNER,
        {
          id: added.id,
          question: "Owner's",
          choices: CHOICES,
          correct: "B",
          explanation: "Owner.",
        },
        opened,
      );

      const { result, appended } = await appendedBy(() =>
        seam.updateQuestion(
          EDITOR,
          { id: added.id, question: "Editor's", choices: CHOICES, correct: "C", explanation: "E." },
          opened,
        ),
      );

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "conflict",
          savedBy: OWNER.name,
          savedAt: first.ok ? first.value.stamp.savedAt : "",
        },
      });
      expect(await texts(SPIRAL_CURVES)).toEqual(["Owner's"]);
      expect(appended).toEqual([]);
    });

    it("refuses an edit with no correct choice, changing nothing", async () => {
      const added = await addQuestion(SPIRAL_CURVES, "Degree?");

      expect(
        await seam.updateQuestion(EDITOR, {
          id: added.id,
          question: "Degree?",
          choices: CHOICES,
          correct: null,
          explanation: "Because.",
        }),
      ).toMatchObject({ ok: false, error: { fieldErrors: { correct: [expect.any(String)] } } });
      expect((await quizOf(SPIRAL_CURVES)).questions[0]?.correct).toBe("A");
    });

    it("replaces its figure, deleting the old file, and deletes it when the figure is removed", async () => {
      const added = await addQuestion(SPIRAL_CURVES, "Figure?", {
        figure: await arm.uploadCardImage(PNG),
      });
      const replacement = imageBytes("image/webp", 120);
      const fields = { question: "Figure?", choices: CHOICES, correct: "A", explanation: FORMULA };

      const replaced = await seam.updateQuestion(EDITOR, {
        id: added.id,
        ...fields,
        figure: await arm.uploadCardImage(replacement, { contentType: "image/webp" }),
      });
      const newFigure = replaced.ok ? replaced.value.figure : null;
      expect(newFigure).toMatch(/\.webp$/);
      expect(await arm.storedFile(newFigure ?? "")).toEqual(replacement);
      expect(await arm.storedFile(added.figure ?? "")).toBeNull();

      const kept = await seam.updateQuestion(EDITOR, {
        id: added.id,
        ...fields,
        figure: newFigure,
      });
      expect(kept.ok && kept.value.figure).toBe(newFigure);

      const removed = await seam.updateQuestion(EDITOR, { id: added.id, ...fields, figure: null });
      expect(removed.ok && removed.value.figure).toBeNull();
      expect(await arm.storedFile(newFigure ?? "")).toBeNull();
    });

    it("answers not found for a question that isn't there", async () => {
      expect(
        await seam.updateQuestion(EDITOR, {
          id: UNKNOWN,
          question: "Degree?",
          choices: CHOICES,
          correct: "A",
          explanation: "Because.",
        }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("reordering questions", () => {
    it("moves a question one place up or down, recording the order before and after", async () => {
      const first = await addQuestion(SPIRAL_CURVES, "First?");
      const second = await addQuestion(SPIRAL_CURVES, "Second?");
      const third = await addQuestion(SPIRAL_CURVES, "Third?");

      const { result, appended } = await appendedBy(() =>
        seam.moveQuestion(EDITOR, third.id, "up"),
      );

      expect(result).toEqual({ ok: true, value: [first.id, third.id, second.id], tags: [] });
      expect((await quizOf(SPIRAL_CURVES)).questions.map((q) => [q.position, q.question])).toEqual([
        [1, "First?"],
        [2, "Third?"],
        [3, "Second?"],
      ]);
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "question",
          entityId: third.id,
          action: "move",
          before: [first.id, second.id, third.id],
          after: [first.id, third.id, second.id],
        }),
      ]);
      const down = await seam.moveQuestion(OWNER, first.id, "down");
      expect(down.ok && down.value).toEqual([third.id, first.id, second.id]);
    });

    it("refuses to move the first question up or the last one down", async () => {
      const first = await addQuestion(SPIRAL_CURVES, "First?");
      const last = await addQuestion(SPIRAL_CURVES, "Last?");

      expect(await seam.moveQuestion(EDITOR, first.id, "up")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY THE FIRST QUESTION" },
      });
      expect(await seam.moveQuestion(EDITOR, last.id, "down")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY THE LAST QUESTION" },
      });
    });

    it("answers not found for a question that isn't there", async () => {
      expect(await seam.moveQuestion(EDITOR, UNKNOWN, "up")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleting a question", () => {
    it("takes it out of the quiz and closes the gap, keeping it, marked removed, for old attempts", async () => {
      const first = await addQuestion(SPIRAL_CURVES, "First?");
      const gone = await addQuestion(SPIRAL_CURVES, "Read the figure", {
        figure: await arm.uploadCardImage(PNG),
        correct: "C",
      });
      const third = await addQuestion(SPIRAL_CURVES, "Third?");

      const { result, appended } = await appendedBy(() => seam.deleteQuestion(EDITOR, gone.id));

      const { stamp: _, ...asItWas } = gone;
      expect(result).toEqual({
        ok: true,
        value: {
          question: { ...asItWas, quizId: SPIRAL_CURVES_QUIZ, removedAt: null },
          quizHidden: false,
        },
        tags: [],
      });
      expect((await quizOf(SPIRAL_CURVES)).questions.map((q) => [q.position, q.id])).toEqual([
        [1, first.id],
        [2, third.id],
      ]);
      // Kept with every field as it was, its figure too: an old attempt still shows it.
      expect(await stored(gone.id)).toEqual({
        ...asItWas,
        quizId: SPIRAL_CURVES_QUIZ,
        position: null,
        removedAt: expect.any(String),
      });
      expect(await arm.storedFile(gone.figure ?? "")).toEqual(PNG);
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "question",
          entityId: gone.id,
          action: "delete",
          before: { position: 2, removedAt: null },
          after: { position: null, removedAt: expect.any(String) },
        }),
      ]);
    });

    // No attempts are stored yet (ticket 11 stores them, with each score they
    // earned, and must test Best Scores against real attempts). Until then,
    // this is what keeps them: a delete changes no question's id, text,
    // choices or correct answer, only places and the removed marker, so an
    // old attempt's answers still match its questions and nothing is re-marked.
    it("changes no question but its place and the removed marker, the stand-in for Best Scores until ticket 11", async () => {
      const gone = await addQuestion(SPIRAL_CURVES, "Degree?", { correct: "B" });
      await addQuestion(SPIRAL_CURVES, "Another?", { correct: "D" });
      const withoutPlaces = (questions: Awaited<ReturnType<typeof arm.questions>>) =>
        questions
          .map(({ position: _, removedAt: __, ...kept }) => kept)
          .sort((a, b) => a.id.localeCompare(b.id));
      const before = await arm.questions();

      await seam.deleteQuestion(EDITOR, gone.id);

      const after = await arm.questions();
      expect(withoutPlaces(after)).toEqual(withoutPlaces(before));
      expect(after.map((question) => [question.question, question.position])).toEqual([
        ["Another?", 1],
        ["Degree?", null],
      ]);
    });

    it("makes a Visible quiz Hidden when its last question is deleted, and says so", async () => {
      const only = await addQuestion(SIMPLE_CURVES, "Only question?");

      const { result, appended } = await appendedBy(() => seam.deleteQuestion(OWNER, only.id));

      expect(result.ok && result.value.quizHidden).toBe(true);
      expect((await quizOf(SIMPLE_CURVES)).quiz?.visibility).toBe("hidden");
      expect(appended.map((record) => [record.entity, record.action, record.after])).toEqual([
        ["question", "delete", { position: null, removedAt: expect.any(String) }],
        ["quiz", "hide", { visibility: "hidden" }],
      ]);
      expect(appended[1]?.entityId).toBe(SIMPLE_CURVES_QUIZ);
    });

    it("leaves a Hidden quiz as it is when its last question is deleted", async () => {
      const only = await addQuestion(SPIRAL_CURVES, "Only question?");

      const result = await seam.deleteQuestion(EDITOR, only.id);

      expect(result.ok && result.value.quizHidden).toBe(false);
      expect((await quizOf(SPIRAL_CURVES)).quiz?.visibility).toBe("hidden");
    });

    it("can't edit, move or delete a removed question again", async () => {
      const gone = await addQuestion(SPIRAL_CURVES, "Gone?");
      await seam.deleteQuestion(EDITOR, gone.id);
      const fields = { question: "Back?", choices: CHOICES, correct: "A", explanation: "No." };

      const notFound = { ok: false, error: { kind: "not-found" } };
      expect(await seam.updateQuestion(EDITOR, { id: gone.id, ...fields })).toEqual(notFound);
      expect(await seam.moveQuestion(EDITOR, gone.id, "up")).toEqual(notFound);
      expect(await seam.deleteQuestion(EDITOR, gone.id)).toEqual(notFound);
      expect(await seam.getQuestionFigureForAdmin(EDITOR, gone.id)).toBeNull();
    });

    it("answers not found for a question that isn't there, or an address that isn't one", async () => {
      expect(await seam.deleteQuestion(EDITOR, UNKNOWN)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.deleteQuestion(EDITOR, "not-a-question")).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importExampleZip, QUIZ_IMPORT_TEMPLATE_CSV } from "@/lib/content-import/template";
import type { ImportPreview } from "@/services/admin.types";
import type { Question } from "@/services/content.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";
import { importCsv, importZip, quizCsv } from "../../test/import-files";
import { imageBytes, textBytes } from "../../test/image-bytes";

// The Admin seam's quiz import (Phase 3, ticket 09; spec, Phase 3 →
// Spreadsheet import, Corrections never cost progress; stories 119–124,
// 133l), run against every arm: the card import's flow (ticket 06) with quiz
// rows. The sample data's CE MSTC Topics: Simple Curves (a Visible quiz with
// no questions), Spiral Curves (a Hidden quiz), Surveying (empty) and Algebra
// (a deck, no quiz); PSAD has none.

const EDITOR = sampleActor("editor");
const PNG = imageBytes("image/png", 80);
const JPEG = imageBytes("image/jpeg", 90);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
const SIMPLE_CURVES_QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");

const MSTC = { exam: "ce", subject: "mstc", mode: "add" } as const;

/** A quiz row: a valid question about `question` unless cells are given, in the template's order. */
function row(
  topic: string,
  question: string,
  {
    choices = ["1", "2", "3", "4"],
    correct = "A",
    explanation = "Because.",
    figure = "",
  }: { choices?: string[]; correct?: string; explanation?: string; figure?: string } = {},
) {
  return [topic, question, ...choices, correct, explanation, figure].join(",");
}

describe.each(ADMIN_ARMS)("Admin seam: quiz import ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** MSTC's Topics, in order: each one's name and what its quiz is. */
  async function mstcTopics() {
    const list = await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC");
    return list?.topics.map((topic) => [topic.name, topic.content.quiz]);
  }

  /** The questions in a quiz, in order, and those taken out of it. */
  async function questionsOf(quizId: string | undefined) {
    const all = (await arm.questions()).filter((question) => question.quizId === quizId);
    return {
      live: all.filter((question) => question.removedAt === null),
      removed: all.filter((question) => question.removedAt !== null),
    };
  }

  /** Uploads the files and checks them, as "Check file" does. */
  async function check(
    rows: string[],
    options: { zip?: Uint8Array | null; mode?: "replace" | "add"; csv?: Uint8Array } = {},
  ) {
    const paths = await arm.uploadImport({
      csv: options.csv ?? quizCsv(rows),
      zip: options.zip ?? null,
    });
    const input = { ...MSTC, mode: options.mode ?? MSTC.mode, ...paths };
    const planned = await seam.planQuizImport(EDITOR, input);
    if (!planned.ok) throw new Error(`refused: ${JSON.stringify(planned.error)}`);
    return { input, preview: planned.value };
  }

  /** Checks the files, then imports them, as "Import" does. */
  async function importRows(
    rows: string[],
    options: { zip?: Uint8Array | null; mode?: "replace" | "add" } = {},
  ) {
    const { input, preview } = await check(rows, options);
    const confirmed = await seam.confirmQuizImport(EDITOR, { ...input, basedOn: preview.basedOn });
    if (!confirmed.ok) throw new Error(`refused: ${JSON.stringify(confirmed.error)}`);
    return confirmed;
  }

  const ROWS = [
    row("Simple Curves", "Degree of a 200 m curve?", { explanation: "$D = 1145.916/R$" }),
    row("Highways", "Superelevation?", { correct: "c", figure: "curve.png" }),
    row("Simple Curve", "Length of curve?", { choices: ["$L$", "$2L$", "$L/2$", "0"] }),
    row("Highways", "Sight distance?", { correct: "D", figure: "images/brake.jpg" }),
  ];
  const ZIP = () => importZip({ "curve.png": PNG, "images/brake.jpg": JPEG });

  describe("planQuizImport", () => {
    it("previews each Topic with its counts and quiz, a rename hint, and saves nothing", async () => {
      const before = await mstcTopics();
      const { preview } = await check(ROWS, { zip: ZIP() });

      expect(preview).toEqual({
        exam: { code: "CE", name: "Civil Engineering" },
        subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
        mode: "add",
        topics: [
          {
            name: "Simple Curves",
            topicId: SIMPLE_CURVES,
            similarTo: null,
            content: "visible",
            mode: "add",
            counts: { add: 1, replace: 0, keep: 0, remove: 0 },
          },
          {
            name: "Highways",
            topicId: null,
            similarTo: null,
            content: "new",
            mode: "add",
            counts: { add: 2, replace: 0, keep: 0, remove: 0 },
          },
          {
            name: "Simple Curve",
            topicId: null,
            similarTo: "Simple Curves",
            content: "new",
            mode: "add",
            counts: { add: 1, replace: 0, keep: 0, remove: 0 },
          },
        ],
        problems: [],
        basedOn: expect.stringMatching(/^[0-9a-f]{64}$/),
      } satisfies ImportPreview);
      expect(await mstcTopics()).toEqual(before);
      expect(await arm.questions()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("reports each row's problems with its row and column", async () => {
      const { preview } = await check(
        [
          row("T", "Bad answer", { correct: "E" }),
          row("T", "No answer", { correct: "" }),
          row("T", "Missing choice", { choices: ["1", "", "3", "4"] }),
          row("T", "Half is $\\frac{1}{$"),
          row("T", "Beam", { figure: "beam.png" }),
        ],
        { zip: ZIP() },
      );

      expect(preview.problems).toEqual([
        { file: "csv", row: 2, column: "correct answer", message: "is “E”: write A, B, C or D" },
        {
          file: "csv",
          row: 3,
          column: "correct answer",
          message: "is blank: write the correct choice, A, B, C or D",
        },
        {
          file: "csv",
          row: 4,
          column: "choice b",
          message: "is blank: every question needs four choices",
        },
        {
          file: "csv",
          row: 5,
          column: "question",
          message:
            "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
        },
        { file: "csv", row: 6, column: "figure", message: "“beam.png” isn’t in the zip" },
      ]);
    });

    it("reports a card CSV checked as a quiz, naming the columns it lacks", async () => {
      const { preview } = await check([], { csv: importCsv(["T,f,b,,"]) });

      expect(preview.topics).toEqual([]);
      expect(preview.problems).toContainEqual({
        file: "csv",
        row: 1,
        column: "question",
        message: "is missing from the header row",
      });
    });

    it("reports a figure that isn't really the image its name says", async () => {
      const { preview } = await check([row("T", "Q", { figure: "fake.png" })], {
        zip: importZip({ "fake.png": textBytes(40) }),
      });

      expect(preview.problems).toEqual([
        {
          file: "csv",
          row: 2,
          column: "figure",
          message: "“fake.png” in the zip isn’t really a PNG image",
        },
      ]);
    });

    it("asks for files that haven't been uploaded yet", async () => {
      const paths = await arm.uploadImport({
        csv: quizCsv([row("T", "Q")]),
        zip: ZIP(),
        send: false,
      });

      expect(await seam.planQuizImport(EDITOR, { ...MSTC, ...paths })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            csv: ["UPLOAD THE CSV FILE AGAIN"],
            zip: ["UPLOAD THE ZIP OF FIGURES AGAIN"],
          },
        },
      });
    });

    it("answers not found for a Subject that isn't in the catalogue", async () => {
      const paths = await arm.uploadImport({ csv: quizCsv([row("T", "Q")]) });

      expect(await seam.planQuizImport(EDITOR, { ...MSTC, subject: "zzz", ...paths })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("confirmQuizImport", () => {
    it("creates the missing Topics and Hidden quizzes with the default settings, questions in order and figures stored privately", async () => {
      const confirmed = await importRows(ROWS, { zip: ZIP() });

      expect(confirmed.tags).toEqual([]);
      expect(await mstcTopics()).toEqual([
        // Its quiz was already Visible, and stays so.
        ["Simple Curves", "visible"],
        ["Spiral Curves", "hidden"],
        ["Surveying", null],
        ["Algebra", null],
        ["Highways", "hidden"],
        ["Simple Curve", "hidden"],
      ]);
      const [simple, highways, simpleCurve] = confirmed.value.topics;
      expect(simple).toMatchObject({ topicId: SIMPLE_CURVES, contentId: SIMPLE_CURVES_QUIZ });
      expect(highways).toMatchObject({ created: true, counts: { add: 2 } });

      const quizzes = await arm.quizzes();
      for (const topic of [highways, simpleCurve]) {
        expect(quizzes.find((quiz) => quiz.id === topic?.contentId)).toEqual({
          id: topic?.contentId,
          topicId: topic?.topicId,
          visibility: "hidden",
          freePreview: false,
          passingScore: 70,
          shuffle: true,
          showAnswers: true,
        });
      }

      const { live } = await questionsOf(highways?.contentId);
      expect(live).toEqual([
        {
          id: expect.stringMatching(new RegExp(`^${UUID}$`)),
          quizId: highways?.contentId,
          position: 1,
          question: "Superelevation?",
          choices: { A: "1", B: "2", C: "3", D: "4" },
          correct: "C",
          explanation: "Because.",
          figure: expect.stringMatching(
            new RegExp(`^quizzes/${highways?.contentId}/${UUID}\\.png$`),
          ),
          removedAt: null,
        },
        expect.objectContaining({
          position: 2,
          question: "Sight distance?",
          correct: "D",
          figure: expect.stringMatching(
            new RegExp(`^quizzes/${highways?.contentId}/${UUID}\\.jpg$`),
          ),
        }),
      ] satisfies Question[]);
      expect(await arm.storedFile(live[0]?.figure ?? "")).toEqual(PNG);
      expect(await arm.storedFile(live[1]?.figure ?? "")).toEqual(JPEG);
    });

    it("records the import in Staff Activity with each Topic's counts", async () => {
      const confirmed = await importRows(ROWS, { zip: ZIP() });

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: expect.any(String),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "quiz-import",
          entityId: "CE:MSTC",
          action: "import",
          before: null,
          after: {
            exam: "CE",
            subject: "MSTC",
            mode: "add",
            topics: confirmed.value.topics.map(({ topicId, contentId, name, created, counts }) => ({
              topicId,
              quizId: contentId,
              name,
              created,
              ...counts,
            })),
          },
        },
      ]);
    });

    it("Replace keeps the quiz, its settings and the id of each question whose text is unchanged, and marks the rest removed, never deleting them", async () => {
      const first = await importRows(
        [
          row("Surveying", "Bearing?"),
          row("Surveying", "Azimuth?", { correct: "B" }),
          row("Surveying", "Traverse?", { figure: "curve.png" }),
        ],
        { zip: ZIP() },
      );
      const quizId = first.value.topics[0]?.contentId;
      const quizBefore = (await arm.quizzes()).find((quiz) => quiz.id === quizId);
      const { live: before } = await questionsOf(quizId);
      const id = (question: string) => before.find((q) => q.question === question)?.id;
      const traverse = before.find((q) => q.question === "Traverse?");

      const second = await importRows(
        [
          row("Surveying", "Azimuth?", { correct: "B" }),
          row("Surveying", "  Bearing? ", { correct: "D", explanation: "Corrected." }),
          row("Surveying", "Stadia?"),
        ],
        { mode: "replace" },
      );

      expect(second.value.topics[0]).toMatchObject({
        topicId: SURVEYING,
        contentId: quizId,
        created: false,
        counts: { add: 1, replace: 1, keep: 1, remove: 1 },
      });
      expect((await arm.quizzes()).find((quiz) => quiz.id === quizId)).toEqual(quizBefore);
      const { live, removed } = await questionsOf(quizId);
      expect(live.map((q) => [q.position, q.id === id(q.question), q.question, q.correct])).toEqual(
        [
          [1, true, "Azimuth?", "B"],
          [2, true, "Bearing?", "D"],
          [3, false, "Stadia?", "A"],
        ],
      );
      // Taken out of the quiz, but kept, figure and all, for the attempts that answered it.
      expect(removed).toEqual([{ ...traverse, position: null, removedAt: expect.any(String) }]);
      expect(await arm.storedFile(traverse?.figure ?? "")).toEqual(PNG);
    });

    it("Replace gives a kept question its new figure, or none, and deletes the old one", async () => {
      await importRows(
        [row("Surveying", "Bearing?", { figure: "curve.png" }), row("Surveying", "Azimuth?")],
        { zip: ZIP() },
      );
      const quizId = (await arm.quizzes()).find((quiz) => quiz.topicId === SURVEYING)?.id;
      const [bearing] = (await questionsOf(quizId)).live;

      await importRows([row("Surveying", "Bearing?"), row("Surveying", "Azimuth?")], {
        mode: "replace",
      });

      const { live, removed } = await questionsOf(quizId);
      expect(live.map((q) => [q.id === bearing?.id, q.figure])).toEqual([
        [true, null],
        [false, null],
      ]);
      expect(removed).toEqual([]);
      expect(await arm.storedFile(bearing?.figure ?? "")).toBeNull();
    });

    it("Add appends after the existing questions, keeping them all", async () => {
      await importRows([row("Surveying", "Bearing?"), row("Surveying", "Azimuth?")]);
      const quizId = (await arm.quizzes()).find((quiz) => quiz.topicId === SURVEYING)?.id;
      const { live: before } = await questionsOf(quizId);

      const added = await importRows([row("Surveying", "Bearing?")], { mode: "add" });

      expect(added.value.topics[0]?.counts).toEqual({ add: 1, replace: 0, keep: 2, remove: 0 });
      const { live, removed } = await questionsOf(quizId);
      expect(live.map((q) => [q.position, q.question])).toEqual([
        [1, "Bearing?"],
        [2, "Azimuth?"],
        [3, "Bearing?"],
      ]);
      expect(live.slice(0, 2)).toEqual(before);
      expect(removed).toEqual([]);
    });

    it("refuses a preview with problems on the server, saving nothing", async () => {
      const { input, preview } = await check([row("T", "Q", { correct: "E" })]);
      expect(preview.problems).toHaveLength(1);

      expect(await seam.confirmQuizImport(EDITOR, { ...input, basedOn: preview.basedOn })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "FIX THE PROBLEMS IN THE FILE, THEN CHECK IT AGAIN",
        },
      });
      expect(await arm.questions()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a conflict when the Subject's questions changed since the preview, saving nothing", async () => {
      const { input, preview } = await check([row("Surveying", "Bearing?")]);
      await importRows([row("Algebra", "Quadratic formula?")]);
      const between = await arm.questions();

      expect(await seam.confirmQuizImport(EDITOR, { ...input, basedOn: preview.basedOn })).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: null, savedAt: expect.any(String) },
      });
      expect(await arm.questions()).toEqual(between);
    });

    it("refuses a conflict for another mode or other files than the preview's", async () => {
      await importRows([row("Surveying", "Bearing?"), row("Surveying", "Azimuth?")]);
      const { input, preview } = await check([row("Surveying", "Bearing?")], { mode: "add" });
      const before = await arm.questions();

      expect(
        await seam.confirmQuizImport(EDITOR, {
          ...input,
          mode: "replace",
          basedOn: preview.basedOn,
        }),
      ).toMatchObject({ ok: false, error: { kind: "conflict" } });
      expect(await arm.questions()).toEqual(before);
    });

    it("saves nothing when the save fails halfway, and deletes the figures it stored", async () => {
      const { input, preview } = await check(ROWS, { zip: ZIP() });
      const topics = await mstcTopics();
      const quizzes = await arm.quizzes();
      const put = vi.spyOn(arm.contentFiles, "put");
      const remove = vi.spyOn(arm.contentFiles, "remove");
      const restore = await arm.breakStaffActivity();
      try {
        await expect(
          seam.confirmQuizImport(EDITOR, { ...input, basedOn: preview.basedOn }),
        ).rejects.toThrow();
      } finally {
        await restore();
      }

      expect(await mstcTopics()).toEqual(topics);
      expect(await arm.quizzes()).toEqual(quizzes);
      expect(await arm.questions()).toEqual([]);
      expect(await arm.staffActivity()).toEqual([]);
      const stored = put.mock.calls.map(([path]) => path);
      expect(stored).toHaveLength(2);
      expect(remove).toHaveBeenCalledWith(stored);
      for (const path of stored) expect(await arm.storedFile(path)).toBeNull();
    });

    it("imports the template unchanged, with its example figure", async () => {
      const paths = await arm.uploadImport({
        csv: new TextEncoder().encode(QUIZ_IMPORT_TEMPLATE_CSV),
        zip: importExampleZip(),
      });
      const input = { exam: "ce", subject: "psad", mode: "add", ...paths } as const;
      const planned = await seam.planQuizImport(EDITOR, input);
      if (!planned.ok) throw new Error(JSON.stringify(planned.error));
      expect(planned.value.problems).toEqual([]);

      const confirmed = await seam.confirmQuizImport(EDITOR, {
        ...input,
        basedOn: planned.value.basedOn,
      });

      expect(confirmed.ok).toBe(true);
      const questions = await arm.questions();
      expect(questions.map((q) => [q.position, q.correct, q.figure !== null])).toEqual([
        [1, "A", false],
        [2, "B", true],
      ]);
    });
  });
});

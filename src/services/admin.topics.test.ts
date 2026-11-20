import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sampleTopicId } from "@/services/mock/content";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor, withUnusedExam } from "../../test/admin-inputs";

// The Admin seam's Topics (spec, Phase 3 planning decisions → Topics editor;
// story 133n), run against every arm: each Subject's Topics list, where any
// Staff User adds, renames, moves and deletes Topics, and the Topic content
// that blocks deleting an Exam or Subject. The sample data's CE Topics: MSTC
// has Simple Curves (a deck, quiz and Reviewer PDF), Spiral Curves, Surveying
// (empty) and Algebra (a Hidden deck only); HPGE has three; PSAD none.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const LATER = new Date(BOOT.getTime() + 60_000);

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const topic = (name: string, subject = "MSTC") => sampleTopicId("CE", subject, name);
const SIMPLE_CURVES = topic("Simple Curves");
const SPIRAL_CURVES = topic("Spiral Curves");
const SURVEYING = topic("Surveying");
const ALGEBRA = topic("Algebra");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const EMPTY = { deck: null, quiz: null, reviewerPdf: null };

describe.each(ADMIN_ARMS)("Admin seam: Topics ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The names of MSTC's Topics, in order. */
  async function mstcNames() {
    const list = await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC");
    return list?.topics.map((t) => [t.position, t.name]);
  }

  describe("listTopicsForAdmin", () => {
    it("gives a Subject's Topics in order, each with what it holds and why it can't be deleted", async () => {
      const list = await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC");

      expect(list?.exam).toEqual({ code: "CE", board: "CELE", name: "Civil Engineering" });
      expect(list?.subject).toEqual({
        code: "MSTC",
        name: "Mathematics, Surveying & Transportation Engineering",
      });
      expect(list?.topics).toEqual([
        {
          id: SIMPLE_CURVES,
          name: "Simple Curves",
          position: 1,
          content: { deck: "visible", quiz: "visible", reviewerPdf: "published" },
          deleteBlocker:
            "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
          stamp: { savedAt: BOOT.toISOString(), savedBy: null },
        },
        expect.objectContaining({
          id: SPIRAL_CURVES,
          position: 2,
          content: { deck: "visible", quiz: "hidden", reviewerPdf: "draft" },
        }),
        expect.objectContaining({
          id: SURVEYING,
          position: 3,
          content: EMPTY,
          deleteBlocker: null,
        }),
        expect.objectContaining({
          id: ALGEBRA,
          position: 4,
          content: { deck: "hidden", quiz: null, reviewerPdf: null },
          deleteBlocker: "It has a deck. Only an empty Topic can be deleted.",
        }),
      ]);
    });

    it("reads the codes whatever their case", async () => {
      expect(await seam.listTopicsForAdmin(EDITOR, "ce", "mstc")).toEqual(
        await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC"),
      );
    });

    it("gives a Subject with no Topics an empty list", async () => {
      expect(await seam.listTopicsForAdmin(OWNER, "CE", "PSAD")).toMatchObject({ topics: [] });
    });

    it.each([
      ["an unknown Exam", "XX", "MSTC"],
      ["another Exam's Subject", "ME", "MSTC"],
      ["an unknown Subject", "CE", "NOPE"],
    ])("gives nothing for %s", async (_case, exam, subject) => {
      expect(await seam.listTopicsForAdmin(EDITOR, exam, subject)).toBeNull();
    });
  });

  describe("createTopic", () => {
    it("adds an empty Topic last in its Subject, its name trimmed, for an Editor", async () => {
      vi.setSystemTime(LATER);
      const result = await seam.createTopic(EDITOR, {
        exam: "ce",
        subject: "mstc",
        name: "  Transportation   Engineering ",
      });

      expect(result).toMatchObject({
        ok: true,
        value: {
          name: "Transportation Engineering",
          position: 5,
          content: EMPTY,
          deleteBlocker: null,
        },
        tags: [],
      });
      expect(await mstcNames()).toEqual([
        [1, "Simple Curves"],
        [2, "Spiral Curves"],
        [3, "Surveying"],
        [4, "Algebra"],
        [5, "Transportation Engineering"],
      ]);
      const id = result.ok ? result.value.id : "";
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: LATER.toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "topic",
          entityId: id,
          action: "add",
          before: null,
          after: {
            id,
            examCode: "CE",
            subjectCode: "MSTC",
            name: "Transportation Engineering",
            position: 5,
          },
        },
      ]);
    });

    it("adds the first Topic of a Subject with none", async () => {
      await seam.createTopic(OWNER, { exam: "CE", subject: "PSAD", name: "Steel Design" });
      expect(await seam.listTopicsForAdmin(OWNER, "CE", "PSAD")).toMatchObject({
        topics: [{ name: "Steel Design", position: 1 }],
      });
    });

    it("refuses a name already in the Subject, ignoring case, and adds nothing", async () => {
      expect(
        await seam.createTopic(EDITOR, { exam: "CE", subject: "MSTC", name: "simple CURVES" }),
      ).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { name: ["MSTC ALREADY HAS A TOPIC CALLED “simple CURVES”"] },
        },
      });
      expect(await mstcNames()).toHaveLength(4);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("allows a name another Subject uses", async () => {
      const result = await seam.createTopic(EDITOR, {
        exam: "CE",
        subject: "HPGE",
        name: "Simple Curves",
      });
      expect(result).toMatchObject({ ok: true, value: { name: "Simple Curves" } });
    });

    it.each([
      ["a blank name", "   ", "ENTER THE TOPIC’S NAME"],
      ["a name over 120 characters", "x".repeat(121), "KEEP IT TO 120 CHARACTERS"],
    ])("refuses %s", async (_case, name, message) => {
      expect(await seam.createTopic(EDITOR, { exam: "CE", subject: "MSTC", name })).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { name: [message] } },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("accepts a name of exactly 120 characters", async () => {
      const name = "x".repeat(120);
      expect(await seam.createTopic(EDITOR, { exam: "CE", subject: "MSTC", name })).toMatchObject({
        ok: true,
        value: { name },
      });
    });

    it("answers not-found for a Subject that isn't in the catalogue", async () => {
      expect(
        await seam.createTopic(EDITOR, { exam: "CE", subject: "NOPE", name: "Statics" }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("renameTopic", () => {
    it("renames a Topic, keeping its id and place, and stamps the save", async () => {
      vi.setSystemTime(LATER);
      const result = await seam.renameTopic(
        EDITOR,
        { id: SURVEYING, name: "Surveying & Leveling" },
        { savedAt: BOOT.toISOString() },
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          id: SURVEYING,
          name: "Surveying & Leveling",
          position: 3,
          stamp: { savedAt: LATER.toISOString(), savedBy: EDITOR.name },
        },
        tags: [],
      });
      expect(await mstcNames()).toContainEqual([3, "Surveying & Leveling"]);
      expect(await arm.staffActivity()).toMatchObject([
        {
          entity: "topic",
          entityId: SURVEYING,
          action: "rename",
          before: { name: "Surveying" },
          after: { name: "Surveying & Leveling" },
        },
      ]);
    });

    it("answers conflict when the name was saved after the editor opened it", async () => {
      vi.setSystemTime(LATER);
      await seam.renameTopic(OWNER, { id: SURVEYING, name: "Leveling" });

      expect(
        await seam.renameTopic(
          EDITOR,
          { id: SURVEYING, name: "Route Surveying" },
          { savedAt: BOOT.toISOString() },
        ),
      ).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: LATER.toISOString() },
      });
      expect(await mstcNames()).toContainEqual([3, "Leveling"]);
    });

    it("refuses another Topic's name in the Subject, ignoring case", async () => {
      expect(await seam.renameTopic(EDITOR, { id: SURVEYING, name: "ALGEBRA" })).toMatchObject({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { name: ["MSTC ALREADY HAS A TOPIC CALLED “ALGEBRA”"] },
        },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("allows a change of case to the Topic's own name", async () => {
      expect(await seam.renameTopic(EDITOR, { id: SURVEYING, name: "SURVEYING" })).toMatchObject({
        ok: true,
        value: { name: "SURVEYING" },
      });
    });

    it("answers not-found for a Topic that's gone, and refuses an id that isn't one", async () => {
      expect(await seam.renameTopic(EDITOR, { id: UNKNOWN, name: "Statics" })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.renameTopic(EDITOR, { id: "surveying", name: "Statics" })).toMatchObject({
        ok: false,
        error: { kind: "invalid" },
      });
    });
  });

  describe("moveTopic", () => {
    it("moves a Topic one place later, and gives the Subject's new order", async () => {
      vi.setSystemTime(LATER);
      expect(await seam.moveTopic(EDITOR, SIMPLE_CURVES, "down")).toEqual({
        ok: true,
        value: [SPIRAL_CURVES, SIMPLE_CURVES, SURVEYING, ALGEBRA],
        tags: [],
      });
      expect(await mstcNames()).toEqual([
        [1, "Spiral Curves"],
        [2, "Simple Curves"],
        [3, "Surveying"],
        [4, "Algebra"],
      ]);
      expect(await arm.staffActivity()).toMatchObject([
        {
          entity: "topic",
          entityId: SIMPLE_CURVES,
          action: "move",
          before: [SIMPLE_CURVES, SPIRAL_CURVES, SURVEYING, ALGEBRA],
          after: [SPIRAL_CURVES, SIMPLE_CURVES, SURVEYING, ALGEBRA],
        },
      ]);
    });

    it("moves a Topic one place earlier", async () => {
      await seam.moveTopic(OWNER, ALGEBRA, "up");
      expect(await mstcNames()).toEqual([
        [1, "Simple Curves"],
        [2, "Spiral Curves"],
        [3, "Algebra"],
        [4, "Surveying"],
      ]);
    });

    it.each([
      ["the first up", SIMPLE_CURVES, "up", "IT’S ALREADY FIRST IN ITS SUBJECT"],
      ["the last down", ALGEBRA, "down", "IT’S ALREADY LAST IN ITS SUBJECT"],
    ] as const)("refuses to move %s", async (_case, id, direction, formError) => {
      expect(await seam.moveTopic(EDITOR, id, direction)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("answers not-found for a Topic that's gone", async () => {
      expect(await seam.moveTopic(EDITOR, UNKNOWN, "up")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleteTopic", () => {
    it("deletes an empty Topic, closes the gap, and keeps its values in Staff Activity", async () => {
      expect(await seam.deleteTopic(EDITOR, SURVEYING)).toEqual({
        ok: true,
        value: {
          id: SURVEYING,
          examCode: "CE",
          subjectCode: "MSTC",
          name: "Surveying",
          position: 3,
        },
        tags: [],
      });
      expect(await mstcNames()).toEqual([
        [1, "Simple Curves"],
        [2, "Spiral Curves"],
        [3, "Algebra"],
      ]);
      expect(await arm.staffActivity()).toMatchObject([
        { entity: "topic", entityId: SURVEYING, action: "delete", after: null },
      ]);
    });

    it.each([
      [
        "a deck, quiz and Reviewer PDF",
        SIMPLE_CURVES,
        "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
      ],
      ["only a Hidden deck", ALGEBRA, "It has a deck. Only an empty Topic can be deleted."],
    ])("refuses a Topic with %s, and deletes nothing", async (_case, id, formError) => {
      expect(await seam.deleteTopic(EDITOR, id)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError },
      });
      expect(await mstcNames()).toHaveLength(4);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a Topic that was given content after the list was read", async () => {
      await arm.putContent("quiz", SURVEYING);
      expect(await seam.deleteTopic(EDITOR, SURVEYING)).toMatchObject({
        ok: false,
        error: { formError: "It has a quiz. Only an empty Topic can be deleted." },
      });
    });

    it("answers not-found for a Topic that's gone", async () => {
      expect(await seam.deleteTopic(EDITOR, UNKNOWN)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("Topic content and deleting Exams and Subjects", () => {
    /** CHE (PCHEM and THERMO, no Products), with an empty THERMO Topic. */
    async function cheWithTopic() {
      await arm.reset(withUnusedExam);
      const made = await seam.createTopic(OWNER, {
        exam: "CHE",
        subject: "THERMO",
        name: "Entropy",
      });
      if (!made.ok) throw new Error("The Topic wasn't made");
      return made.value.id;
    }

    it("gives the Exam page the content each Subject's Topics hold, Hidden and Draft included", async () => {
      const page = await seam.getExamPageForAdmin(EDITOR, "CE");
      expect(page?.subjectContent).toEqual({
        MSTC: { decks: 3, quizzes: 2, reviewerPdfs: 2 },
        HPGE: { decks: 2, quizzes: 1, reviewerPdfs: 1 },
        PSAD: { decks: 0, quizzes: 0, reviewerPdfs: 0 },
      });
      expect(page?.content).toEqual({ decks: 5, quizzes: 3, reviewerPdfs: 3 });
    });

    it("deletes a Subject whose Topics are empty, with its Topics, each in Staff Activity", async () => {
      const id = await cheWithTopic();
      expect(await seam.deleteSubject(OWNER, "CHE", "THERMO")).toMatchObject({ ok: true });
      expect(await seam.listTopicsForAdmin(OWNER, "CHE", "THERMO")).toBeNull();
      expect(await arm.staffActivity()).toContainEqual(
        expect.objectContaining({
          entity: "topic",
          entityId: id,
          action: "delete",
          before: expect.objectContaining({ name: "Entropy" }),
          after: null,
        }),
      );

      // Adding the Subject back brings no Topic back.
      await seam.addSubject(OWNER, "CHE", { code: "THERMO", name: "Thermodynamics" });
      expect(await seam.listTopicsForAdmin(OWNER, "CHE", "THERMO")).toMatchObject({ topics: [] });
    });

    it("refuses to delete a Subject whose Topics hold content, saying what", async () => {
      const id = await cheWithTopic();
      await arm.putContent("deck", id);

      expect(await seam.deleteSubject(OWNER, "CHE", "THERMO")).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "THERMO has Member App content: 1 deck. Delete it first.",
        },
      });
      expect(await seam.listTopicsForAdmin(OWNER, "CHE", "THERMO")).toMatchObject({
        topics: [{ id }],
      });
    });

    it("refuses to delete an Exam whose Topics hold content, saying what", async () => {
      const id = await cheWithTopic();
      await arm.putContent("reviewer-pdf", id);

      expect(await seam.deleteExam(OWNER, "CHE")).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "CHE has Member App content: 1 Reviewer PDF. Delete it first.",
        },
      });
      expect(await seam.getExamPageForAdmin(OWNER, "CHE")).toMatchObject({
        content: { decks: 0, quizzes: 0, reviewerPdfs: 1 },
        subjectContent: { THERMO: { reviewerPdfs: 1 }, PCHEM: { reviewerPdfs: 0 } },
      });
    });

    it("deletes an Exam whose Topics are empty, with its Topics, each in Staff Activity", async () => {
      const id = await cheWithTopic();
      expect(await seam.deleteExam(OWNER, "CHE")).toMatchObject({ ok: true });
      expect(await seam.listTopicsForAdmin(OWNER, "CHE", "THERMO")).toBeNull();
      expect(await arm.staffActivity()).toContainEqual(
        expect.objectContaining({ entity: "topic", entityId: id, action: "delete" }),
      );
    });
  });
});

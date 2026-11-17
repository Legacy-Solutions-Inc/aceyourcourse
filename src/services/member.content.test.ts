import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";

import { sampleActor, UNUSED_EXAM, withUnusedExam } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";

// The Member seam's content reads (spec, Phase 3 → Content model and Access
// decision seam), run against every arm: an Exam's Library, one content item
// as opening it needs, and a Member's Access Passes. The sample data has CE
// Topics in MSTC and HPGE with a mix of Visible, Hidden, Free Preview and
// empty items; the Beta Tester's CE pass ends 90 days after boot, the lapsed
// tester's ended 3 days before, and the stranger has none.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const topic = (subject: string, name: string) => sampleTopicId("CE", subject, name);
const SIMPLE_CURVES = topic("MSTC", "Simple Curves");
const SPIRAL_CURVES = topic("MSTC", "Spiral Curves");
const HYDROSTATICS = topic("HPGE", "Hydrostatics");
const SURVEYING = topic("MSTC", "Surveying");
const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");

describe.each(MEMBER_ARMS)("Member seam content ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getLibrary", () => {
    it("lists every Subject of the Exam in order, each with its Topics in order", async () => {
      const library = await seam.getLibrary("CE");

      expect(library.map((subject) => subject.code)).toEqual(["MSTC", "HPGE", "PSAD"]);
      expect(library[0]?.name).toBe("Mathematics, Surveying & Transportation Engineering");
      expect(library.map((subject) => subject.topics.map((t) => [t.position, t.name]))).toEqual([
        [
          [1, "Simple Curves"],
          [2, "Spiral Curves"],
          [3, "Surveying"],
          [4, "Algebra"],
        ],
        [
          [1, "Hydrostatics"],
          [2, "Soil Mechanics"],
          [3, "Fluid Properties"],
        ],
        [],
      ]);
    });

    it("gives each Topic its Visible decks and quizzes and Published Reviewer PDFs, with their Free Preview flag", async () => {
      const [mstc, hpge] = await seam.getLibrary("CE");

      expect(mstc?.topics[0]).toEqual({
        id: SIMPLE_CURVES,
        name: "Simple Curves",
        position: 1,
        items: [
          { kind: "deck", id: sampleContentId(SIMPLE_CURVES, "deck"), freePreview: true },
          { kind: "quiz", id: sampleContentId(SIMPLE_CURVES, "quiz"), freePreview: false },
          {
            kind: "reviewer-pdf",
            id: sampleContentId(SIMPLE_CURVES, "reviewer-pdf"),
            freePreview: false,
          },
        ],
      });
      expect(hpge?.topics[0]?.items).toEqual([
        { kind: "deck", id: sampleContentId(HYDROSTATICS, "deck"), freePreview: false },
        { kind: "quiz", id: sampleContentId(HYDROSTATICS, "quiz"), freePreview: true },
      ]);
    });

    it("never lists Hidden decks and quizzes, or Reviewer PDFs that aren't Published", async () => {
      const [mstc, hpge] = await seam.getLibrary("CE");

      // Spiral Curves: a Visible deck, a Hidden quiz and a Draft Reviewer PDF.
      expect(mstc?.topics[1]?.items).toEqual([
        { kind: "deck", id: sampleContentId(SPIRAL_CURVES, "deck"), freePreview: false },
      ]);
      // Algebra has only a Hidden deck; Soil Mechanics a Hidden deck and a Published Reviewer PDF.
      expect(mstc?.topics[3]?.items).toEqual([]);
      expect(hpge?.topics[1]?.items.map((item) => item.kind)).toEqual(["reviewer-pdf"]);
    });

    it("gives an empty Topic no items: its content is still being prepared", async () => {
      const [mstc] = await seam.getLibrary("CE");
      expect(mstc?.topics[2]).toMatchObject({ name: "Surveying", items: [] });
    });

    it("reads the Exam's code whatever its case", async () => {
      expect(await seam.getLibrary("ce")).toEqual(await seam.getLibrary("CE"));
    });

    it("lists an Exam with no Topics yet as its Subjects with none", async () => {
      const library = await seam.getLibrary("ME");
      expect(library.map((subject) => [subject.code, subject.topics])).toEqual([
        ["PIP", []],
        ["MATH", []],
        ["MD", []],
      ]);
    });

    it.each(["XX", "", "not an exam code at all"])(
      "gives nothing for %j, which isn't an Exam",
      async (code) => {
        expect(await seam.getLibrary(code)).toEqual([]);
      },
    );
  });

  describe("the Library follows the Topics editor", () => {
    const mstc = async () =>
      (await seam.getLibrary("CE"))[0]?.topics.map((t) => [t.position, t.name]);

    it("shows a Topic an Editor adds, last in its Subject, empty", async () => {
      await arm.admin.createTopic(EDITOR, { exam: "CE", subject: "MSTC", name: "Highways" });
      expect(await mstc()).toEqual([
        [1, "Simple Curves"],
        [2, "Spiral Curves"],
        [3, "Surveying"],
        [4, "Algebra"],
        [5, "Highways"],
      ]);
    });

    it("shows a rename, a move and a delete, in order", async () => {
      await arm.admin.renameTopic(EDITOR, { id: SPIRAL_CURVES, name: "Spiral Easement Curves" });
      await arm.admin.moveTopic(EDITOR, SIMPLE_CURVES, "down");
      await arm.admin.deleteTopic(EDITOR, SURVEYING);

      expect(await mstc()).toEqual([
        [1, "Spiral Easement Curves"],
        [2, "Simple Curves"],
        [3, "Algebra"],
      ]);
      // A rename keeps the Topic's id, so its content (and later its progress) stays with it.
      const library = await seam.getLibrary("CE");
      expect(library[0]?.topics[0]).toMatchObject({ id: SPIRAL_CURVES, items: [{ kind: "deck" }] });
    });
  });

  describe("getContentItem", () => {
    it("gives a Visible Free Preview deck with where it sits", async () => {
      const id = sampleContentId(SIMPLE_CURVES, "deck");
      expect(await seam.getContentItem("deck", id)).toEqual({
        kind: "deck",
        id,
        examCode: "CE",
        subjectCode: "MSTC",
        subjectName: "Mathematics, Surveying & Transportation Engineering",
        topicId: SIMPLE_CURVES,
        topicName: "Simple Curves",
        available: true,
        freePreview: true,
      });
    });

    it("gives a Hidden quiz and a Draft Reviewer PDF as unavailable, so the Member is told", async () => {
      const quiz = await seam.getContentItem("quiz", sampleContentId(SPIRAL_CURVES, "quiz"));
      const pdf = await seam.getContentItem(
        "reviewer-pdf",
        sampleContentId(SPIRAL_CURVES, "reviewer-pdf"),
      );
      expect(quiz).toMatchObject({ topicName: "Spiral Curves", available: false });
      expect(pdf).toMatchObject({ topicName: "Spiral Curves", available: false });
    });

    it("gives a Published Reviewer PDF as available", async () => {
      const id = sampleContentId(SIMPLE_CURVES, "reviewer-pdf");
      expect(await seam.getContentItem("reviewer-pdf", id)).toMatchObject({
        kind: "reviewer-pdf",
        available: true,
        freePreview: false,
      });
    });

    it("gives nothing for an id of another kind", async () => {
      expect(await seam.getContentItem("quiz", sampleContentId(SIMPLE_CURVES, "deck"))).toBeNull();
    });

    it.each([
      ["an unknown id", "deck", "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b"],
      ["an id that isn't one", "deck", "simple-curves"],
      ["a kind that isn't one", "video", sampleContentId(SIMPLE_CURVES, "deck")],
    ])("gives nothing for %s", async (_case, kind, id) => {
      // What a browser sends in the address, unchecked.
      expect(await seam.getContentItem(kind as "deck", id)).toBeNull();
    });
  });

  describe("listAccessPasses", () => {
    it("gives the Member's own passes, each with its Exam and end", async () => {
      expect(await seam.listAccessPasses(sampleUserId("tester@example.com"))).toEqual([
        {
          userId: sampleUserId("tester@example.com"),
          examCode: "CE",
          endsAt: new Date(BOOT.getTime() + 90 * DAY).toISOString(),
        },
      ]);
    });

    it("gives an ended pass too: the access decision says it expired", async () => {
      expect(await seam.listAccessPasses(sampleUserId("lapsed@example.com"))).toEqual([
        {
          userId: sampleUserId("lapsed@example.com"),
          examCode: "CE",
          endsAt: new Date(BOOT.getTime() - 3 * DAY).toISOString(),
        },
      ]);
    });

    it("gives nothing to a Member with no pass, and never another Member's", async () => {
      expect(await seam.listAccessPasses(sampleUserId("stranger@example.com"))).toEqual([]);
    });

    it("refuses a User id that isn't one", async () => {
      await expect(seam.listAccessPasses("tester")).rejects.toThrow();
    });

    it("drops a pass for good when an Owner deletes its Exam", async () => {
      await arm.reset(withUnusedExam);
      const tester = sampleUserId("tester@example.com");
      const endsAt = new Date(BOOT.getTime() + 30 * DAY).toISOString();
      await arm.putAccessPass({ userId: tester, examCode: "CHE", endsAt });
      expect((await seam.listAccessPasses(tester)).map((pass) => pass.examCode)).toEqual([
        "CE",
        "CHE",
      ]);

      expect(await arm.admin.deleteExam(OWNER, "CHE")).toMatchObject({ ok: true });
      expect((await seam.listAccessPasses(tester)).map((pass) => pass.examCode)).toEqual(["CE"]);

      // An Exam added again with that code brings no pass back.
      expect(await arm.admin.createExam(OWNER, UNUSED_EXAM)).toMatchObject({ ok: true });
      expect((await seam.listAccessPasses(tester)).map((pass) => pass.examCode)).toEqual(["CE"]);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { headerFormValues, subjectFormValues } from "@/lib/admin/exam-page-form";
import type { NewExamForm } from "@/services/admin.schema";
import type { AdminExamPage, AdminResult, StaffActor } from "@/services/admin.types";
import { getExamByCode, getExamPage, listExams } from "@/services/catalogue";
import { MAX_EXAMS } from "@/services/catalogue.schema";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Admin seam's Exams and Subjects, run against every arm (ticket 23; spec,
// Phase 2 → "Adding Exams and Subjects"; stories 80d and 80e): an Owner adds
// an Exam with its Subjects, adds a Subject to any Exam, and deletes an Exam
// or a Subject that nothing uses yet. Codes are fixed once saved. A new Exam
// reaches the Website once one of its Products is on the Website. Each write
// is recorded in Staff Activity.

const BOOT = new Date("2026-10-22T03:42:00.000Z");
const MINUTE = 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
const OTHER_OWNER: StaffActor = { ...OWNER, email: "owner.two@example.com", name: "Owner Two" };

const CHE: NewExamForm = {
  code: "che",
  board: "chele",
  name: "Chemical Engineering",
  longName: "Chemical Engineer Licensure Exam",
  blurb: "Every ChE formula, in one place.",
  madeFor: "ChE reviewees",
  subjects: [
    { code: "PCHEM", name: "Physical Chemistry" },
    { code: "che prof", name: "ChE Professional Subjects" },
  ],
};

const SAVED_CHE = {
  code: "CHE",
  board: "CHELE",
  name: "Chemical Engineering",
  longName: "Chemical Engineer Licensure Exam",
  blurb: "Every ChE formula, in one place.",
  madeFor: "ChE reviewees",
  subjects: [
    { code: "PCHEM", name: "Physical Chemistry" },
    { code: "CHE PROF", name: "ChE Professional Subjects" },
  ],
};

const invalidCode = (message: string) => ({
  ok: false,
  error: { kind: "invalid", fieldErrors: { code: [message] } },
});
const formError = (message: string) => ({
  ok: false,
  error: { kind: "invalid", fieldErrors: {}, formError: message },
});
const FORBIDDEN = { ok: false, error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" } };

describe.each(ADMIN_ARMS)("Admin seam: Exams and Subjects ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const opened = async (code: string) => {
    const page = await seam.getExamPageForAdmin(EDITOR, code);
    if (!page) throw new Error(`${code} isn't in the catalogue`);
    return page;
  };
  const saved = <T>(result: AdminResult<T>): T => {
    if (!result.ok) throw new Error(`expected a save, got ${JSON.stringify(result)}`);
    return result.value;
  };
  const codes = async () => (await seam.listExamsForAdmin(EDITOR)).map((exam) => exam.code);
  const later = () => vi.setSystemTime(at(MINUTE));

  describe("createExam", () => {
    it("adds CHE last, with its Subjects and the default page, recorded in Staff Activity", async () => {
      later();
      const result = await seam.createExam(OWNER, CHE);

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exams"] });
      const page = saved(result);
      expect(page.exam).toEqual(SAVED_CHE);
      expect(page.page).toEqual({
        examCode: "CHE",
        sections: { subjects: true, bundleOffer: true, reviews: true },
        bundleOffer: null,
        seoTitle: null,
        seoDescription: null,
        shareImage: null,
        officialExamDate: null,
      });
      expect(page.products).toEqual([]);
      expect(page.stamps.header).toEqual({
        savedAt: at(MINUTE).toISOString(),
        savedBy: OWNER.name,
      });
      expect(await codes()).toEqual(["CE", "ME", "EE", "MT", "CPA", "CHE"]);
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "exam",
          entityId: "CHE",
          action: "add",
          before: null,
          after: SAVED_CHE,
        },
      ]);
    });

    it("is listed for the Product editor at once, and marked off the Website", async () => {
      saved(await seam.createExam(OWNER, CHE));

      expect((await seam.listExamsForAdmin(EDITOR)).at(-1)).toEqual(SAVED_CHE);
      const page = await opened("che");
      expect(page.examsOnWebsite).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    });

    it("stays off the Website until one of its Products is on it", async () => {
      saved(await seam.createExam(OWNER, CHE));

      expect((await listExams()).map((exam) => exam.code)).not.toContain("CHE");
      // Reached through the catalogue, as the Exam page's own read does.
      expect(await getExamByCode("che")).toMatchObject({ code: "CHE" });
      expect(await getExamPage("che")).toMatchObject({ examCode: "CHE" });
    });

    it("refuses an Editor, adding nothing", async () => {
      expect(await seam.createExam(EDITOR, CHE)).toEqual(FORBIDDEN);
      expect(await codes()).not.toContain("CHE");
      expect(await arm.staffActivity()).toEqual([]);
    });

    it.each(["C", "CHEMENG", "CH3", "C E"])("refuses the code %j", async (code) => {
      expect(await seam.createExam(OWNER, { ...CHE, code })).toEqual(
        invalidCode("USE 2–6 LETTERS"),
      );
    });

    it("refuses a code that's already an Exam, in any case", async () => {
      expect(await seam.createExam(OWNER, { ...CHE, code: "ce" })).toEqual(
        invalidCode("CE IS ALREADY AN EXAM"),
      );
    });

    it("refuses the second of two Owners adding the same code", async () => {
      saved(await seam.createExam(OWNER, CHE));
      later();

      const second = await seam.createExam(OTHER_OWNER, { ...CHE, name: "Chem Eng" });

      expect(second).toEqual(invalidCode("CHE IS ALREADY AN EXAM"));
      expect((await getExamByCode("che"))?.name).toBe("Chemical Engineering");
      expect(await arm.staffActivity()).toHaveLength(1);
    });

    it("refuses a form with no Subject, or a blank Subject name, with the field's message", async () => {
      expect(await seam.createExam(OWNER, { ...CHE, subjects: [] })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { subjects: ["ADD AT LEAST ONE SUBJECT"] } },
      });
      expect(
        await seam.createExam(OWNER, { ...CHE, subjects: [{ code: "PCHEM", name: "" }] }),
      ).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { "subjects.0.name": ["ADD THE SUBJECT’S NAME"] } },
      });
    });

    it("refuses a Header field one character over its limit", async () => {
      expect(await seam.createExam(OWNER, { ...CHE, madeFor: "x".repeat(161) })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { madeFor: ["KEEP IT TO 160 CHARACTERS"] } },
      });
    });

    it(`adds up to ${MAX_EXAMS} Exams and refuses a 13th`, async () => {
      for (const code of ["AA", "BB", "CC", "DD", "FF", "GG"])
        saved(await seam.createExam(OWNER, { ...CHE, code }));
      expect(await codes()).toHaveLength(11);
      saved(await seam.createExam(OWNER, { ...CHE, code: "HH" }));
      expect(await codes()).toHaveLength(MAX_EXAMS);

      expect(await seam.createExam(OWNER, CHE)).toEqual(
        formError("UP TO 12 EXAMS. Ask the developer to raise the limit."),
      );
      expect(await codes()).not.toContain("CHE");
    });
  });

  describe("addSubject", () => {
    it("adds THERMO last to CE, wherever the Website names CE's Subjects", async () => {
      later();
      const result = await seam.addSubject(OWNER, "ce", {
        code: " thermo ",
        name: "Thermodynamics",
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exams"] });
      expect(saved(result).exam.subjects.at(-1)).toEqual({
        code: "THERMO",
        name: "Thermodynamics",
      });
      expect((await getExamByCode("ce"))?.subjects.map((s) => s.code)).toEqual([
        "MSTC",
        "HPGE",
        "PSAD",
        "THERMO",
      ]);
      expect((await seam.listExamsForAdmin(EDITOR))[0]?.subjects).toHaveLength(4);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "exam",
          entityId: "CE",
          action: "add-subject",
          before: [
            expect.objectContaining({ code: "MSTC" }),
            expect.objectContaining({ code: "HPGE" }),
            expect.objectContaining({ code: "PSAD" }),
          ],
          after: expect.arrayContaining([{ code: "THERMO", name: "Thermodynamics" }]),
        }),
      ]);
    });

    it("makes the Subjects covered editor opened before it conflict", async () => {
      const stale = await opened("ce");
      later();
      saved(await seam.addSubject(OWNER, "ce", { code: "THERMO", name: "Thermodynamics" }));

      expect(
        await seam.updateSubjectNames(
          EDITOR,
          "ce",
          subjectFormValues(stale.exam),
          stale.stamps.subjects,
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
    });

    it("refuses an Editor", async () => {
      expect(await seam.addSubject(EDITOR, "ce", { code: "THERMO", name: "Thermo" })).toEqual(
        FORBIDDEN,
      );
    });

    it("refuses a code the Exam has, a bad code and a blank name", async () => {
      expect(await seam.addSubject(OWNER, "ce", { code: "mstc", name: "Maths" })).toEqual(
        invalidCode("MSTC IS ALREADY A CE SUBJECT"),
      );
      expect(await seam.addSubject(OWNER, "ce", { code: "X".repeat(21), name: "X" })).toEqual(
        invalidCode("USE 1–20 LETTERS, DIGITS, SPACES OR &"),
      );
      expect(await seam.addSubject(OWNER, "ce", { code: "THERMO", name: " " })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { name: ["ADD THE SUBJECT’S NAME"] } },
      });
    });

    it("answers not-found for an unknown Exam", async () => {
      expect(await seam.addSubject(OWNER, "zz", { code: "THERMO", name: "Thermo" })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleteSubject", () => {
    it("deletes a Subject no Product uses, recorded in Staff Activity", async () => {
      saved(await seam.addSubject(OWNER, "ce", { code: "THERMO", name: "Thermodynamics" }));
      later();

      const result = await seam.deleteSubject(OWNER, "ce", "thermo");

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exams"] });
      expect(saved(result).exam.subjects.map((s) => s.code)).toEqual(["MSTC", "HPGE", "PSAD"]);
      expect((await arm.staffActivity()).at(-1)).toMatchObject({
        entity: "exam",
        entityId: "CE",
        action: "delete-subject",
        after: ["MSTC", "HPGE", "PSAD"].map((code) => expect.objectContaining({ code })),
      });
    });

    it("refuses a Subject a Product is tagged with, giving the reason", async () => {
      const result = await seam.deleteSubject(OWNER, "ce", "MSTC");
      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "invalid",
          formError: expect.stringMatching(
            /^\d+ Products use MSTC\. Remove it from those Products first\.$/,
          ),
        },
      });
      expect((await getExamByCode("ce"))?.subjects).toHaveLength(3);
    });

    it("refuses the Exam's only Subject", async () => {
      saved(
        await seam.createExam(OWNER, {
          ...CHE,
          subjects: [CHE.subjects[0] ?? { code: "", name: "" }],
        }),
      );
      expect(await seam.deleteSubject(OWNER, "che", "PCHEM")).toEqual(
        formError("CHE needs at least one Subject. Add another before deleting this one."),
      );
    });

    it("refuses an Editor, and answers not-found for a Subject that isn't there", async () => {
      expect(await seam.deleteSubject(EDITOR, "ce", "MSTC")).toEqual(FORBIDDEN);
      expect(await seam.deleteSubject(OWNER, "ce", "THERMO")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleteExam", () => {
    it("deletes an Exam no Product belongs to, with its page record, recorded in Staff Activity", async () => {
      saved(await seam.createExam(OWNER, CHE));
      saved(await seam.setExamSection(EDITOR, "che", "reviews", false));
      later();

      const result = await seam.deleteExam(OWNER, "che");

      expect(result).toEqual({
        ok: true,
        value: SAVED_CHE,
        tags: ["catalogue:exams", "catalogue:exam-pages"],
      });
      expect(await codes()).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
      expect(await seam.getExamPageForAdmin(EDITOR, "che")).toBeNull();
      expect((await arm.staffActivity()).at(-1)).toEqual({
        id: expect.any(String),
        at: at(MINUTE).toISOString(),
        actor: { email: OWNER.email, name: OWNER.name },
        entity: "exam",
        entityId: "CHE",
        action: "delete",
        before: {
          exam: SAVED_CHE,
          page: expect.objectContaining({ sections: expect.objectContaining({ reviews: false }) }),
        },
        after: null,
      });
    });

    it("can add the code again once it's deleted", async () => {
      saved(await seam.createExam(OWNER, CHE));
      saved(await seam.deleteExam(OWNER, "CHE"));
      expect(await seam.createExam(OWNER, CHE)).toMatchObject({ ok: true });
    });

    it("refuses an Exam with only a hidden Product, giving the reason, changing nothing", async () => {
      await arm.reset((seed) => {
        for (const product of seed.products) {
          if (product.examCode === "CPA") product.showOnWebsite = false;
        }
      });
      expect((await opened("cpa")).products).toHaveLength(1);

      expect(await seam.deleteExam(OWNER, "cpa")).toEqual(
        formError("1 Product belongs to CPA. Move or delete it first."),
      );
      expect(await codes()).toContain("CPA");
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an Editor, and answers not-found for an unknown Exam", async () => {
      saved(await seam.createExam(OWNER, CHE));
      expect(await seam.deleteExam(EDITOR, "che")).toEqual(FORBIDDEN);
      expect(await seam.deleteExam(OWNER, "zz")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("fixed codes", () => {
    it("refuses a Header save that tries to change the Exam's code or board", async () => {
      const { exam, stamps } = await opened("ce");
      const forged = { ...headerFormValues(exam), code: "CEX", board: "CEXLE" };

      expect(await seam.updateExamHeader(EDITOR, "ce", forged, stamps.header)).toEqual(
        formError("THE CODES CAN’T BE CHANGED · RELOAD THE PAGE"),
      );
      expect(await getExamByCode("ce")).toMatchObject({ code: "CE", board: "CELE" });
    });
  });

  describe("getExamPageForAdmin", () => {
    it("counts the Products tagged with each Subject, for the remove buttons", async () => {
      const page: AdminExamPage = await opened("ce");
      expect(Object.keys(page.subjectProducts)).toEqual(["MSTC", "HPGE", "PSAD"]);
      expect(page.subjectProducts.MSTC).toBeGreaterThan(0);
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  examDeleteBlocker,
  examHeaderFormSchema,
  EXAMS_LIMIT,
  fieldErrorsOf,
  newExamFormSchema,
  type NewExamForm,
  newSubjectFormSchema,
  subjectDeleteBlocker,
  topicDeleteBlocker,
} from "./admin.schema";
import { MAX_EXAMS, validateCatalogueSeed } from "./catalogue.schema";
import { CATALOGUE_SEED } from "./mock/catalogue";

// The rules for adding Exams and Subjects (ticket 23; spec, Phase 2 →
// "Adding Exams and Subjects"): the "+ Add exam" form, "+ Add subject", the
// 12-Exam limit and why a delete is refused. The seam's suite
// (admin.exams.test.ts) covers the rules that need the catalogue.

const CHE: NewExamForm = {
  code: "che",
  board: "chele",
  name: "Chemical Engineering",
  longName: "Chemical Engineer Licensure Exam",
  blurb: "Every ChE formula, in one place.",
  madeFor: "ChE reviewees",
  subjects: [
    { code: "pchem", name: "Physical Chemistry" },
    { code: " che  prof ", name: " ChE Professional Subjects " },
  ],
};

const errors = (input: unknown) => {
  const result = newExamFormSchema.safeParse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("newExamFormSchema", () => {
  it("saves the codes and board in capitals and the text trimmed", () => {
    expect(newExamFormSchema.parse(CHE)).toEqual({
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
    });
  });

  it.each(["", "C", "CHEMENG", "CH3", "C E", "ÇE"])("refuses the code %j", (code) => {
    expect(errors({ ...CHE, code })).toEqual({ code: ["USE 2–6 LETTERS"] });
  });

  it.each(["CE", "chemen"])("takes the code %j", (code) => {
    expect(errors({ ...CHE, code })).toEqual({});
  });

  it.each(["", "C", "CHELEBOARDX", "CHE1", "CH LE"])("refuses the board %j", (board) => {
    expect(errors({ ...CHE, board })).toEqual({ board: ["USE 2–10 LETTERS"] });
  });

  it("refuses blank Header fields with the Header editor's messages", () => {
    expect(errors({ ...CHE, name: " ", longName: "", blurb: "", madeFor: "  " })).toEqual({
      name: ["ADD THE EXAM NAME"],
      longName: ["ADD THE LONG NAME"],
      blurb: ["ADD THE TEXT"],
      madeFor: ["ADD WHO IT’S MADE FOR"],
    });
  });

  it.each([
    ["name", 60],
    ["longName", 120],
    ["blurb", 600],
    ["madeFor", 160],
  ] as const)("takes a %s of %i characters and refuses one more", (field, max) => {
    expect(errors({ ...CHE, [field]: "x".repeat(max) })).toEqual({});
    expect(errors({ ...CHE, [field]: "x".repeat(max + 1) })).toEqual({
      [field]: [`KEEP IT TO ${max} CHARACTERS`],
    });
  });

  it("refuses a form with no Subject", () => {
    expect(errors({ ...CHE, subjects: [] })).toEqual({ subjects: ["ADD AT LEAST ONE SUBJECT"] });
  });

  it("refuses a blank Subject name, and one over 120 characters", () => {
    expect(
      errors({
        ...CHE,
        subjects: [
          { code: "PCHEM", name: " " },
          { code: "THERMO", name: "x".repeat(121) },
        ],
      }),
    ).toEqual({
      "subjects.0.name": ["ADD THE SUBJECT’S NAME"],
      "subjects.1.name": ["KEEP IT TO 120 CHARACTERS"],
    });
  });

  it.each(["", "X".repeat(21), "PCHEM-1", "P/CHEM"])("refuses the Subject code %j", (code) => {
    expect(errors({ ...CHE, subjects: [{ code, name: "Physical Chemistry" }] })).toEqual({
      "subjects.0.code": ["USE 1–20 LETTERS, DIGITS, SPACES OR &"],
    });
  });

  it.each(["X".repeat(20), "CLIN MIC & PARA", "EE PROF", "A1"])(
    "takes the Subject code %j",
    (code) => {
      expect(errors({ ...CHE, subjects: [{ code, name: "Subject" }] })).toEqual({});
    },
  );

  it("refuses two Subjects with the same code, in any case, on the later one", () => {
    expect(
      errors({
        ...CHE,
        subjects: [
          { code: "PCHEM", name: "Physical Chemistry" },
          { code: "pchem ", name: "Physical Chemistry again" },
        ],
      }),
    ).toEqual({ "subjects.1.code": ["PCHEM IS LISTED TWICE"] });
  });

  it("makes an Exam the seed's rules take", () => {
    const seed = structuredClone(CATALOGUE_SEED);
    seed.exams.push(newExamFormSchema.parse(CHE));
    expect(validateCatalogueSeed(seed).success).toBe(true);
  });
});

describe("newSubjectFormSchema", () => {
  it("saves the code in capitals and the name trimmed", () => {
    expect(newSubjectFormSchema.parse({ code: " thermo ", name: " Thermodynamics " })).toEqual({
      code: "THERMO",
      name: "Thermodynamics",
    });
  });

  it("refuses a bad code and a blank name, each with its message", () => {
    const result = newSubjectFormSchema.safeParse({ code: "THERMO!", name: "" });
    expect(result.success ? {} : fieldErrorsOf(result.error)).toEqual({
      code: ["USE 1–20 LETTERS, DIGITS, SPACES OR &"],
      name: ["ADD THE SUBJECT’S NAME"],
    });
  });
});

describe("examHeaderFormSchema", () => {
  it("refuses a Header that tries to change the code or board: they're fixed", () => {
    const header = { name: "CE", longName: "CE", blurb: "CE", madeFor: "CE" };
    const result = examHeaderFormSchema.safeParse({ ...header, board: "CEX" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("THE CODES CAN’T BE CHANGED · RELOAD THE PAGE");
  });
});

describe("the Exam limit", () => {
  it("is 12, and the seed's rules refuse a 13th Exam", () => {
    expect(MAX_EXAMS).toBe(12);
    expect(EXAMS_LIMIT).toBe("UP TO 12 EXAMS. Ask the developer to raise the limit.");
    const seed = structuredClone(CATALOGUE_SEED);
    const base = seed.exams[0];
    if (!base) throw new Error("the seed has no Exams");
    const letters = "ABCDEFGHIJKLMNOP";
    for (let i = seed.exams.length; i < MAX_EXAMS; i++) {
      seed.exams.push({ ...base, code: `X${letters[i]}` });
    }
    expect(validateCatalogueSeed(seed).success).toBe(true);
    seed.exams.push({ ...base, code: "XZ" });
    expect(validateCatalogueSeed(seed).success).toBe(false);
  });
});

describe("why a delete is refused", () => {
  const NONE = { decks: 0, quizzes: 0, reviewerPdfs: 0 };

  it("names how many Products belong to the Exam", () => {
    expect(examDeleteBlocker("CHE", 0, NONE)).toBeNull();
    expect(examDeleteBlocker("CHE", 1, NONE)).toBe(
      "1 Product belongs to CHE. Move or delete it first.",
    );
    expect(examDeleteBlocker("CHE", 2, NONE)).toBe(
      "2 Products belong to CHE. Move or delete them first.",
    );
  });

  it("names the Member App content the Exam's Topics hold (Phase 3)", () => {
    expect(examDeleteBlocker("CE", 0, { decks: 5, quizzes: 3, reviewerPdfs: 2 })).toBe(
      "CE has Member App content: 5 decks, 3 quizzes and 2 Reviewer PDFs. Delete it first.",
    );
    expect(examDeleteBlocker("CE", 0, { decks: 0, quizzes: 1, reviewerPdfs: 0 })).toBe(
      "CE has Member App content: 1 quiz. Delete it first.",
    );
    // Products are named first.
    expect(examDeleteBlocker("CE", 1, { decks: 1, quizzes: 0, reviewerPdfs: 0 })).toBe(
      "1 Product belongs to CE. Move or delete it first.",
    );
  });

  it("names how many Products use the Subject, and keeps the Exam's last one", () => {
    const subject = { exam: "CE", content: NONE, subjects: 4 };
    expect(subjectDeleteBlocker({ ...subject, subject: "THERMO", products: 0 })).toBe(null);
    expect(subjectDeleteBlocker({ ...subject, subject: "MSTC", products: 1 })).toBe(
      "1 Product uses MSTC. Remove it from that Product first.",
    );
    expect(subjectDeleteBlocker({ ...subject, subject: "MSTC", products: 3 })).toBe(
      "3 Products use MSTC. Remove it from those Products first.",
    );
    expect(
      subjectDeleteBlocker({
        exam: "CHE",
        subject: "PCHEM",
        products: 0,
        content: NONE,
        subjects: 1,
      }),
    ).toBe("CHE needs at least one Subject. Add another before deleting this one.");
  });

  it("names the Member App content the Subject's Topics hold (Phase 3)", () => {
    const subject = { exam: "CE", subject: "MSTC", products: 0, subjects: 4 };
    expect(
      subjectDeleteBlocker({ ...subject, content: { decks: 1, quizzes: 1, reviewerPdfs: 1 } }),
    ).toBe("MSTC has Member App content: 1 deck, 1 quiz and 1 Reviewer PDF. Delete it first.");
    expect(
      subjectDeleteBlocker({ ...subject, content: { decks: 2, quizzes: 0, reviewerPdfs: 1 } }),
    ).toBe("MSTC has Member App content: 2 decks and 1 Reviewer PDF. Delete it first.");
  });
});

describe("why a Topic can't be deleted", () => {
  it("is null for an empty Topic", () => {
    expect(topicDeleteBlocker({ deck: null, quiz: null, reviewerPdf: null })).toBeNull();
  });

  it("names what the Topic holds, Hidden and Draft content too", () => {
    expect(topicDeleteBlocker({ deck: "hidden", quiz: null, reviewerPdf: null })).toBe(
      "It has a deck. Only an empty Topic can be deleted.",
    );
    expect(topicDeleteBlocker({ deck: "visible", quiz: "hidden", reviewerPdf: "draft" })).toBe(
      "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
    );
    expect(topicDeleteBlocker({ deck: null, quiz: "visible", reviewerPdf: "failed" })).toBe(
      "It has a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
    );
  });
});

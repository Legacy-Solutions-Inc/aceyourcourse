import { describe, expect, it } from "vitest";

import {
  ADD_AN_EXPLANATION,
  ADD_THE_QUESTION,
  addChoice,
  PICK_THE_CORRECT_CHOICE,
  questionFieldProblems,
  questionFieldsOf,
  type QuestionText,
} from "./question-fields";
import { QUESTION_TEXT_LIMITS } from "./quiz-rules";

// A question's fields as the question editor judges them (Phase 3, ticket 10;
// spec, Phase 3 → Content model; story 125): the question, four choices A–D
// and the explanation are required, each held to the import's length limit
// and each must render as a formula, and exactly one choice is the correct
// one.

const question = (fields: Partial<QuestionText> = {}): QuestionText => ({
  question: "Degree of curve for $R = 200$ m?",
  choices: { A: "$5.73°$", B: "$11.46°$", C: "$2.86°$", D: "$1.43°$" },
  correct: "A",
  explanation: "$D = \\frac{1145.916}{R}$",
  ...fields,
});

const choices = (changed: Partial<QuestionText["choices"]>) => ({
  ...question().choices,
  ...changed,
});

describe("questionFieldProblems", () => {
  it("accepts a question with maths in every field, and a literal \\$", () => {
    expect(questionFieldProblems(question())).toEqual({});
    expect(questionFieldProblems(question({ choices: choices({ D: "It costs \\$5" }) }))).toEqual(
      {},
    );
  });

  it("refuses a question with no correct choice picked", () => {
    expect(questionFieldProblems(question({ correct: null }))).toEqual({
      correct: PICK_THE_CORRECT_CHOICE,
    });
  });

  it("refuses an empty choice, even one of spaces, naming it", () => {
    expect(questionFieldProblems(question({ choices: choices({ B: "", D: "   " }) }))).toEqual({
      "choices.B": addChoice("B"),
      "choices.D": addChoice("D"),
    });
    expect(addChoice("B")).toBe("ADD CHOICE B TO SAVE");
  });

  it("refuses an empty question or explanation", () => {
    expect(questionFieldProblems(question({ question: " ", explanation: "" }))).toEqual({
      question: ADD_THE_QUESTION,
      explanation: ADD_AN_EXPLANATION,
    });
  });

  it.each([
    ["question", QUESTION_TEXT_LIMITS.question],
    ["explanation", QUESTION_TEXT_LIMITS.explanation],
  ] as const)("takes a %s of %i characters, and refuses one more", (field, limit) => {
    expect(questionFieldProblems(question({ [field]: "a".repeat(limit) }))).toEqual({});
    expect(questionFieldProblems(question({ [field]: "a".repeat(limit + 1) }))).toEqual({
      [field]: `KEEP IT TO ${limit.toLocaleString("en")} CHARACTERS`,
    });
  });

  it("holds each choice to its own limit, counting as Postgres does and trimmed", () => {
    const limit = QUESTION_TEXT_LIMITS.choice;
    expect(
      questionFieldProblems(question({ choices: choices({ C: ` ${"😀".repeat(limit)} ` }) })),
    ).toEqual({});
    expect(
      questionFieldProblems(question({ choices: choices({ C: "a".repeat(limit + 1) }) })),
    ).toEqual({ "choices.C": "KEEP IT TO 500 CHARACTERS" });
  });

  it("refuses a formula that won't render, naming the field and quoting it", () => {
    expect(
      questionFieldProblems(
        question({ question: "$\\frac{1}{$", choices: choices({ A: "$x^$" }) }),
      ),
    ).toEqual({
      question:
        "The question has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
      "choices.A": expect.stringMatching(/^Choice A has a formula that won’t render, “x\^”/),
    });
  });

  it("refuses notation that can't be read, like a $ never closed", () => {
    expect(questionFieldProblems(question({ explanation: "Costs $5" }))).toEqual({
      explanation: expect.stringMatching(/^The explanation /),
    });
  });
});

describe("questionFieldsOf", () => {
  it("gives the text as saved: every field trimmed", () => {
    expect(
      questionFieldsOf(
        question({
          question: "  Degree?\n",
          choices: { A: " 1 ", B: "2", C: "3 ", D: "\t4" },
          explanation: " Because. ",
        }),
      ),
    ).toEqual({
      question: "Degree?",
      choices: { A: "1", B: "2", C: "3", D: "4" },
      explanation: "Because.",
    });
  });
});

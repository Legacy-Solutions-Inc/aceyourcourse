import { formulaFieldProblem, type FormulaFieldRule } from "@/lib/formula/field";

import { QUESTION_TEXT_LIMITS, QUIZ_CHOICES, type QuizChoice } from "./quiz-rules";

// ─────────────────────────────────────────────────────────────────────────────
// A question's fields as the question editor judges them (Phase 3, ticket 10;
// spec, Phase 3 → Content model; story 125), pure, so the browser checks a
// question before it uploads or saves anything, and the Admin seam checks it
// again. It follows the card editor's rules (src/lib/cards/card-fields.ts):
//   - the question, each of the four choices and the explanation are
//     required (the questions table holds each to 1 character or more),
//   - each has the import's length limit (quiz-rules.ts), counted as
//     Postgres counts characters, on the text as saved (trimmed),
//   - each must render: the formula notation is read, and every formula is
//     put through KaTeX,
//   - and one of A–D is the correct choice.
// A figure has a card image's rules (cardImageProblem, card-rules.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** A question's fields, as the form names them: its message goes next to the field. */
export type QuestionField = "question" | `choices.${QuizChoice}` | "correct" | "explanation";

/** A question's text as the form holds it: no correct choice until one is picked. */
export interface QuestionText {
  question: string;
  choices: Record<QuizChoice, string>;
  correct: QuizChoice | null;
  explanation: string;
}

export const ADD_THE_QUESTION = "ADD THE QUESTION TO SAVE";
export const ADD_AN_EXPLANATION = "ADD AN EXPLANATION TO SAVE";
export const PICK_THE_CORRECT_CHOICE = "PICK THE CORRECT CHOICE TO SAVE";

/** Pure: "ADD CHOICE B TO SAVE". */
export const addChoice = (choice: QuizChoice) => `ADD CHOICE ${choice} TO SAVE`;

/** Each text field's rule, by the form's name for it. */
const RULES = {
  question: { name: "The question", limit: QUESTION_TEXT_LIMITS.question, blank: ADD_THE_QUESTION },
  ...(Object.fromEntries(
    QUIZ_CHOICES.map((choice) => [
      `choices.${choice}`,
      { name: `Choice ${choice}`, limit: QUESTION_TEXT_LIMITS.choice, blank: addChoice(choice) },
    ]),
  ) as Record<`choices.${QuizChoice}`, FormulaFieldRule>),
  explanation: {
    name: "The explanation",
    limit: QUESTION_TEXT_LIMITS.explanation,
    blank: ADD_AN_EXPLANATION,
  },
} satisfies Record<Exclude<QuestionField, "correct">, FormulaFieldRule>;

/** Pure: each field that can't be saved, with why, in the form's order. Empty when it can be saved. */
export function questionFieldProblems(text: QuestionText): Partial<Record<QuestionField, string>> {
  const problems: Partial<Record<QuestionField, string>> = {};
  const judge = (field: Exclude<QuestionField, "correct">, value: string) => {
    const problem = formulaFieldProblem(value, RULES[field]);
    if (problem) problems[field] = problem;
  };
  judge("question", text.question);
  for (const choice of QUIZ_CHOICES) judge(`choices.${choice}`, text.choices[choice]);
  if (text.correct === null) problems.correct = PICK_THE_CORRECT_CHOICE;
  judge("explanation", text.explanation);
  return problems;
}

/** Pure: a question's text as saved: each field trimmed. */
export function questionFieldsOf(text: QuestionText): {
  question: string;
  choices: Record<QuizChoice, string>;
  explanation: string;
} {
  const { A, B, C, D } = text.choices;
  return {
    question: text.question.trim(),
    choices: { A: A.trim(), B: B.trim(), C: C.trim(), D: D.trim() },
    explanation: text.explanation.trim(),
  };
}

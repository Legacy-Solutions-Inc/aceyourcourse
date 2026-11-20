import {
  matchingQuestion,
  QUESTION_TEXT_LIMITS,
  QUIZ_CHOICES,
  type QuizChoice,
  quizChoiceOf,
} from "@/lib/quizzes/quiz-rules";

import {
  type ExistingTopic,
  type ImportRows,
  type ImportPlan,
  type PlanInput,
  planImport,
  readTextCells,
  type RowRead,
  type TextCellRule,
} from "./plan";

// ─────────────────────────────────────────────────────────────────────────────
// The quiz import's rows (Phase 3, ticket 09; stories 119–124, 133l): one
// question per row, with its Topic, the question, four choices, the correct
// answer (A–D), an explanation (each text field in the formula notation) and
// an optional figure in the zip. Replace matches a question by its text
// (trimmed, single spaces, case kept), so a question whose text is unchanged
// keeps its id, and every Member's attempts that answered it; the questions
// no row matches are taken out of the quiz, and the Admin seam keeps them,
// marked removed, for old attempts to show. The planner itself (plan.ts) is
// shared with the card import.
// ─────────────────────────────────────────────────────────────────────────────

/** The quiz template's columns, in its order. */
export const QUIZ_IMPORT_COLUMNS = [
  "topic",
  "question",
  "choice a",
  "choice b",
  "choice c",
  "choice d",
  "correct answer",
  "explanation",
  "figure",
] as const;

/** A question's own fields. */
export interface QuestionFields {
  question: string;
  choices: Record<QuizChoice, string>;
  correct: QuizChoice;
  explanation: string;
}

export type ExistingQuizTopic = ExistingTopic<QuestionFields>;

const CHOICE_RULE: TextCellRule = {
  required: true,
  limit: QUESTION_TEXT_LIMITS.choice,
  blank: "is blank: every question needs four choices",
};

const TEXT_RULES = {
  question: { required: true, limit: QUESTION_TEXT_LIMITS.question },
  "choice a": CHOICE_RULE,
  "choice b": CHOICE_RULE,
  "choice c": CHOICE_RULE,
  "choice d": CHOICE_RULE,
  explanation: { required: true, limit: QUESTION_TEXT_LIMITS.explanation },
} satisfies Record<string, TextCellRule>;

/** Pure: the correct answer's cell: one of A–D, in either case, or why it isn't. */
function correctAnswer(cell: string): { choice: QuizChoice } | { problem: string } {
  if (cell === "") return { problem: "is blank: write the correct choice, A, B, C or D" };
  const choice = quizChoiceOf(cell);
  return choice ? { choice } : { problem: `is “${cell}”: write A, B, C or D` };
}

export const QUIZ_IMPORT: ImportRows<QuestionFields> = {
  columns: QUIZ_IMPORT_COLUMNS,
  fileColumn: "figure",
  item: { one: "question", many: "questions" },
  files: "figures",
  read(cell): RowRead<QuestionFields> {
    const { text, problems } = readTextCells(cell, TEXT_RULES);
    const answer = correctAnswer(cell("correct answer"));
    // The correct answer's column comes before the explanation's, as in the template.
    const at = problems.findIndex(({ column }) => column === "explanation");
    if ("problem" in answer) {
      const problem = { column: "correct answer", message: answer.problem };
      problems.splice(at === -1 ? problems.length : at, 0, problem);
    }
    const choices: Record<QuizChoice, string> = {
      A: text["choice a"] ?? "",
      B: text["choice b"] ?? "",
      C: text["choice c"] ?? "",
      D: text["choice d"] ?? "",
    };
    const { question, explanation } = text;
    const fields =
      problems.length === 0 && question && explanation && "choice" in answer
        ? { question, choices, correct: answer.choice, explanation }
        : null;
    return { fields, problems };
  },
  matchKey: ({ question }) => matchingQuestion(question),
  sameFields: (a, b) =>
    a.question === b.question &&
    a.correct === b.correct &&
    a.explanation === b.explanation &&
    QUIZ_CHOICES.every((choice) => a.choices[choice] === b.choices[choice]),
};

/** Pure: a quiz import's plan and problems (plan.ts). */
export const planQuizImport = (input: PlanInput<QuestionFields>): ImportPlan<QuestionFields> =>
  planImport(QUIZ_IMPORT, input);

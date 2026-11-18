import { CARD_IMAGE_EXTENSIONS, type CardImageType } from "@/lib/cards/card-rules";

// ─────────────────────────────────────────────────────────────────────────────
// A quiz's rules (spec, Phase 3 → Content model; stories 119, 126, 127): a
// list of questions, each with its text, four choices A–D, the correct
// choice, an explanation (each in the formula notation) and an optional
// figure, plus the quiz's passing score, shuffle and "show answers after"
// settings. Pure and dependency-free, so the import planner (ticket 09), the
// question editor (ticket 10), the quiz settings form and the Admin seam
// judge a quiz the same way, and the questions table checks the same limits.
// ─────────────────────────────────────────────────────────────────────────────

/** A question's four choices, in order. */
export const QUIZ_CHOICES = ["A", "B", "C", "D"] as const;
export type QuizChoice = (typeof QUIZ_CHOICES)[number];

/** The longest each text field may be, in characters: the question, each choice, the explanation. */
export const QUESTION_TEXT_LIMITS = { question: 1000, choice: 500, explanation: 2000 } as const;

/** A quiz's passing score, a whole percentage: 1–100, 70 unless Staff change it. */
export const PASSING_SCORE_MIN = 1;
export const PASSING_SCORE_MAX = 100;
export const DEFAULT_PASSING_SCORE = 70;

/** A new quiz's settings: the passing score, shuffled questions, and answers shown after scoring. */
export const DEFAULT_QUIZ_SETTINGS = {
  passingScore: DEFAULT_PASSING_SCORE,
  shuffle: true,
  showAnswers: true,
} as const;

/** Pure: whether text names one of the four choices: A, B, C or D, in either case. */
export const quizChoiceOf = (text: string): QuizChoice | null => {
  const letter = text.trim().toUpperCase();
  return QUIZ_CHOICES.find((choice) => choice === letter) ?? null;
};

/**
 * Pure: the question text a re-import matches questions by: trimmed, with
 * each run of whitespace as one space, and case kept. A question whose text
 * matches keeps its id, and so every Member's attempts that answered it.
 */
export const matchingQuestion = (question: string) => question.trim().replace(/\s+/g, " ");

/**
 * Pure: where a question's figure is stored in the private content bucket:
 * under its quiz, as a new file each time, so a stored figure is never
 * overwritten. A figure has a card image's rules (a JPEG, PNG or WebP of at
 * most 5 MB).
 */
export const quizFigurePath = (quizId: string, fileId: string, type: CardImageType) =>
  `quizzes/${quizId}/${fileId}.${CARD_IMAGE_EXTENSIONS[type]}`;

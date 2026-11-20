import type { AdminQuizSettings } from "@/services/admin.types";

// The quiz settings form's values (Phase 3, ticket 09; BUILD-MAP §3.6, quiz
// settings): the passing score as typed, and the two switches, through the
// seam's schema (quizSettingsFormSchema), which takes "70" or "70%".

/** The settings form's values: the quiz, its passing score as the field holds it, and the switches. */
export interface QuizSettingsValues extends Record<string, unknown> {
  id: string;
  passingScore: string;
  shuffle: boolean;
  showAnswers: boolean;
}

/** Pure: a quiz's settings as its form opens them. */
export const quizSettingsFormValues = (settings: AdminQuizSettings): QuizSettingsValues => ({
  id: settings.id,
  passingScore: String(settings.passingScore),
  shuffle: settings.shuffle,
  showAnswers: settings.showAnswers,
});

/** Pure: the quiz screen's state line: "CE · MSTC · 2 QUESTIONS · HIDDEN · FREE PREVIEW". */
export function quizStateLine(
  where: { exam: string; subject: string },
  questions: number,
  quiz: Pick<AdminQuizSettings, "visibility" | "freePreview"> | null,
): string {
  const count = `${questions} ${questions === 1 ? "QUESTION" : "QUESTIONS"}`;
  const state = quiz ? quiz.visibility.toUpperCase() : "NO QUIZ YET";
  return [where.exam, where.subject, count, state, quiz?.freePreview ? "FREE PREVIEW" : null]
    .filter((part) => part !== null)
    .join(" · ");
}

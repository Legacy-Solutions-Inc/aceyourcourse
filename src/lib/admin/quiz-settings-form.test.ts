import { describe, expect, it } from "vitest";

import { quizSettingsFormValues, quizStateLine } from "./quiz-settings-form";

// The quiz settings form's values and the quiz screen's state line (Phase 3, ticket 09).

const SETTINGS = {
  id: "q",
  visibility: "hidden",
  freePreview: false,
  passingScore: 70,
  shuffle: true,
  showAnswers: false,
  stamp: { savedAt: "2026-11-18T00:00:00.000Z", savedBy: null },
} as const;

describe("quizSettingsFormValues", () => {
  it("opens the passing score as the field shows it, with the switches", () => {
    expect(quizSettingsFormValues(SETTINGS)).toEqual({
      id: "q",
      passingScore: "70",
      shuffle: true,
      showAnswers: false,
    });
  });
});

describe("quizStateLine", () => {
  const where = { exam: "CE", subject: "MSTC" };

  it.each([
    [0, null, "CE · MSTC · 0 QUESTIONS · NO QUIZ YET"],
    [1, SETTINGS, "CE · MSTC · 1 QUESTION · HIDDEN"],
    [
      12,
      { ...SETTINGS, visibility: "visible", freePreview: true },
      "CE · MSTC · 12 QUESTIONS · VISIBLE · FREE PREVIEW",
    ],
  ] as const)("with %d questions: %o", (questions, quiz, line) => {
    expect(quizStateLine(where, questions, quiz)).toBe(line);
  });
});

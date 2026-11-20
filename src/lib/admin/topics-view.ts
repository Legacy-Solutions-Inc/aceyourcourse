import { typedCode } from "@/services/admin.schema";
import type { TopicContent } from "@/services/content.types";

// The Topics list's pure view helpers (Phase 3, ticket 05): Member App content
// in the Admin (BUILD-MAP §3.6 "CE · MSTC · TOPICS": each Topic with its
// status, EMPTY, VISIBLE or HIDDEN).

/**
 * Pure: what a Topic holds, as its row says it: each kind with its
 * visibility or status, such as ["DECK · VISIBLE", "QUIZ · HIDDEN"], or
 * ["EMPTY"] when it holds nothing.
 */
export function topicContentLabels({ deck, quiz, reviewerPdf }: TopicContent): string[] {
  const labels = [
    deck ? `DECK · ${deck.toUpperCase()}` : null,
    quiz ? `QUIZ · ${quiz.toUpperCase()}` : null,
    reviewerPdf ? `REVIEWER PDF · ${reviewerPdf.toUpperCase()}` : null,
  ].filter((label) => label !== null);
  return labels.length > 0 ? labels : ["EMPTY"];
}

/** Pure: a code as an address names it, matched as saved: trimmed, in capitals. */
export function codeParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? typedCode(value) : undefined;
}

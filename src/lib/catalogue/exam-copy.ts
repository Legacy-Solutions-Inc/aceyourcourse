import { config } from "@/config";
import { truncate } from "@/lib/text";
import type { Exam, ExamPage } from "@/services/catalogue.types";

// The Exam page's SEO text. Visitors search by board acronym ("CELE
// reviewer"), so the title leads with it.

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/**
 * "CELE Reviewer · Civil Engineering". The root layout's template adds
 * " · Ace Your Course", and the whole title stays within 60 characters.
 */
export function examSeoTitle(exam: Exam): string {
  const room = TITLE_MAX - ` · ${config.site.name}`.length;
  const full = `${exam.board} Reviewer · ${exam.name}`;
  return full.length <= room ? full : truncate(`${exam.board} Reviewer`, room);
}

/** The blurb's whole sentences that fit in 160 characters, or its first cut at a word. */
export function examSeoDescription(exam: Exam): string {
  const [first = "", ...rest] = exam.blurb.trim().split(/(?<=[.!?])\s+/);
  if (first.length > DESCRIPTION_MAX) return truncate(first, DESCRIPTION_MAX);
  let description = first;
  for (const sentence of rest) {
    if (description.length + 1 + sentence.length > DESCRIPTION_MAX) break;
    description += ` ${sentence}`;
  }
  return description;
}

/** The Exam page's title and description: the overrides Staff set, or the generated text. */
export function examPageSeo(
  exam: Exam,
  page: Pick<ExamPage, "seoTitle" | "seoDescription">,
): { title: string; description: string } {
  return {
    title: page.seoTitle ?? examSeoTitle(exam),
    description: page.seoDescription ?? examSeoDescription(exam),
  };
}

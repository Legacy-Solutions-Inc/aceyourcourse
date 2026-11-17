import { examPageDefaults, type CatalogueSeed } from "@/services/catalogue.schema";

import { withUnusedExam } from "./admin-inputs";

/** The Official Exam Date the Target Exam tests give CE. */
export const CE_OFFICIAL = "2026-11-21";

/**
 * A seed edit for the Target Exam tests: CE gets an Official Exam Date (21
 * Nov 2026), every other Exam keeps none, and CHE is added with no Product,
 * so it's an Exam that isn't on the Website.
 */
export function withExamDates(seed: CatalogueSeed): void {
  withUnusedExam(seed);
  const page = seed.examPages.find((p) => p.examCode === "CE");
  if (page) page.officialExamDate = CE_OFFICIAL;
  else seed.examPages.push({ ...examPageDefaults("CE"), officialExamDate: CE_OFFICIAL });
}

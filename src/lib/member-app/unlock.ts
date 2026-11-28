import { paths } from "@/paths";

/**
 * How a Member gets an Exam's All-Access from a lock (Phase 4, ticket 02;
 * spec, Phase 4 planning decisions → Who buys, and which Exams; story 151e):
 * the Exam's Plans while it has a Plan on sale ("See plans", "Renew access");
 * otherwise they ask AYC, at the contact email ("contact us").
 */
export type UnlockRoute =
  { kind: "plans"; href: string } | { kind: "contact"; contactEmail: string };

/** Pure: the way to unlock `examCode`, given the Exams with a Plan on sale now. */
export function unlockRoute(
  examCode: string,
  examsOnSale: readonly string[],
  contactEmail: string,
): UnlockRoute {
  return examsOnSale.includes(examCode)
    ? { kind: "plans", href: paths.memberApp.plansFor(examCode) }
    : { kind: "contact", contactEmail };
}

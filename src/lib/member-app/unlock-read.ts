import "server-only";

import { type UnlockRoute, unlockRoute } from "@/lib/member-app/unlock";
import { getWebsiteSettings } from "@/services/catalogue";
import { listExamsOnSale } from "@/services/member";

/**
 * What a lock's way out reads (Phase 4, ticket 02), fresh for this request:
 * the Exams with a Plan on sale and the contact email. Gives the way to
 * unlock any Exam: its Plans while it has a Plan on sale, otherwise the
 * "contact us" note.
 */
export async function readUnlockRoutes(): Promise<(examCode: string) => UnlockRoute> {
  const [onSale, { contactEmail }] = await Promise.all([listExamsOnSale(), getWebsiteSettings()]);
  return (examCode) => unlockRoute(examCode, onSale, contactEmail);
}

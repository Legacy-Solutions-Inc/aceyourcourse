import "server-only";

import { readMemberAccess } from "@/lib/member-app/access-check";
import { renewalBanner, type RenewalBannerView } from "@/lib/member-app/renewal";
import { readUnlockRoutes } from "@/lib/member-app/unlock-read";
import { listRenewalReminders } from "@/services/member";

/**
 * The signed-in Member's renewal banners (Phase 4, ticket 12), fresh for this
 * request: every Exam's on Home, or one Exam's on its study screens, each
 * renewing from its Plans while one is on sale (readUnlockRoutes). The
 * staff list is read now with the rest of the access decision's inputs, so
 * Staff get none. None when nobody is signed in.
 */
export async function readRenewalBanners(
  userId: string,
  examCode?: string,
): Promise<RenewalBannerView[]> {
  const access = await readMemberAccess();
  if (!access) return [];
  const [reminders, unlockOf] = await Promise.all([
    listRenewalReminders(userId, { activeStaff: access.activeStaff }),
    readUnlockRoutes(),
  ]);
  return reminders
    .filter((reminder) => examCode === undefined || reminder.examCode === examCode.toUpperCase())
    .map((reminder) => renewalBanner(reminder, unlockOf(reminder.examCode)));
}

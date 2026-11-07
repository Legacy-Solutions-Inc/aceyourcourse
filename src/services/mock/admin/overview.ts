import type { AdminOverview, StaffActor } from "@/services/admin.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's overview area: the catalogue data the
// Overview works out what needs Staff from. It takes the actor like the other
// reads: the database arm (ticket 15) scopes its reads by the Staff User.

export async function getOverview(_actor: StaffActor): Promise<AdminOverview> {
  const { products, exams, examPages, settings } = getSampleStore().catalogue;
  const { shopLinks, shopStats, promoBanner } = settings;
  return structuredClone({
    products,
    exams,
    examPages,
    settings: { shopLinks, shopStats, promoBanner },
  });
}

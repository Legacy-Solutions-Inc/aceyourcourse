import type { AdminOverview, StaffActor } from "@/services/admin.types";
import { salesOverview } from "@/services/mock/admin/sales";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's overview area: the catalogue data the
// Overview works out what needs Staff from, and for an Owner the sales
// (mock/admin/sales.ts; Phase 4, ticket 11). It takes the actor like the
// other reads: the database arm (ticket 15) scopes its reads by the Staff User.

/** The Overview's catalogue part, which the database arm runs over the catalogue it loads. */
export async function getOverviewCatalogue(
  _actor: StaffActor,
): Promise<Omit<AdminOverview, "sales">> {
  const { products, exams, examPages, settings } = getSampleStore().catalogue;
  const { shopLinks, shopStats, promoBanner } = settings;
  return structuredClone({
    products,
    exams,
    examPages,
    settings: { shopLinks, shopStats, promoBanner },
  });
}

export async function getOverview(actor: StaffActor): Promise<AdminOverview> {
  const [catalogue, sales] = await Promise.all([getOverviewCatalogue(actor), salesOverview(actor)]);
  return { ...catalogue, sales };
}

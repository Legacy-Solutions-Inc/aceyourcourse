import type { MetadataRoute } from "next";

import { getSiteURL } from "@/lib/get-site-url";
import { buildSitemap } from "@/lib/seo";
import { listExams, listProducts } from "@/services/catalogue";

// Built on every request, so the sitemap always lists the catalogue as it is.
// The one route that opts in to force-dynamic; pages never use force-static.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [exams, live, comingSoon] = await Promise.all([
    listExams(),
    listProducts(),
    listProducts({ state: "coming-soon" }),
  ]);
  return buildSitemap(getSiteURL(), new Date(), {
    examCodes: exams.map((exam) => exam.code),
    productSlugs: [...live.items, ...comingSoon.items].map((product) => product.slug),
  });
}

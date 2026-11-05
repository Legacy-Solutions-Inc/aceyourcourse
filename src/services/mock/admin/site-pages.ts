import { type ExamSeoForm, examSeoFormSchema } from "@/services/admin.schema";
import type { AdminResult, AdminSitePage, SitePagePart, StaffActor } from "@/services/admin.types";
import { type CatalogueSeed, sitePageDefaults } from "@/services/catalogue.schema";
import type { SitePage, SitePageKey } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { shareImageAsSaved } from "./photos";
import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Site pages area (ticket 20; spec, Phase
// 2 → Site pages): each of the Website's five Site pages' SEO overrides and
// share image, with the same rules as an Exam page's. Each page is its own
// record, with its own stamp, so saving one never makes another's open editor
// conflict. A page without a record is shown nothing set, and its first save
// makes one.

/** A part's record key, for the stamp its editor checks. */
const recordOf = (page: SitePageKey, part: SitePagePart) => `site-page:${page}:${part}`;

/** The Site page's record, or nothing set while it has none. */
const pageOf = (catalogue: CatalogueSeed, page: SitePageKey): SitePage =>
  catalogue.sitePages.find((record) => record.page === page) ?? sitePageDefaults(page);

/** The draft's record for the Site page, made with nothing set if it has none. */
function draftPage(draft: CatalogueSeed, page: SitePageKey): SitePage {
  const found = draft.sitePages.find((record) => record.page === page);
  if (found) return found;
  const made = sitePageDefaults(page);
  draft.sitePages.push(made);
  return made;
}

function adminSitePageOf(catalogue: CatalogueSeed, page: SitePageKey): AdminSitePage {
  return structuredClone({
    page: pageOf(catalogue, page),
    stamps: { seo: stampOf(getSampleStore(), recordOf(page, "seo")) },
  });
}

export async function getSitePageForAdmin(
  _actor: StaffActor,
  page: SitePageKey,
): Promise<AdminSitePage> {
  return adminSitePageOf(getSampleStore().catalogue, page);
}

export async function updateSitePageSeo(
  actor: StaffActor,
  page: SitePageKey,
  input: ExamSeoForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminSitePage>> {
  const seoOf = (catalogue: CatalogueSeed) => {
    const { seoTitle, seoDescription, shareImage } = pageOf(catalogue, page);
    return { seoTitle, seoDescription, shareImage };
  };
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    record: recordOf(page, "seo"),
    schema: examSeoFormSchema,
    check: (catalogue, fields) => {
      const image = shareImageAsSaved(
        fields.shareImage,
        pageOf(catalogue, page).shareImage,
        "site-page-share-image",
      );
      return image.ok ? null : image.error;
    },
    activity: { entity: "site-page", entityId: page, action: "update-seo" },
    snapshot: seoOf,
    apply: (draft, fields) => {
      const record = draftPage(draft, page);
      // Called once the check has passed, so the image resolves.
      const image = shareImageAsSaved(
        fields.shareImage,
        record.shareImage,
        "site-page-share-image",
      );
      if (!image.ok) throw new Error(`The ${page} page's share image changed during its own save`);
      Object.assign(record, { ...fields, shareImage: image.src });
    },
    result: (catalogue) => adminSitePageOf(catalogue, page),
    tags: [CATALOGUE_TAGS.sitePages],
  });
}

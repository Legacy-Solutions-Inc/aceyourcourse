import { emptyAbout, isAboutSection } from "@/lib/catalogue/about-content";
import {
  type AboutSectionForm,
  aboutSectionFormSchema,
  type AboutSectionUpdate,
  type ExamSeoForm,
  examSeoFormSchema,
} from "@/services/admin.schema";
import type {
  AdminAbout,
  AdminError,
  AdminResult,
  AdminSitePage,
  RecordStamp,
  SitePagePart,
  StaffActor,
} from "@/services/admin.types";
import { type CatalogueSeed, sitePageDefaults } from "@/services/catalogue.schema";
import type {
  AboutContent,
  AboutPhotoSaved,
  AboutSectionKey,
  SitePage,
  SitePageKey,
} from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { shareImageAsSaved } from "./photos";
import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Site pages area (ticket 20; spec, Phase
// 2 → Site pages): each of the Website's five Site pages' SEO overrides and
// share image, with the same rules as an Exam page's, and About's text and
// photos (ticket 21). Each page's SEO, and each of About's six sections, is
// its own record with its own stamp, so saving one never makes another's open
// editor conflict. A page without a record is shown nothing set, and its first
// save makes one.

/** A part's record key, for the stamp its editor checks: its SEO, or one of About's sections. */
const recordOf = (page: SitePageKey, part: SitePagePart | AboutSectionKey) =>
  `site-page:${page}:${part}`;

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

// ── About ───────────────────────────────────────────────────────────────────

/** About's saved text and photos, every field null while nothing is saved. */
const aboutOf = (catalogue: CatalogueSeed): AboutContent =>
  pageOf(catalogue, "about").about ?? emptyAbout();

function adminAboutOf(catalogue: CatalogueSeed): AdminAbout {
  const store = getSampleStore();
  const stamp = (section: AboutSectionKey) => stampOf(store, recordOf("about", section));
  const stamps: Record<AboutSectionKey, RecordStamp> = {
    header: stamp("header"),
    story: stamp("story"),
    growth: stamp("growth"),
    mission: stamp("mission"),
    roots: stamp("roots"),
    closing: stamp("closing"),
  };
  return structuredClone({ about: aboutOf(catalogue), stamps });
}

export async function getAboutForAdmin(_actor: StaffActor): Promise<AdminAbout> {
  return adminAboutOf(getSampleStore().catalogue);
}

/** The photos a section saves, each with the field its editor shows a refusal on. */
function photosOf(update: AboutSectionUpdate, about: AboutContent) {
  if (update.section === "header") {
    return [
      { field: "teamPhoto.src", photo: update.value.teamPhoto, current: about.header.teamPhoto },
    ];
  }
  if (update.section === "story") {
    return update.value.photos.map((photo, index) => ({
      field: `photos.${index}.src`,
      photo,
      current: about.story.photos[index] ?? null,
    }));
  }
  return [];
}

/**
 * The section's value as saved: each photo the one it has or a finished
 * "about-photo" upload at its public URL. Refused when a photo is neither, or
 * an upload's file hasn't arrived yet.
 */
function resolvedSection(
  update: AboutSectionUpdate,
  about: AboutContent,
): { ok: true; update: AboutSectionUpdate } | { ok: false; error: AdminError } {
  const resolved: (AboutPhotoSaved | null)[] = [];
  for (const { field, photo, current } of photosOf(update, about)) {
    if (!photo) {
      resolved.push(null);
      continue;
    }
    const image = shareImageAsSaved(photo.src, current?.src ?? null, "about-photo", field);
    if (!image.ok) return image;
    resolved.push(image.src === null ? null : { src: image.src, alt: photo.alt });
  }
  if (update.section === "header") {
    return {
      ok: true,
      update: { ...update, value: { ...update.value, teamPhoto: resolved[0] ?? null } },
    };
  }
  if (update.section === "story") {
    const [one, two, three] = resolved;
    return {
      ok: true,
      update: {
        ...update,
        value: { ...update.value, photos: [one ?? null, two ?? null, three ?? null] },
      },
    };
  }
  return { ok: true, update };
}

/** The section the input names, for its stamp; the schema refuses any other. */
const sectionOf = (input: unknown): AboutSectionKey => {
  const section =
    typeof input === "object" && input !== null && "section" in input ? input.section : undefined;
  return isAboutSection(section) ? section : "header";
};

export async function updateAboutSection(
  actor: StaffActor,
  input: AboutSectionForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminAbout>> {
  const section = sectionOf(input);
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    record: recordOf("about", section),
    schema: aboutSectionFormSchema,
    check: (catalogue, update) => {
      const resolved = resolvedSection(update, aboutOf(catalogue));
      return resolved.ok ? null : resolved.error;
    },
    activity: { entity: "site-page", entityId: "about", action: `update-about-${section}` },
    snapshot: (catalogue) => aboutOf(catalogue)[section],
    apply: (draft, update) => {
      const record = draftPage(draft, "about");
      const about = record.about ?? emptyAbout();
      // Called once the check has passed, so every photo resolves.
      const resolved = resolvedSection(update, about);
      if (!resolved.ok) throw new Error(`About's ${section} photos changed during its own save`);
      record.about = { ...about, [resolved.update.section]: resolved.update.value };
    },
    result: (catalogue) => adminAboutOf(catalogue),
    tags: [CATALOGUE_TAGS.sitePages],
  });
}

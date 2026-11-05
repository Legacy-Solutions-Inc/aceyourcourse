"use server";

import { adminAction } from "@/lib/admin/action";
import {
  getExamPageForAdmin,
  setExamSection,
  setPromoBannerVisible,
  updateAboutSection,
  updateAnnouncement,
  updateBundleOffer,
  updateExamHeader,
  updateExamSeo,
  updateOfficialExamDate,
  updatePromoBanner,
  updateSitePageSeo,
  updateSubjectNames,
} from "@/services/admin";
import {
  aboutPhotoUploadInputSchema,
  examSectionInputSchema,
  promoBannerVisibleSchema,
  saveAboutSectionInputSchema,
  saveAnnouncementInputSchema,
  saveBundleOfferInputSchema,
  saveExamHeaderInputSchema,
  saveExamSeoInputSchema,
  saveOfficialExamDateInputSchema,
  savePromoBannerInputSchema,
  saveSitePageSeoInputSchema,
  saveSubjectNamesInputSchema,
  sitePageUploadInputSchema,
} from "@/services/admin.schema";
import { createUpload } from "@/services/uploads";
import { uploadFileSchema, uploadOwnerSchema } from "@/services/uploads.types";

// Pages & promo's Server Actions, for any Staff User. Each one checks the
// input's shape; the seam checks every rule, so the form is told each field's
// message. Each part of an Exam page, each Site page, each of About's
// sections, the Home promo banner and the announcement bar saves on its own,
// with the conflict check against the stamp its editor opened with; the
// section toggles and the banner's switch always save.

/** A section toggle: Subjects covered, Bundle offer or Reviews, shown or hidden. */
export const setExamPageSection = adminAction(
  { role: "staff", schema: examSectionInputSchema },
  async (actor, { code, section, on }) => setExamSection(actor, code, section, on),
);

/** The Header's Save: the Exam's name, long name, text and "made for". */
export const saveExamHeader = adminAction(
  { role: "staff", schema: saveExamHeaderInputSchema, requiresStamp: true },
  async (actor, { code, ...form }, expected) => updateExamHeader(actor, code, form, expected),
);

/** Subjects covered's Save: the Subject names, their codes fixed. */
export const saveSubjectNames = adminAction(
  { role: "staff", schema: saveSubjectNamesInputSchema, requiresStamp: true },
  async (actor, { code, ...form }, expected) => updateSubjectNames(actor, code, form, expected),
);

/** Bundle offer's Save: one of the Exam's Products, its headline, text and button label. */
export const saveBundleOffer = adminAction(
  { role: "staff", schema: saveBundleOfferInputSchema, requiresStamp: true },
  async (actor, { code, ...form }, expected) => updateBundleOffer(actor, code, form, expected),
);

/** Search & AI visibility's Save: the title, the description and the share image. */
export const saveExamSeo = adminAction(
  { role: "staff", schema: saveExamSeoInputSchema, requiresStamp: true },
  async (actor, { code, ...form }, expected) => updateExamSeo(actor, code, form, expected),
);

/** Official Exam Date's Save. */
export const saveOfficialExamDate = adminAction(
  { role: "staff", schema: saveOfficialExamDateInputSchema, requiresStamp: true },
  async (actor, { code, ...form }, expected) => updateOfficialExamDate(actor, code, form, expected),
);

/**
 * A one-time upload URL for an Exam's share image: a JPEG, PNG or WebP of up
 * to 10 MB. The browser sends the file there; Save records its path. Storage
 * files it under the Exam; refused when there's no such Exam.
 */
export const createShareImageUpload = adminAction(
  { role: "staff", schema: uploadFileSchema.extend({ code: uploadOwnerSchema }) },
  async (actor, { code, ...file }) => {
    const page = await getExamPageForAdmin(actor, code);
    if (!page) return { ok: false as const, error: { kind: "not-found" as const } };
    return createUpload(actor, { purpose: "share-image", owner: page.exam.code, ...file });
  },
);

/** A Site page's Search & AI visibility Save: the title, the description and the share image. */
export const saveSitePageSeo = adminAction(
  { role: "staff", schema: saveSitePageSeoInputSchema, requiresStamp: true },
  async (actor, { site, ...form }, expected) => updateSitePageSeo(actor, site, form, expected),
);

/**
 * A one-time upload URL for a Site page's share image: a JPEG, PNG or WebP of
 * up to 10 MB. Storage files it under the Site page; Save records its path.
 */
export const createSitePageShareImageUpload = adminAction(
  { role: "staff", schema: uploadFileSchema.merge(sitePageUploadInputSchema) },
  async (actor, { site, ...file }) =>
    createUpload(actor, { purpose: "site-page-share-image", owner: site, ...file }),
);

/** An About section's Save (ticket 21): its text, and the Header's and Our story's photos. */
export const saveAboutSection = adminAction(
  { role: "staff", schema: saveAboutSectionInputSchema, requiresStamp: true },
  async (actor, form, expected) => updateAboutSection(actor, form, expected),
);

/**
 * A one-time upload URL for one of About's photos: a JPEG, PNG or WebP of up
 * to 10 MB. Storage files it as site-pages/about/{slot}-…; Save records its path.
 */
export const createAboutPhotoUpload = adminAction(
  { role: "staff", schema: uploadFileSchema.merge(aboutPhotoUploadInputSchema) },
  async (actor, { slot, ...file }) =>
    createUpload(actor, { purpose: "about-photo", owner: slot, ...file }),
);

/** The Home promo banner's Save: its text, button label, link and dates. */
export const savePromoBanner = adminAction(
  { role: "staff", schema: savePromoBannerInputSchema, requiresStamp: true },
  async (actor, form, expected) => updatePromoBanner(actor, form, expected),
);

/** "Show banner", and "Turn off banner now" once it's confirmed. */
export const setPromoBanner = adminAction(
  { role: "staff", schema: promoBannerVisibleSchema },
  async (actor, { visible }) => setPromoBannerVisible(actor, visible),
);

/** The announcement bar's Save: its 1–3 messages, in order. */
export const saveAnnouncement = adminAction(
  { role: "staff", schema: saveAnnouncementInputSchema, requiresStamp: true },
  async (actor, form, expected) => updateAnnouncement(actor, form, expected),
);

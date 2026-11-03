"use server";

import { adminAction } from "@/lib/admin/action";
import {
  setExamSection,
  updateBundleOffer,
  updateExamHeader,
  updateExamSeo,
  updateOfficialExamDate,
  updateSubjectNames,
} from "@/services/admin";
import {
  examSectionInputSchema,
  saveBundleOfferInputSchema,
  saveExamHeaderInputSchema,
  saveExamSeoInputSchema,
  saveOfficialExamDateInputSchema,
  saveSubjectNamesInputSchema,
} from "@/services/admin.schema";
import { createUpload } from "@/services/uploads";
import { uploadRequestSchema } from "@/services/uploads.types";

// Exam pages & promo's Server Actions, for any Staff User. Each one checks the
// input's shape; the seam checks every rule, so the form is told each field's
// message. Each part of an Exam page saves on its own, with the conflict check
// against the stamp its editor opened with; the section toggles always save.

/** A section toggle: Subjects covered, Bundle offer or Reviews, shown or hidden. */
export const setExamPageSection = adminAction(
  { role: "staff", schema: examSectionInputSchema },
  async (actor, { code, section, on }) => setExamSection(actor, code, section, on),
);

/** The Header's Save: the Exam's name, long name, text and "made for". */
export const saveExamHeader = adminAction(
  { role: "staff", schema: saveExamHeaderInputSchema },
  async (actor, { code, ...form }, expected) => updateExamHeader(actor, code, form, expected),
);

/** Subjects covered's Save: the Subject names, their codes fixed. */
export const saveSubjectNames = adminAction(
  { role: "staff", schema: saveSubjectNamesInputSchema },
  async (actor, { code, ...form }, expected) => updateSubjectNames(actor, code, form, expected),
);

/** Bundle offer's Save: one of the Exam's Products, its headline, text and button label. */
export const saveBundleOffer = adminAction(
  { role: "staff", schema: saveBundleOfferInputSchema },
  async (actor, { code, ...form }, expected) => updateBundleOffer(actor, code, form, expected),
);

/** Search & AI visibility's Save: the title, the description and the share image. */
export const saveExamSeo = adminAction(
  { role: "staff", schema: saveExamSeoInputSchema },
  async (actor, { code, ...form }, expected) => updateExamSeo(actor, code, form, expected),
);

/** Official Exam Date's Save. */
export const saveOfficialExamDate = adminAction(
  { role: "staff", schema: saveOfficialExamDateInputSchema },
  async (actor, { code, ...form }, expected) => updateOfficialExamDate(actor, code, form, expected),
);

/**
 * A one-time upload URL for a share image: a JPEG, PNG or WebP of up to
 * 10 MB. The browser sends the file there; Save records its path.
 */
export const createShareImageUpload = adminAction(
  { role: "staff", schema: uploadRequestSchema.omit({ purpose: true }) },
  async (actor, request) => createUpload(actor, { purpose: "share-image", ...request }),
);

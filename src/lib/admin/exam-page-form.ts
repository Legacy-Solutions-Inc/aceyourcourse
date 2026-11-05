import type {
  BundleOfferForm,
  ExamHeaderForm,
  ExamSeoForm,
  OfficialExamDateForm,
  SubjectNamesForm,
} from "@/services/admin.schema";
import type { Exam, ExamPage } from "@/services/catalogue.types";

// The Exam pages editors' form values (BUILD-MAP §3.2, column 3), each part
// from the Exam or its page record as the seam gives them. Text is held as
// typed, "" for a field left blank.

/** Pure: the Header editor's values. */
export const headerFormValues = ({ name, longName, blurb, madeFor }: Exam): ExamHeaderForm => ({
  name,
  longName,
  blurb,
  madeFor,
});

/** Pure: the Subjects covered editor's values, in the Exam's order. */
export const subjectFormValues = (exam: Exam): SubjectNamesForm => ({
  subjects: exam.subjects.map(({ code, name }) => ({ code, name })),
});

/** Pure: the Bundle offer editor's values; all blank while the page has no offer. */
export const bundleFormValues = ({ bundleOffer }: ExamPage): BundleOfferForm => ({
  productId: bundleOffer?.productId ?? "",
  headline: bundleOffer?.headline ?? "",
  text: bundleOffer?.text ?? "",
  buttonLabel: bundleOffer?.buttonLabel ?? "",
});

/**
 * Pure: the Search & AI visibility editor's values, for an Exam page or a
 * Site page; blank uses the generated text, or a Site page's text in code.
 */
export const seoFormValues = (
  page: Pick<ExamPage, "seoTitle" | "seoDescription" | "shareImage">,
): ExamSeoForm => ({
  seoTitle: page.seoTitle ?? "",
  seoDescription: page.seoDescription ?? "",
  shareImage: page.shareImage ?? "",
});

/** Pure: the Official Exam Date editor's value. */
export const dateFormValues = (page: ExamPage): OfficialExamDateForm => ({
  officialExamDate: page.officialExamDate ?? "",
});

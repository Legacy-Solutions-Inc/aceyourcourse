import {
  type BundleOfferForm,
  bundleOfferFormSchema,
  type ExamHeaderForm,
  examHeaderFormSchema,
  examSectionSchema,
  type ExamSeoForm,
  examSeoFormSchema,
  type OfficialExamDateForm,
  officialExamDateFormSchema,
  type SubjectNamesForm,
  subjectNamesFormSchema,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminExamPage,
  AdminResult,
  ExamPagePart,
  StaffActor,
} from "@/services/admin.types";
import { type CatalogueSeed, examPageDefaults } from "@/services/catalogue.schema";
import type { ExamPage, ExamPageSection } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { shareImageAsSaved } from "./photos";
import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Exam pages area: each Exam page's
// Header and Subject names (the Exam's own fields), its section toggles,
// bundle offer, SEO overrides and share image, and Official Exam Date. Each
// part is its own record, with its own stamp, because each has its own
// editor and Save: saving one never makes another's open editor conflict.
// The section toggles always save (spec, Phase 2 → Conflict check). An Exam
// without a page record is shown the defaults, and its first save makes one.

/** A part's record key, for the stamp its editor checks. */
const recordOf = (code: string, part: ExamPagePart) => `exam-page:${code}:${part}`;

/** The Exam's code as the catalogue holds it: Exam codes are uppercase. */
const examCodeOf = (code: string) => code.trim().toUpperCase();

const findExam = (catalogue: CatalogueSeed, code: string) =>
  catalogue.exams.find((exam) => exam.code === code);

const exists = (code: string) => (catalogue: CatalogueSeed) =>
  findExam(catalogue, code) !== undefined;

/** The Exam's page record, or the defaults while it has none. */
const pageOf = (catalogue: CatalogueSeed, code: string): ExamPage =>
  catalogue.examPages.find((page) => page.examCode === code) ?? examPageDefaults(code);

/** The draft's page record for the Exam, made from the defaults if it has none. */
function draftPage(draft: CatalogueSeed, code: string): ExamPage {
  const found = draft.examPages.find((page) => page.examCode === code);
  if (found) return found;
  const made = examPageDefaults(code);
  draft.examPages.push(made);
  return made;
}

function adminExamPageOf(catalogue: CatalogueSeed, code: string): AdminExamPage | null {
  const exam = findExam(catalogue, code);
  if (!exam) return null;
  const store = getSampleStore();
  const stamp = (part: ExamPagePart) => stampOf(store, recordOf(code, part));
  return structuredClone({
    exam,
    page: pageOf(catalogue, code),
    stamps: {
      header: stamp("header"),
      subjects: stamp("subjects"),
      sections: stamp("sections"),
      bundleOffer: stamp("bundleOffer"),
      seo: stamp("seo"),
      officialExamDate: stamp("officialExamDate"),
    },
    products: catalogue.products
      .filter((product) => product.examCode === code)
      .map(({ id, shortName, state, showOnWebsite }) => ({ id, shortName, state, showOnWebsite })),
  });
}

/** The saved page, read after the write committed. */
function savedPage(catalogue: CatalogueSeed, code: string): AdminExamPage {
  const saved = adminExamPageOf(catalogue, code);
  if (!saved) throw new Error(`Exam ${code} vanished during its own save`);
  return saved;
}

export async function getExamPageForAdmin(
  _actor: StaffActor,
  code: string,
): Promise<AdminExamPage | null> {
  return adminExamPageOf(getSampleStore().catalogue, examCodeOf(code));
}

const invalid = (field: string, message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: { [field]: [message] },
});

/** The write's settings every part shares. */
function partWrite(code: string, part: ExamPagePart) {
  return {
    role: "staff" as const,
    record: recordOf(code, part),
    exists: exists(code),
    result: (catalogue: CatalogueSeed) => savedPage(catalogue, code),
  };
}

export async function updateExamHeader(
  actor: StaffActor,
  code: string,
  input: ExamHeaderForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  const headerOf = (catalogue: CatalogueSeed) => {
    const exam = findExam(catalogue, examCode);
    return exam
      ? { name: exam.name, longName: exam.longName, blurb: exam.blurb, madeFor: exam.madeFor }
      : null;
  };
  return writeCatalogue(actor, input, expected, {
    ...partWrite(examCode, "header"),
    schema: examHeaderFormSchema,
    activity: { entity: "exam", entityId: examCode, action: "update-header" },
    snapshot: headerOf,
    apply: (draft, header) => {
      const exam = findExam(draft, examCode);
      if (exam) Object.assign(exam, header);
    },
    // The Exam shows on Home, its page, the Products page and its Products' pages.
    tags: [CATALOGUE_TAGS.exams],
  });
}

const CODES_FIXED = "SUBJECT CODES CAN’T BE CHANGED · RELOAD THE PAGE";

export async function updateSubjectNames(
  actor: StaffActor,
  code: string,
  input: SubjectNamesForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  const subjectsOf = (catalogue: CatalogueSeed) => findExam(catalogue, examCode)?.subjects ?? null;
  return writeCatalogue(actor, input, expected, {
    ...partWrite(examCode, "subjects"),
    schema: subjectNamesFormSchema,
    // The codes are fixed (adding Subjects comes in Phase 3), so the list must
    // name the Exam's Subjects, in its order.
    check: (catalogue, { subjects }) => {
      const codes = subjectsOf(catalogue)?.map((subject) => subject.code) ?? [];
      const sent = subjects.map((subject) => subject.code);
      return codes.join("\n") === sent.join("\n")
        ? null
        : { kind: "invalid", fieldErrors: {}, formError: CODES_FIXED };
    },
    activity: { entity: "exam", entityId: examCode, action: "rename-subjects" },
    snapshot: subjectsOf,
    apply: (draft, { subjects }) => {
      const exam = findExam(draft, examCode);
      if (exam) exam.subjects = subjects;
    },
    // Products and the FAQ coverage table name the Subjects through their Exam.
    tags: [CATALOGUE_TAGS.exams],
  });
}

export async function setExamSection(
  actor: StaffActor,
  code: string,
  section: ExamPageSection,
  on: boolean,
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  // A single toggle always saves: there's no form to go stale.
  return writeCatalogue(actor, { section, on }, undefined, {
    ...partWrite(examCode, "sections"),
    schema: examSectionSchema,
    activity: { entity: "exam-page", entityId: examCode, action: "set-section" },
    snapshot: (catalogue) => pageOf(catalogue, examCode).sections,
    apply: (draft, toggle) => {
      draftPage(draft, examCode).sections[toggle.section] = toggle.on;
    },
    tags: [CATALOGUE_TAGS.examPages],
  });
}

const NO_SUCH_PRODUCT = "THAT PRODUCT ISN’T IN THE CATALOGUE · PICK ANOTHER";

export async function updateBundleOffer(
  actor: StaffActor,
  code: string,
  input: BundleOfferForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  return writeCatalogue(actor, input, expected, {
    ...partWrite(examCode, "bundleOffer"),
    schema: bundleOfferFormSchema,
    check: (catalogue, offer) => {
      if (!offer) return null;
      const product = catalogue.products.find((p) => p.id === offer.productId);
      if (!product) return invalid("productId", NO_SUCH_PRODUCT);
      if (product.examCode !== examCode) {
        return invalid("productId", `PICK ONE OF THE ${examCode} PRODUCTS`);
      }
      return null;
    },
    activity: { entity: "exam-page", entityId: examCode, action: "update-bundle-offer" },
    snapshot: (catalogue) => pageOf(catalogue, examCode).bundleOffer,
    apply: (draft, offer) => {
      draftPage(draft, examCode).bundleOffer = offer;
    },
    tags: [CATALOGUE_TAGS.examPages],
  });
}

export async function updateExamSeo(
  actor: StaffActor,
  code: string,
  input: ExamSeoForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  const seoOf = (catalogue: CatalogueSeed) => {
    const { seoTitle, seoDescription, shareImage } = pageOf(catalogue, examCode);
    return { seoTitle, seoDescription, shareImage };
  };
  return writeCatalogue(actor, input, expected, {
    ...partWrite(examCode, "seo"),
    schema: examSeoFormSchema,
    check: (catalogue, fields) => {
      const image = shareImageAsSaved(
        fields.shareImage,
        pageOf(catalogue, examCode).shareImage,
        "share-image",
      );
      return image.ok ? null : image.error;
    },
    activity: { entity: "exam-page", entityId: examCode, action: "update-seo" },
    snapshot: seoOf,
    apply: (draft, fields) => {
      const page = draftPage(draft, examCode);
      // Called once the check has passed, so the image resolves.
      const image = shareImageAsSaved(fields.shareImage, page.shareImage, "share-image");
      if (!image.ok) throw new Error(`Exam ${examCode}'s share image changed during its own save`);
      Object.assign(page, { ...fields, shareImage: image.src });
    },
    tags: [CATALOGUE_TAGS.examPages],
  });
}

export async function updateOfficialExamDate(
  actor: StaffActor,
  code: string,
  input: OfficialExamDateForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  return writeCatalogue(actor, input, expected, {
    ...partWrite(examCode, "officialExamDate"),
    schema: officialExamDateFormSchema,
    activity: { entity: "exam-page", entityId: examCode, action: "update-official-exam-date" },
    snapshot: (catalogue) => pageOf(catalogue, examCode).officialExamDate,
    apply: (draft, { officialExamDate }) => {
      draftPage(draft, examCode).officialExamDate = officialExamDate;
    },
    tags: [CATALOGUE_TAGS.examPages],
  });
}

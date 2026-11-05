import {
  alreadyAnExam,
  alreadyASubject,
  type BundleOfferForm,
  bundleOfferFormSchema,
  deleteExamInputSchema,
  examDeleteBlocker,
  type ExamHeaderForm,
  examHeaderFormSchema,
  examSectionSchema,
  type ExamSeoForm,
  examSeoFormSchema,
  type OfficialExamDateForm,
  officialExamDateFormSchema,
  EXAMS_LIMIT,
  MAX_SUBJECTS,
  newExamCodeOf,
  type NewExamForm,
  newExamFormSchema,
  type NewSubjectForm,
  newSubjectFormSchema,
  subjectCodeInputSchema,
  subjectDeleteBlocker,
  type SubjectNamesForm,
  subjectNamesFormSchema,
  SUBJECTS_LIMIT,
  typedCode,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminExamPage,
  AdminResult,
  ExamPagePart,
  RequiredRole,
  StaffActor,
} from "@/services/admin.types";
import { type CatalogueSeed, examPageDefaults, MAX_EXAMS } from "@/services/catalogue.schema";
import type { Exam, ExamPage, ExamPageSection } from "@/services/catalogue.types";
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
    subjectProducts: Object.fromEntries(
      exam.subjects.map((subject) => [subject.code, taggedWith(catalogue, code, subject.code)]),
    ),
    examsOnWebsite: catalogue.exams
      .filter((e) => catalogue.products.some((p) => p.examCode === e.code && p.showOnWebsite))
      .map((e) => e.code),
  });
}

/** How many Products are tagged with the Exam's Subject. */
const taggedWith = (catalogue: CatalogueSeed, code: string, subject: string) =>
  catalogue.products.filter((p) => p.examCode === code && p.subjectCodes.includes(subject)).length;

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

/** The write's settings every part shares; any Staff User's, unless `role` says Owners. */
function partWrite(code: string, part: ExamPagePart, role: RequiredRole = "staff") {
  return {
    role,
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
    // The codes are fixed (Owners add and delete Subjects on their own), so
    // the list must name the Exam's Subjects, in its order.
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

// ── Adding and deleting Exams and Subjects (ticket 23) ──────────────────────
// Owners only (spec, Phase 2 → "Adding Exams and Subjects"), checked here as
// well as in the Server Action. Codes are fixed once saved. A new Exam goes
// last, with no page record, so its page has every section shown, no bundle
// offer and no Official Exam Date. It stays off the Website until one of its
// Products is on the Website (listExams). An Exam is deleted only while no
// Product belongs to it, and a Subject only while no Product is tagged with
// it; the reason is the refusal's message.

const refusal = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError: message,
});

export async function createExam(
  actor: StaffActor,
  input: NewExamForm,
): Promise<AdminResult<AdminExamPage>> {
  // The Exam's code keys its stamp; one the form gets wrong is refused anyway.
  const examCode = newExamCodeOf(input);
  return writeCatalogue(actor, input, undefined, {
    role: "owner",
    record: recordOf(examCode, "header"),
    schema: newExamFormSchema,
    check: (catalogue, exam) => {
      if (catalogue.exams.length >= MAX_EXAMS) return refusal(EXAMS_LIMIT);
      return findExam(catalogue, exam.code) ? invalid("code", alreadyAnExam(exam.code)) : null;
    },
    activity: { entity: "exam", entityId: examCode, action: "add" },
    snapshot: (catalogue) => findExam(catalogue, examCode) ?? null,
    apply: (draft, exam) => {
      draft.exams.push(exam);
    },
    result: (catalogue) => savedPage(catalogue, examCode),
    // Every Website list of Exams reads the exams tag, though CHE shows on
    // none until one of its Products is on the Website.
    tags: [CATALOGUE_TAGS.exams],
  });
}

export async function addSubject(
  actor: StaffActor,
  code: string,
  input: NewSubjectForm,
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  const subjectsOf = (catalogue: CatalogueSeed) => findExam(catalogue, examCode)?.subjects ?? null;
  return writeCatalogue(actor, input, undefined, {
    ...partWrite(examCode, "subjects", "owner"),
    schema: newSubjectFormSchema,
    check: (catalogue, subject) => {
      const subjects = subjectsOf(catalogue) ?? [];
      if (subjects.some((s) => s.code === subject.code)) {
        return invalid("code", alreadyASubject(subject.code, examCode));
      }
      return subjects.length >= MAX_SUBJECTS ? refusal(SUBJECTS_LIMIT) : null;
    },
    activity: { entity: "exam", entityId: examCode, action: "add-subject" },
    snapshot: subjectsOf,
    apply: (draft, subject) => {
      findExam(draft, examCode)?.subjects.push(subject);
    },
    // Products and the FAQ coverage table name the Subjects through their Exam.
    tags: [CATALOGUE_TAGS.exams],
  });
}

export async function deleteSubject(
  actor: StaffActor,
  code: string,
  subjectCode: string,
): Promise<AdminResult<AdminExamPage>> {
  const examCode = examCodeOf(code);
  const subject = typedCode(subjectCode);
  const subjectsOf = (catalogue: CatalogueSeed) => findExam(catalogue, examCode)?.subjects ?? null;
  return writeCatalogue(actor, { code: subjectCode }, undefined, {
    ...partWrite(examCode, "subjects", "owner"),
    schema: subjectCodeInputSchema,
    exists: (catalogue) => subjectsOf(catalogue)?.some((s) => s.code === subject) ?? false,
    check: (catalogue) => {
      const reason = subjectDeleteBlocker({
        exam: examCode,
        subject,
        products: taggedWith(catalogue, examCode, subject),
        subjects: subjectsOf(catalogue)?.length ?? 0,
      });
      return reason ? refusal(reason) : null;
    },
    activity: { entity: "exam", entityId: examCode, action: "delete-subject" },
    snapshot: subjectsOf,
    apply: (draft) => {
      const exam = findExam(draft, examCode);
      if (exam) exam.subjects = exam.subjects.filter((s) => s.code !== subject);
    },
    tags: [CATALOGUE_TAGS.exams],
  });
}

export async function deleteExam(actor: StaffActor, code: string): Promise<AdminResult<Exam>> {
  const examCode = examCodeOf(code);
  let deleted: Exam | undefined;
  return writeCatalogue(actor, { code }, undefined, {
    role: "owner",
    record: recordOf(examCode, "header"),
    exists: exists(examCode),
    schema: deleteExamInputSchema,
    check: (catalogue) => {
      const products = catalogue.products.filter((p) => p.examCode === examCode).length;
      const reason = examDeleteBlocker(examCode, products);
      return reason ? refusal(reason) : null;
    },
    activity: { entity: "exam", entityId: examCode, action: "delete" },
    // Its Subjects and its page record go with it.
    snapshot: (catalogue) => {
      const exam = findExam(catalogue, examCode);
      if (!exam) return null;
      return { exam, page: catalogue.examPages.find((p) => p.examCode === examCode) ?? null };
    },
    apply: (draft) => {
      deleted = findExam(draft, examCode);
      draft.exams = draft.exams.filter((exam) => exam.code !== examCode);
      draft.examPages = draft.examPages.filter((page) => page.examCode !== examCode);
    },
    result: () => {
      if (!deleted) throw new Error(`Exam ${examCode} wasn't there to delete`);
      return structuredClone(deleted);
    },
    tags: [CATALOGUE_TAGS.exams, CATALOGUE_TAGS.examPages],
  });
}

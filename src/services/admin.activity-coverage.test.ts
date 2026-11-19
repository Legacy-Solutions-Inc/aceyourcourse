import { beforeEach, describe, expect, it } from "vitest";

import { aboutSectionFormValues } from "@/lib/admin/about-form";
import { faqFormValues } from "@/lib/admin/faq-form";
import { productFormValues } from "@/lib/admin/product-form";
import { announcementFormValues, promoBannerFormValues } from "@/lib/admin/promo-form";
import { reviewFormValues } from "@/lib/admin/review-form";
import * as adminSeam from "@/services/admin";
import type { AdminService } from "@/services/admin";
import type { AdminResult, StaffActor } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { hashDeviceToken } from "@/lib/member-app/device-token";
import { createFakeRenderer } from "@/services/page-images.fake";

import {
  SAVES,
  sampleActor,
  sampleEmail,
  UNUSED_EXAM,
  withUnusedExam,
} from "../../test/admin-inputs";
import { type AdminArm, ADMIN_ARMS } from "../../test/admin-arms";
import { importCsv, quizCsv } from "../../test/import-files";
import { pdfOfPages } from "../../test/reviewer-pdfs";

// ─────────────────────────────────────────────────────────────────────────────
// Staff Activity covers every Admin write (spec, Phase 2 → Staff Activity;
// story 80). Each seam write is called once with an input that saves, and
// appends exactly one record for the entity it changed: who, the entity, the
// action, and the values before and after. Each is called once more with an
// input it refuses (a validation error, or a record that isn't there), and
// appends none. A write the table below doesn't know fails the first test, so
// a new one can't skip Staff Activity unnoticed.
// ─────────────────────────────────────────────────────────────────────────────

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");
const KIM = sampleEmail("invited");
const EXPIRED = sampleEmail("expired");
/** The Beta Tester the sample data starts with. */
const SAMPLE_TESTER = "tester@example.com";
/** A Member signed in to the Member App on one device. */
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: SAMPLE_TESTER,
  name: "Bea Tester",
};
/** An empty sample Topic, in CE's MSTC. */
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const UNKNOWN_TOPIC = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

/** The seam's reads: they change nothing. */
const READS = [
  "getStaffByEmail",
  "getLatestDeniedSignIn",
  "listStaff",
  "listBetaTesters",
  // The Users list and a Member's detail page (ticket 16).
  "listUsers",
  "getMemberForAdmin",
  "getOverview",
  "getSettingsForAdmin",
  "listProductsForAdmin",
  "listExamsForAdmin",
  "getProductForAdmin",
  "previewProductDelete",
  "listReviewsForAdmin",
  "getReviewForAdmin",
  "previewReviewDelete",
  "listFaqsForAdmin",
  "getFaqForAdmin",
  "getExamPageForAdmin",
  "getSitePageForAdmin",
  "getAboutForAdmin",
  "getPromoForAdmin",
  "getAnnouncementForAdmin",
  "listTopicsForAdmin",
  // "Check file" for a card import: a preview, which saves nothing.
  "planCardImport",
  // The card editor's deck screen, and a card's image for Staff.
  "getDeckForAdmin",
  "getCardImageForAdmin",
  // "Check file" for a quiz import, the quiz screen, and a question's figure for Staff.
  "planQuizImport",
  "getQuizForAdmin",
  "getQuestionFigureForAdmin",
  // The Reviewer PDFs screen (ticket 12), and one Reviewer PDF's screen and preview (ticket 13).
  "listReviewerPdfsForAdmin",
  "getReviewerPdfForAdmin",
  "getReviewerPdfPageForAdmin",
] as const satisfies readonly (keyof AdminService)[];

/**
 * The Reviewer PDF job's runs and the cron's restarts (ticket 12): they
 * change a job's progress, but they're no Staff User's doing, so they record
 * no Staff Activity. The upload that started the job recorded it.
 */
const JOB_CALLS = [
  "runReviewerPdfJob",
  "restartStaleReviewerPdfJobs",
] as const satisfies readonly (keyof AdminService)[];

/**
 * Sign-in bookkeeping, which changes nothing in the Admin, so it records no
 * Staff Activity: the refusal log and "LAST SIGNED IN".
 */
const SIGN_IN_RECORDS = [
  "recordDeniedSignIn",
  "recordSignIn",
] as const satisfies readonly (keyof AdminService)[];

interface Write {
  /** Who makes it: the least Staff Role allowed. */
  actor: StaffActor;
  entity: string;
  /** The changed entity's id, or any id for a new one. */
  entityId: string | null;
  saves: (seam: AdminService, actor: StaffActor, arm: AdminArm) => Promise<AdminResult<unknown>>;
  /** An input it refuses, and why. */
  refused: (seam: AdminService, actor: StaffActor, arm: AdminArm) => Promise<AdminResult<unknown>>;
  refusal: "invalid" | "not-found";
  /** The data it saves on, when the seed has nothing it can save: an edited copy of the seed. */
  seed?: (seed: CatalogueSeed) => void;
  /** What it saves on that the seed lacks, made through the seam before it's measured. */
  setUp?: (seam: AdminService, arm: AdminArm) => Promise<void>;
}

/** A Hidden deck with no cards in the seed, in CE's MSTC. */
const ALGEBRA = sampleTopicId("CE", "MSTC", "Algebra");
const ALGEBRA_DECK = sampleContentId(ALGEBRA, "deck");
/** The two cards withTwoCards adds to Algebra's deck, first and second. */
const cards = { first: "", second: "" };

/** Gives Algebra's deck two cards, for the card editor's writes. */
async function withTwoCards(seam: AdminService) {
  for (const key of ["first", "second"] as const) {
    const added = await seam.createCard(EDITOR, {
      topic: ALGEBRA,
      front: key,
      back: "$x^2$",
      image: null,
    });
    if (!added.ok) throw new Error("The card wasn't added");
    cards[key] = added.value.id;
  }
}

/** The stamp every record has before anyone saves it. */
async function opened(seam: AdminService) {
  return (await seam.getSettingsForAdmin()).stamp;
}

async function productForm(seam: AdminService, id: string) {
  const found = await seam.getProductForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return productFormValues(found.product);
}

async function reviewForm(seam: AdminService, id: string) {
  const found = await seam.getReviewForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return reviewFormValues(found.review);
}

async function faqForm(seam: AdminService, id: string) {
  const found = await seam.getFaqForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return faqFormValues(found.faq);
}

async function cePage(seam: AdminService) {
  const found = await seam.getExamPageForAdmin(EDITOR, "ce");
  if (!found) throw new Error("CE isn't in the sample data");
  return found;
}

/** A card import's files, uploaded and checked, ready to confirm. */
async function checkedImport(seam: AdminService, arm: AdminArm, rows: string[]) {
  const paths = await arm.uploadImport({ csv: importCsv(rows) });
  const input = { exam: "ce", subject: "mstc", mode: "add", ...paths } as const;
  const planned = await seam.planCardImport(EDITOR, input);
  if (!planned.ok) throw new Error("The import's files were refused");
  return { ...input, basedOn: planned.value.basedOn };
}

/** A quiz import's files, uploaded and checked, ready to confirm. */
async function checkedQuizImport(seam: AdminService, arm: AdminArm, rows: string[]) {
  const paths = await arm.uploadImport({ csv: quizCsv(rows) });
  const input = { exam: "ce", subject: "mstc", mode: "add", ...paths } as const;
  const planned = await seam.planQuizImport(EDITOR, input);
  if (!planned.ok) throw new Error("The import's files were refused");
  return { ...input, basedOn: planned.value.basedOn };
}

/** The Visible quiz with no questions in the seed, and the Hidden one, in CE's MSTC. */
const SIMPLE_CURVES_QUIZ = sampleContentId(sampleTopicId("CE", "MSTC", "Simple Curves"), "quiz");
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SPIRAL_CURVES_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");

/** A question's fields that save. */
const QUESTION = {
  choices: { A: "1", B: "2", C: "3", D: "4" },
  correct: "B",
  explanation: "$L_s = 0.036 V^3/R$",
  figure: null,
} as const;
/** The two questions withTwoQuestions adds to Spiral Curves' Hidden quiz, first and second. */
const questions = { first: "", second: "" };

/** Gives Spiral Curves' Hidden quiz two questions, for the question editor's writes. */
async function withTwoQuestions(seam: AdminService) {
  for (const key of ["first", "second"] as const) {
    const added = await seam.createQuestion(EDITOR, {
      topic: SPIRAL_CURVES,
      question: key,
      ...QUESTION,
    });
    if (!added.ok) throw new Error("The question wasn't added");
    questions[key] = added.value.id;
  }
}

async function promoForm(seam: AdminService) {
  return promoBannerFormValues((await seam.getPromoForAdmin(EDITOR)).banner);
}

/** Every Admin write that takes a Staff User, with an input it saves and one it refuses. */
/** The Reviewer PDF withReviewerPdf uploads. */
const reviewerPdf = { id: "" };

/** Uploads and records a Reviewer PDF through the seam. */
async function withReviewerPdf(seam: AdminService, arm: AdminArm) {
  const recorded = await seam.recordReviewerPdf(EDITOR, {
    path: await arm.uploadReviewerPdf(pdfOfPages(2)),
    fileName: "Old Reviewer.pdf",
  });
  if (!recorded.ok) throw new Error("The Reviewer PDF wasn't recorded");
  reviewerPdf.id = recorded.value.id;
}

/** Uploads a Reviewer PDF and splits it into pages: a Draft, ready to place. */
async function withSplitReviewerPdf(seam: AdminService, arm: AdminArm) {
  await withReviewerPdf(seam, arm);
  while ((await seam.runReviewerPdfJob(reviewerPdf.id, createFakeRenderer())) === "more");
}

/** A Draft Reviewer PDF placed under Surveying: ready to publish. */
async function withPlacedReviewerPdf(seam: AdminService, arm: AdminArm) {
  await withSplitReviewerPdf(seam, arm);
  const placed = await seam.placeReviewerPdf(EDITOR, { id: reviewerPdf.id, topic: SURVEYING });
  if (!placed.ok) throw new Error("The Reviewer PDF wasn't placed");
}

const WRITES: Record<string, Write> = {
  inviteStaff: {
    actor: OWNER,
    entity: "invite",
    entityId: SAVES.invite.email,
    saves: (seam, actor) => seam.inviteStaff(actor, SAVES.invite),
    refused: (seam, actor) => seam.inviteStaff(actor, { email: "not-an-email", role: "editor" }),
    refusal: "invalid",
  },
  renewInvite: {
    actor: OWNER,
    entity: "invite",
    entityId: EXPIRED,
    saves: (seam, actor) => seam.renewInvite(actor, EXPIRED),
    refused: (seam, actor) => seam.renewInvite(actor, "not-an-email"),
    refusal: "invalid",
  },
  cancelInvite: {
    actor: OWNER,
    entity: "invite",
    entityId: KIM,
    saves: (seam, actor) => seam.cancelInvite(actor, KIM),
    refused: (seam, actor) => seam.cancelInvite(actor, "not-an-email"),
    refusal: "invalid",
  },
  changeStaffRole: {
    actor: OWNER,
    entity: "staff",
    entityId: EDITOR.email,
    saves: (seam, actor) => seam.changeStaffRole(actor, { email: EDITOR.email, role: "owner" }),
    refused: (seam, actor) =>
      // @ts-expect-error A Staff Role that doesn't exist, as a forged request might send.
      seam.changeStaffRole(actor, { email: EDITOR.email, role: "admin" }),
    refusal: "invalid",
  },
  removeStaff: {
    actor: OWNER,
    entity: "staff",
    entityId: EDITOR.email,
    saves: (seam, actor) => seam.removeStaff(actor, EDITOR.email),
    refused: (seam, actor) => seam.removeStaff(actor, "not-an-email"),
    refusal: "invalid",
  },
  addBetaTester: {
    actor: OWNER,
    entity: "beta-tester",
    entityId: SAVES.betaTester,
    saves: (seam, actor) => seam.addBetaTester(actor, { email: SAVES.betaTester }),
    refused: (seam, actor) => seam.addBetaTester(actor, { email: "not-an-email" }),
    refusal: "invalid",
  },
  removeBetaTester: {
    actor: OWNER,
    entity: "beta-tester",
    entityId: SAMPLE_TESTER,
    saves: (seam, actor) => seam.removeBetaTester(actor, SAMPLE_TESTER),
    refused: (seam, actor) => seam.removeBetaTester(actor, SAVES.betaTester),
    refusal: "not-found",
  },
  forceSignOut: {
    actor: OWNER,
    entity: "member",
    entityId: BEA.userId,
    saves: (seam, actor) => seam.forceSignOut(actor, { userId: BEA.userId, reason: "Shared" }),
    refused: (seam, actor) => seam.forceSignOut(actor, { userId: BEA.userId, reason: " " }),
    refusal: "invalid",
    setUp: async (_seam, arm) => {
      await arm.member.getOrCreateMember(BEA);
      await arm.member.claimDevice(BEA.userId, {
        tokenHash: hashDeviceToken("bea-phone"),
        deviceLabel: "Chrome on Android",
      });
    },
  },
  updateWebsiteSettings: {
    actor: OWNER,
    entity: "settings",
    entityId: "website",
    saves: async (seam, actor) =>
      seam.updateWebsiteSettings(actor, { contactEmail: SAVES.contactEmail }, await opened(seam)),
    refused: async (seam, actor) =>
      seam.updateWebsiteSettings(actor, { contactEmail: "not-an-email" }, await opened(seam)),
    refusal: "invalid",
  },
  setProductFlags: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-001",
    saves: (seam, actor) => seam.setProductFlags(actor, "prd-001", { showOnWebsite: false }),
    refused: (seam, actor) => seam.setProductFlags(actor, "prd-001", {}),
    refusal: "invalid",
  },
  createProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: null,
    saves: (seam, actor) => seam.createProduct(actor, SAVES.newProduct),
    refused: (seam, actor) => seam.createProduct(actor, { ...SAVES.newProduct, title: "" }),
    refusal: "invalid",
  },
  updateProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-001",
    saves: async (seam, actor) =>
      seam.updateProduct(
        actor,
        "prd-001",
        { ...(await productForm(seam, "prd-001")), priceFrom: SAVES.priceFrom },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateProduct(
        actor,
        "prd-001",
        { ...(await productForm(seam, "prd-001")), priceFrom: "abc" },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  deleteProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-005",
    saves: (seam, actor) => seam.deleteProduct(actor, "prd-005"),
    refused: (seam, actor) => seam.deleteProduct(actor, "prd-999"),
    refusal: "not-found",
  },
  createReview: {
    actor: EDITOR,
    entity: "review",
    entityId: null,
    saves: (seam, actor) => seam.createReview(actor, SAVES.newReview),
    refused: (seam, actor) => seam.createReview(actor, { ...SAVES.newReview, text: "" }),
    refusal: "invalid",
  },
  updateReview: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-002",
    saves: async (seam, actor) =>
      seam.updateReview(
        actor,
        "rev-002",
        { ...(await reviewForm(seam, "rev-002")), stars: 4 },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateReview(
        actor,
        "rev-002",
        { ...(await reviewForm(seam, "rev-002")), stars: 0 },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  setReviewPinned: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-002",
    saves: (seam, actor) => seam.setReviewPinned(actor, "rev-002", true),
    refused: (seam, actor) => seam.setReviewPinned(actor, "rev-999", true),
    refusal: "not-found",
  },
  moveReviewPin: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-006",
    saves: (seam, actor) => seam.moveReviewPin(actor, "rev-006", "up"),
    // rev-013 is first on Home.
    refused: (seam, actor) => seam.moveReviewPin(actor, "rev-013", "up"),
    refusal: "invalid",
  },
  deleteReview: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-014",
    saves: (seam, actor) => seam.deleteReview(actor, "rev-014"),
    refused: (seam, actor) => seam.deleteReview(actor, "rev-999"),
    refusal: "not-found",
  },
  createFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: null,
    saves: (seam, actor) => seam.createFaq(actor, SAVES.newFaq),
    refused: (seam, actor) => seam.createFaq(actor, { ...SAVES.newFaq, answer: "a".repeat(401) }),
    refusal: "invalid",
  },
  updateFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-002",
    saves: async (seam, actor) =>
      seam.updateFaq(
        actor,
        "faq-002",
        { ...(await faqForm(seam, "faq-002")), answer: "Yes." },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateFaq(
        actor,
        "faq-002",
        { ...(await faqForm(seam, "faq-002")), question: "" },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  moveFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-001",
    saves: (seam, actor) => seam.moveFaq(actor, "faq-001", "down"),
    // faq-001 is first in Shipping.
    refused: (seam, actor) => seam.moveFaq(actor, "faq-001", "up"),
    refusal: "invalid",
  },
  deleteFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-001",
    saves: (seam, actor) => seam.deleteFaq(actor, "faq-001"),
    refused: (seam, actor) => seam.deleteFaq(actor, "faq-999"),
    refusal: "not-found",
  },
  updateExamHeader: {
    actor: EDITOR,
    entity: "exam",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const { name, longName, madeFor } = exam;
      return seam.updateExamHeader(
        actor,
        "ce",
        { name, longName, madeFor, blurb: SAVES.examBlurb },
        stamps.header,
      );
    },
    refused: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const { longName, blurb, madeFor } = exam;
      return seam.updateExamHeader(
        actor,
        "ce",
        { name: "", longName, blurb, madeFor },
        stamps.header,
      );
    },
    refusal: "invalid",
  },
  updateSubjectNames: {
    actor: EDITOR,
    entity: "exam",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const subjects = exam.subjects.map((subject, i) =>
        i === 0 ? { ...subject, name: "Math" } : subject,
      );
      return seam.updateSubjectNames(actor, "ce", { subjects }, stamps.subjects);
    },
    refused: async (seam, actor) =>
      seam.updateSubjectNames(actor, "ce", { subjects: [] }, (await cePage(seam)).stamps.subjects),
    refusal: "invalid",
  },
  setExamSection: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "ME",
    saves: (seam, actor) => seam.setExamSection(actor, "me", "reviews", false),
    refused: (seam, actor) => seam.setExamSection(actor, "zz", "reviews", false),
    refusal: "not-found",
  },
  updateBundleOffer: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { page, stamps } = await cePage(seam);
      const offer = page.bundleOffer;
      if (!offer) throw new Error("CE has no bundle offer");
      return seam.updateBundleOffer(
        actor,
        "ce",
        { ...offer, headline: SAVES.bundleHeadline },
        stamps.bundleOffer,
      );
    },
    refused: async (seam, actor) => {
      const { page, stamps } = await cePage(seam);
      const offer = page.bundleOffer;
      if (!offer) throw new Error("CE has no bundle offer");
      return seam.updateBundleOffer(
        actor,
        "ce",
        { ...offer, productId: "prd-999" },
        stamps.bundleOffer,
      );
    },
    refusal: "invalid",
  },
  updateExamSeo: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { stamps } = await cePage(seam);
      return seam.updateExamSeo(
        actor,
        "ce",
        { seoTitle: SAVES.seoTitle, seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refused: async (seam, actor) => {
      const { stamps } = await cePage(seam);
      return seam.updateExamSeo(
        actor,
        "ce",
        { seoTitle: "T".repeat(80), seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refusal: "invalid",
  },
  updateSitePageSeo: {
    actor: EDITOR,
    entity: "site-page",
    entityId: "about",
    saves: async (seam, actor) => {
      const { stamps } = await seam.getSitePageForAdmin(actor, "about");
      return seam.updateSitePageSeo(
        actor,
        "about",
        { seoTitle: SAVES.seoTitle, seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refused: async (seam, actor) => {
      const { stamps } = await seam.getSitePageForAdmin(actor, "about");
      return seam.updateSitePageSeo(
        actor,
        "about",
        { seoTitle: "T".repeat(80), seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refusal: "invalid",
  },
  updateAboutSection: {
    actor: EDITOR,
    entity: "site-page",
    entityId: "about",
    saves: async (seam, actor) => {
      const { about, stamps } = await seam.getAboutForAdmin(actor);
      return seam.updateAboutSection(
        actor,
        { ...aboutSectionFormValues(about, "roots"), heading: "Packed in Iloilo." },
        stamps.roots,
      );
    },
    refused: async (seam, actor) => {
      const { about, stamps } = await seam.getAboutForAdmin(actor);
      return seam.updateAboutSection(
        actor,
        { ...aboutSectionFormValues(about, "roots"), heading: "R".repeat(500) },
        stamps.roots,
      );
    },
    refusal: "invalid",
  },
  updateOfficialExamDate: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) =>
      seam.updateOfficialExamDate(
        actor,
        "ce",
        { officialExamDate: SAVES.officialExamDate },
        (await cePage(seam)).stamps.officialExamDate,
      ),
    refused: async (seam, actor) =>
      seam.updateOfficialExamDate(
        actor,
        "ce",
        { officialExamDate: "2027-02-30" },
        (await cePage(seam)).stamps.officialExamDate,
      ),
    refusal: "invalid",
  },
  createExam: {
    actor: OWNER,
    entity: "exam",
    entityId: "CHE",
    saves: (seam, actor) => seam.createExam(actor, UNUSED_EXAM),
    refused: (seam, actor) => seam.createExam(actor, { ...UNUSED_EXAM, code: "C" }),
    refusal: "invalid",
  },
  addSubject: {
    actor: OWNER,
    entity: "exam",
    entityId: "CE",
    saves: (seam, actor) => seam.addSubject(actor, "ce", { code: "THERMO", name: "Thermo" }),
    refused: (seam, actor) => seam.addSubject(actor, "ce", { code: "MSTC", name: "Maths" }),
    refusal: "invalid",
  },
  deleteSubject: {
    actor: OWNER,
    entity: "exam",
    entityId: "CHE",
    seed: withUnusedExam,
    saves: (seam, actor) => seam.deleteSubject(actor, "che", "THERMO"),
    refused: (seam, actor) => seam.deleteSubject(actor, "che", "GEO"),
    refusal: "not-found",
  },
  deleteExam: {
    actor: OWNER,
    entity: "exam",
    entityId: "CHE",
    seed: withUnusedExam,
    saves: (seam, actor) => seam.deleteExam(actor, "che"),
    refused: (seam, actor) => seam.deleteExam(actor, "zz"),
    refusal: "not-found",
  },
  createTopic: {
    actor: EDITOR,
    entity: "topic",
    entityId: null,
    saves: (seam, actor) =>
      seam.createTopic(actor, { exam: "ce", subject: "mstc", name: "Highways" }),
    refused: (seam, actor) => seam.createTopic(actor, { exam: "ce", subject: "mstc", name: " " }),
    refusal: "invalid",
  },
  renameTopic: {
    actor: EDITOR,
    entity: "topic",
    entityId: SURVEYING,
    saves: (seam, actor) => seam.renameTopic(actor, { id: SURVEYING, name: "Leveling" }),
    refused: (seam, actor) => seam.renameTopic(actor, { id: UNKNOWN_TOPIC, name: "Leveling" }),
    refusal: "not-found",
  },
  moveTopic: {
    actor: EDITOR,
    entity: "topic",
    entityId: SURVEYING,
    saves: (seam, actor) => seam.moveTopic(actor, SURVEYING, "up"),
    refused: (seam, actor) => seam.moveTopic(actor, UNKNOWN_TOPIC, "up"),
    refusal: "not-found",
  },
  deleteTopic: {
    actor: EDITOR,
    entity: "topic",
    entityId: SURVEYING,
    saves: (seam, actor) => seam.deleteTopic(actor, SURVEYING),
    // Simple Curves has a deck, a quiz and a Reviewer PDF.
    refused: (seam, actor) => seam.deleteTopic(actor, sampleTopicId("CE", "MSTC", "Simple Curves")),
    refusal: "invalid",
  },
  confirmCardImport: {
    actor: EDITOR,
    entity: "card-import",
    entityId: "CE:MSTC",
    saves: async (seam, actor, arm) =>
      seam.confirmCardImport(
        actor,
        await checkedImport(seam, arm, ["Highways,Grade,Rise over run,,"]),
      ),
    // A formula that won't render.
    refused: async (seam, actor, arm) =>
      seam.confirmCardImport(actor, await checkedImport(seam, arm, ["Highways,Grade,$x,,"])),
    refusal: "invalid",
  },
  createCard: {
    actor: EDITOR,
    entity: "card",
    entityId: null,
    saves: (seam, actor) =>
      seam.createCard(actor, {
        topic: ALGEBRA,
        front: "Grade",
        back: "Rise over run",
        image: null,
      }),
    refused: (seam, actor) =>
      seam.createCard(actor, { topic: ALGEBRA, front: " ", back: "Rise over run", image: null }),
    refusal: "invalid",
  },
  updateCard: {
    actor: EDITOR,
    entity: "card",
    entityId: null,
    setUp: withTwoCards,
    saves: (seam, actor) =>
      seam.updateCard(actor, { id: cards.first, front: "First, edited", back: "$x$", image: null }),
    refused: (seam, actor) =>
      seam.updateCard(actor, { id: UNKNOWN_TOPIC, front: "F", back: "B", image: null }),
    refusal: "not-found",
  },
  moveCard: {
    actor: EDITOR,
    entity: "card",
    entityId: null,
    setUp: withTwoCards,
    saves: (seam, actor) => seam.moveCard(actor, cards.second, "up"),
    refused: (seam, actor) => seam.moveCard(actor, UNKNOWN_TOPIC, "up"),
    refusal: "not-found",
  },
  deleteCard: {
    actor: EDITOR,
    entity: "card",
    entityId: null,
    setUp: withTwoCards,
    saves: (seam, actor) => seam.deleteCard(actor, cards.first),
    refused: (seam, actor) => seam.deleteCard(actor, UNKNOWN_TOPIC),
    refusal: "not-found",
  },
  setDeckVisibility: {
    actor: EDITOR,
    entity: "deck",
    entityId: ALGEBRA_DECK,
    setUp: withTwoCards,
    saves: (seam, actor) => seam.setDeckVisibility(actor, ALGEBRA_DECK, true),
    refused: (seam, actor) => seam.setDeckVisibility(actor, UNKNOWN_TOPIC, true),
    refusal: "not-found",
  },
  setDeckFreePreview: {
    actor: EDITOR,
    entity: "deck",
    entityId: ALGEBRA_DECK,
    saves: (seam, actor) => seam.setDeckFreePreview(actor, ALGEBRA_DECK, true),
    refused: (seam, actor) => seam.setDeckFreePreview(actor, UNKNOWN_TOPIC, true),
    refusal: "not-found",
  },
  confirmQuizImport: {
    actor: EDITOR,
    entity: "quiz-import",
    entityId: "CE:MSTC",
    saves: async (seam, actor, arm) =>
      seam.confirmQuizImport(
        actor,
        await checkedQuizImport(seam, arm, ["Highways,Grade?,1,2,3,4,A,Rise over run.,"]),
      ),
    // A correct answer that isn't A–D.
    refused: async (seam, actor, arm) =>
      seam.confirmQuizImport(
        actor,
        await checkedQuizImport(seam, arm, ["Highways,Grade?,1,2,3,4,E,Rise over run.,"]),
      ),
    refusal: "invalid",
  },
  updateQuizSettings: {
    actor: EDITOR,
    entity: "quiz",
    entityId: SPIRAL_CURVES_QUIZ,
    saves: (seam, actor) =>
      seam.updateQuizSettings(actor, {
        id: SPIRAL_CURVES_QUIZ,
        passingScore: 85,
        shuffle: false,
        showAnswers: true,
      }),
    refused: (seam, actor) =>
      seam.updateQuizSettings(actor, {
        id: SPIRAL_CURVES_QUIZ,
        passingScore: 101,
        shuffle: false,
        showAnswers: true,
      }),
    refusal: "invalid",
  },
  setQuizVisibility: {
    actor: EDITOR,
    entity: "quiz",
    entityId: SIMPLE_CURVES_QUIZ,
    // The seed's Simple Curves quiz is Visible, with no questions: Hidden always saves.
    saves: (seam, actor) => seam.setQuizVisibility(actor, SIMPLE_CURVES_QUIZ, false),
    refused: (seam, actor) => seam.setQuizVisibility(actor, UNKNOWN_TOPIC, false),
    refusal: "not-found",
  },
  setQuizFreePreview: {
    actor: EDITOR,
    entity: "quiz",
    entityId: SPIRAL_CURVES_QUIZ,
    saves: (seam, actor) => seam.setQuizFreePreview(actor, SPIRAL_CURVES_QUIZ, true),
    refused: (seam, actor) => seam.setQuizFreePreview(actor, UNKNOWN_TOPIC, true),
    refusal: "not-found",
  },
  createQuestion: {
    actor: EDITOR,
    entity: "question",
    entityId: null,
    saves: (seam, actor) =>
      seam.createQuestion(actor, { topic: SPIRAL_CURVES, question: "Grade?", ...QUESTION }),
    // No correct choice picked.
    refused: (seam, actor) =>
      seam.createQuestion(actor, {
        topic: SPIRAL_CURVES,
        question: "Grade?",
        ...QUESTION,
        correct: "",
      }),
    refusal: "invalid",
  },
  updateQuestion: {
    actor: EDITOR,
    entity: "question",
    entityId: null,
    setUp: withTwoQuestions,
    saves: (seam, actor) =>
      seam.updateQuestion(actor, { id: questions.first, question: "First, edited", ...QUESTION }),
    refused: (seam, actor) =>
      seam.updateQuestion(actor, { id: UNKNOWN_TOPIC, question: "Gone?", ...QUESTION }),
    refusal: "not-found",
  },
  moveQuestion: {
    actor: EDITOR,
    entity: "question",
    entityId: null,
    setUp: withTwoQuestions,
    saves: (seam, actor) => seam.moveQuestion(actor, questions.second, "up"),
    refused: (seam, actor) => seam.moveQuestion(actor, UNKNOWN_TOPIC, "up"),
    refusal: "not-found",
  },
  deleteQuestion: {
    actor: EDITOR,
    entity: "question",
    entityId: null,
    setUp: withTwoQuestions,
    saves: (seam, actor) => seam.deleteQuestion(actor, questions.first),
    refused: (seam, actor) => seam.deleteQuestion(actor, UNKNOWN_TOPIC),
    refusal: "not-found",
  },
  recordReviewerPdf: {
    actor: EDITOR,
    entity: "reviewer-pdf",
    entityId: null,
    saves: async (seam, actor, arm) =>
      seam.recordReviewerPdf(actor, {
        path: await arm.uploadReviewerPdf(pdfOfPages(2)),
        fileName: "MSTC Reviewer.pdf",
      }),
    // The browser never finished sending it.
    refused: async (seam, actor, arm) =>
      seam.recordReviewerPdf(actor, {
        path: await arm.uploadReviewerPdf(pdfOfPages(2), { send: false }),
        fileName: "MSTC Reviewer.pdf",
      }),
    refusal: "invalid",
  },
  deleteReviewerPdf: {
    actor: EDITOR,
    entity: "reviewer-pdf",
    entityId: null,
    setUp: withReviewerPdf,
    saves: (seam, actor) => seam.deleteReviewerPdf(actor, reviewerPdf.id),
    refused: (seam, actor) => seam.deleteReviewerPdf(actor, UNKNOWN_TOPIC),
    refusal: "not-found",
  },
  placeReviewerPdf: {
    actor: EDITOR,
    entity: "reviewer-pdf",
    entityId: null,
    setUp: withSplitReviewerPdf,
    saves: (seam, actor) => seam.placeReviewerPdf(actor, { id: reviewerPdf.id, topic: SURVEYING }),
    refused: (seam, actor) => seam.placeReviewerPdf(actor, { id: UNKNOWN_TOPIC, topic: SURVEYING }),
    refusal: "not-found",
  },
  setReviewerPdfPublished: {
    actor: EDITOR,
    entity: "reviewer-pdf",
    entityId: null,
    setUp: withPlacedReviewerPdf,
    saves: (seam, actor) => seam.setReviewerPdfPublished(actor, reviewerPdf.id, true),
    refused: (seam, actor) => seam.setReviewerPdfPublished(actor, UNKNOWN_TOPIC, true),
    refusal: "not-found",
  },
  setReviewerPdfFreePreview: {
    actor: EDITOR,
    entity: "reviewer-pdf",
    entityId: null,
    setUp: withReviewerPdf,
    saves: (seam, actor) => seam.setReviewerPdfFreePreview(actor, reviewerPdf.id, true),
    refused: (seam, actor) => seam.setReviewerPdfFreePreview(actor, UNKNOWN_TOPIC, true),
    refusal: "not-found",
  },
  updatePromoBanner: {
    actor: EDITOR,
    entity: "promo-banner",
    entityId: "home",
    saves: async (seam, actor) =>
      seam.updatePromoBanner(
        actor,
        { ...(await promoForm(seam)), buttonLabel: SAVES.bannerButtonLabel },
        (await seam.getPromoForAdmin(actor)).stamp,
      ),
    refused: async (seam, actor) =>
      seam.updatePromoBanner(
        actor,
        { ...(await promoForm(seam)), text: "a".repeat(81) },
        (await seam.getPromoForAdmin(actor)).stamp,
      ),
    refusal: "invalid",
  },
  setPromoBannerVisible: {
    actor: EDITOR,
    entity: "promo-banner",
    entityId: "home",
    // The seed's banner is off.
    saves: (seam, actor) => seam.setPromoBannerVisible(actor, true),
    // @ts-expect-error Not a switch's value, as a forged request might send.
    refused: (seam, actor) => seam.setPromoBannerVisible(actor, "on"),
    refusal: "invalid",
  },
  updateAnnouncement: {
    actor: EDITOR,
    entity: "announcement",
    entityId: "website",
    saves: async (seam, actor) => {
      const { announcement, stamp } = await seam.getAnnouncementForAdmin(actor);
      const { messages } = announcementFormValues(announcement);
      return seam.updateAnnouncement(actor, { messages: messages.slice(0, 1) }, stamp);
    },
    refused: async (seam, actor) =>
      seam.updateAnnouncement(
        actor,
        { messages: [] },
        (await seam.getAnnouncementForAdmin(actor)).stamp,
      ),
    refusal: "invalid",
  },
};

/** resolveSignIn writes too: the first sign-in with an Invite's email activates it. */
const ACTIVATION = "resolveSignIn";

describe("the Staff Activity table", () => {
  it("knows every function of the Admin seam: a read, sign-in bookkeeping, or a write", () => {
    const known = [
      ...READS,
      ...SIGN_IN_RECORDS,
      ...JOB_CALLS,
      ACTIVATION,
      ...Object.keys(WRITES),
    ].sort();
    expect(Object.keys(adminSeam).sort()).toEqual(known);
  });
});

describe.each(ADMIN_ARMS)("Staff Activity on every Admin write ($name)", (arm) => {
  const { seam } = arm;
  const writes = Object.entries(WRITES);

  beforeEach(async () => {
    await arm.reset();
  });

  /** Calls `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    const after = await arm.staffActivity();
    expect(after.slice(0, before.length)).toEqual(before);
    return { result, appended: after.slice(before.length) };
  }

  it.each(writes)(
    "%s appends exactly one record, with the values before and after",
    async (_name, write) => {
      if (write.seed) await arm.reset(write.seed);
      await write.setUp?.(seam, arm);
      const { result, appended } = await appendedBy(() => write.saves(seam, write.actor, arm));

      expect(result).toMatchObject({ ok: true });
      expect(appended).toHaveLength(1);
      const [record] = appended;
      expect(Object.keys(record ?? {}).sort()).toEqual(
        ["action", "actor", "after", "at", "before", "entity", "entityId", "id"].sort(),
      );
      expect(record).toMatchObject({
        id: expect.any(String),
        at: expect.any(String),
        actor: { email: write.actor.email, name: write.actor.name },
        entity: write.entity,
        entityId: write.entityId ?? expect.any(String),
        action: expect.any(String),
      });
      // The values are the entity's own, from before and after the write; each
      // area's suite checks them field by field.
      expect(record?.after).not.toEqual(record?.before);
    },
  );

  it.each(writes)("%s appends nothing when it's refused", async (_name, write) => {
    if (write.seed) await arm.reset(write.seed);
    await write.setUp?.(seam, arm);
    const { result, appended } = await appendedBy(() => write.refused(seam, write.actor, arm));

    expect(result).toMatchObject({ ok: false, error: { kind: write.refusal } });
    expect(appended).toEqual([]);
  });

  it.each(writes.filter(([, write]) => write.actor.role === "owner"))(
    "%s appends nothing for an Editor, who isn't allowed it",
    async (_name, write) => {
      if (write.seed) await arm.reset(write.seed);
      await write.setUp?.(seam, arm);
      const { result, appended } = await appendedBy(() => write.saves(seam, EDITOR, arm));

      expect(result).toMatchObject({ ok: false, error: { kind: "forbidden" } });
      expect(appended).toEqual([]);
    },
  );

  it("resolveSignIn appends one record when an Invite activates, and none for a refusal", async () => {
    const kim = { email: KIM, name: "Kim Reyes" };
    const activated = await appendedBy(() => seam.resolveSignIn(kim, new Date()));
    expect(activated.result).toMatchObject({ status: "staff" });
    expect(activated.appended).toEqual([
      expect.objectContaining({
        actor: kim,
        entity: "staff",
        entityId: kim.email,
        before: expect.objectContaining({ email: kim.email }),
        after: expect.objectContaining({ email: kim.email, role: "editor" }),
      }),
    ]);

    const refused = await appendedBy(() =>
      seam.resolveSignIn({ email: EXPIRED, name: null }, new Date()),
    );
    expect(refused.result).toEqual({ status: "denied", reason: "invite-expired" });
    expect(refused.appended).toEqual([]);

    const signedInAgain = await appendedBy(() => seam.resolveSignIn(kim, new Date()));
    expect(signedInAgain.appended).toEqual([]);
  });

  it("records no Staff Activity for the Reviewer PDF job's runs or the cron's restarts", async () => {
    await withReviewerPdf(seam, arm);
    const { appended } = await appendedBy(async () => {
      await seam.restartStaleReviewerPdfJobs();
      await seam.runReviewerPdfJob(reviewerPdf.id, createFakeRenderer());
    });
    expect(appended).toEqual([]);
  });

  it("records no Staff Activity for sign-in bookkeeping", async () => {
    const { appended } = await appendedBy(async () => {
      await seam.recordSignIn(EDITOR.email, new Date());
      await seam.recordDeniedSignIn({
        email: sampleEmail("not-staff"),
        reason: "not-staff",
        at: new Date(),
      });
    });
    expect(appended).toEqual([]);
  });
});

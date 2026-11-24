import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import {
  bundleFormValues,
  headerFormValues,
  seoFormValues,
  subjectFormValues,
} from "@/lib/admin/exam-page-form";
import { faqFormValues } from "@/lib/admin/faq-form";
import { productFormValues } from "@/lib/admin/product-form";
import { announcementFormValues, promoBannerFormValues } from "@/lib/admin/promo-form";
import { reviewFormValues } from "@/lib/admin/review-form";
import { getExamPageForAdmin, planCardImport, planQuizImport } from "@/services/admin";
import { claimDevice, getOrCreateMember, requestPrivacy } from "@/services/member.mock";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore } from "@/services/mock/sample-store";

import {
  SAVES,
  sampleActor,
  sampleEmail,
  UNUSED_EXAM,
  withUnusedExam,
} from "../../../test/admin-inputs";
import {
  importCsv,
  type ImportPaths,
  quizCsv,
  uploadSampleImport,
} from "../../../test/import-files";
import { editSampleCatalogue } from "../../../test/catalogue-seed";
import { pdfOfPages } from "../../../test/reviewer-pdfs";
import { uploadSampleReviewerPdf } from "../../../test/reviewer-pdf-uploads";

import * as content from "./(shell)/content/actions";
import * as reviewerPdfs from "./(shell)/content/reviewer-pdfs/actions";
import * as examPages from "./(shell)/exam-pages/actions";
import * as products from "./(shell)/products/actions";
import * as reviews from "./(shell)/reviews/actions";
import * as settings from "./(shell)/settings/actions";
import * as users from "./(shell)/users/actions";
import * as plans from "./(shell)/plans/actions";
import * as root from "./actions";
import * as signIn from "./sign-in/actions";

// ─────────────────────────────────────────────────────────────────────────────
// The permission matrix (spec, Testing Decisions → Permission and deny-all
// tests; stories 59 and 60). Every Admin Server Action is a public endpoint,
// so each one is called here as a browser would call it, by every caller it
// must refuse:
//   - signed out, which goes to sign-in,
//   - a User who isn't Staff, who goes to the 403 screen,
//   - an Editor, for the Owners-only actions, which answer "forbidden", and
//   - anyone at all with the Admin mode forced to closed, which answers 404.
// Each refusal leaves the sample store exactly as it was. The registry below
// lists every action with the Staff Role it needs, and an input that saves:
// each one is also called by the least Staff Role allowed, so a wrong role in
// the registry, or an input the refusals never reached, fails too. A new
// action in any "use server" module under src/app/admin that isn't in the
// registry fails the first test.
// ─────────────────────────────────────────────────────────────────────────────

const { jar, mode, afterTheResponse } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  mode: { current: "sample" as "sample" | "closed" },
  afterTheResponse: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// Work an action leaves for after its response (a Reviewer PDF's job) is
// only noted: it's no caller's doing, and the store must stay as it was.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: unknown) => {
    afterTheResponse.push(task);
  },
}));
// The mode as the server would compute it, which a test can force to closed.
vi.mock("@/lib/admin/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/mode")>()),
  get adminMode() {
    return mode.current;
  },
}));

const IDLE: AdminActionState<never> = { status: "idle" };
const OWNER = sampleEmail("owner");
const EDITOR = sampleEmail("editor");
const NOT_STAFF = sampleEmail("not-staff");
const READER = sampleActor("editor");
/** An empty sample Topic in CE's MSTC, which any Staff User may rename, move or delete. */
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
/** A Hidden deck, given two cards before each test, which any Staff User may edit. */
const ALGEBRA = sampleTopicId("CE", "MSTC", "Algebra");
const ALGEBRA_DECK = sampleContentId(ALGEBRA, "deck");
/** A Hidden quiz, given two questions before each test, which any Staff User may set and edit. */
const SPIRAL_CURVES = sampleTopicId("CE", "MSTC", "Spiral Curves");
const SPIRAL_CURVES_QUIZ = sampleContentId(SPIRAL_CURVES, "quiz");
const QUESTION = "7f8091a2-bc3d-4e4f-8a51-6c7d8e9fa0b1";
const SECOND_QUESTION = "8091a2b3-cd4e-4f50-9b62-7d8e9fa0b1c2";
/** A question's fields that save, apart from the question itself. */
const QUESTION_FIELDS = {
  choices: { A: "1", B: "2", C: "3", D: "4" },
  correct: "B",
  explanation: "$L_s = 0.036 V^3/R$",
  figure: null,
} as const;
const REVIEWER_PDF = "9a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";
const CARD = "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f";
const SECOND_CARD = "6e7f8091-ab2c-4d3e-9f40-5b6c7d8e9fa0";
/** A Member on their Active Device, whom an Owner may force-sign-out. */
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
/**
 * Bea's phone's token hash, as the Member App stores it. A literal: nothing in
 * the Admin uses the Active Device modules (src/app/app/device.test.tsx).
 */
const BEA_PHONE = "b".repeat(64);
/** Bea's Privacy Requests, made before each test: a data copy, and a deletion (ticket 19). */
const requests = { copy: "", deletion: "" };

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);

/** A card import's files, uploaded before each test, and the preview of them. */
let cardImport: ImportPaths & { exam: string; subject: string; mode: "add"; basedOn: string };
/** A quiz import's files, uploaded before each test, and the preview of them. */
let quizImport: typeof cardImport;
/** A Reviewer PDF uploaded to the sample data, and not yet recorded. */
let reviewerPdfUpload: string;
/** The stamp every record has before anyone saves it. */
const opened = () => ({ savedAt: getSampleStore().bootedAt });

function find<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return found;
}

async function cePage() {
  const page = await getExamPageForAdmin(READER, "ce");
  if (!page) throw new Error("CE isn't in the sample data");
  return page;
}

function signInForm(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

/**
 * Who may call an action: any Staff User, Owners only, or anyone, for signing
 * in and out, which need no Staff Role. Those two are refused only when the
 * Admin is closed.
 */
type Role = "staff" | "owner" | "anyone";
interface Entry {
  role: Role;
  /** Calls the action with an input it would save. */
  call: () => Promise<unknown>;
  /** An editor's save: the same call without the stamp its editor opened with. */
  withoutStamp?: () => Promise<unknown>;
}

const staff = (call: Entry["call"]): Entry => ({ role: "staff", call });
const owner = (call: Entry["call"]): Entry => ({ role: "owner", call });
const anyone = (call: Entry["call"]): Entry => ({ role: "anyone", call });

/** An editor's save, which must send the stamp its editor opened with. */
function editorSave<T>(
  role: "staff" | "owner",
  action: AdminAction<T>,
  input: () => unknown,
): Entry {
  return {
    role,
    call: async () => action(IDLE, { input: await input(), expected: opened() }),
    withoutStamp: async () => action(IDLE, { input: await input() }),
  };
}

/** This folder: every actions.ts under it holds Admin Server Actions. */
const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Every exported Admin Server Action, by its module, relative to this folder. */
const REGISTRY: Record<string, Record<string, Entry>> = {
  "./actions.ts": {
    signOut: anyone(() => root.signOut()),
    switchAccount: anyone(() => root.switchAccount()),
    resetSampleData: staff(() => root.resetSampleData()),
  },
  "./sign-in/actions.ts": {
    signInAs: anyone(() => signIn.signInAs({ error: null, email: "" }, signInForm(OWNER))),
    // Live mode only: sample mode answers 404 (see sign-in/live.test.tsx).
    continueWithGoogle: anyone(() => signIn.continueWithGoogle(new FormData())),
    // Live mode under pnpm dev only (ticket 19): elsewhere it answers 404.
    signInWithPassword: anyone(() =>
      signIn.signInWithPassword({ error: null, fieldErrors: {}, email: "" }, signInForm(OWNER)),
    ),
  },
  "./(shell)/settings/actions.ts": {
    saveContactEmail: editorSave("owner", settings.saveContactEmail, () => ({
      contactEmail: SAVES.contactEmail,
    })),
    saveLinks: editorSave("owner", settings.saveLinks, () => ({
      shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "", tiktok: "" },
      socialLinks: { tiktok: "", facebook: "", instagram: "" },
    })),
    saveTrustFigures: editorSave("owner", settings.saveTrustFigures, () => ({
      shopStats: { rating: "4.9", ratingCount: "900", followers: "3.8K" },
    })),
    addInvite: owner(() => settings.addInvite(IDLE, { input: SAVES.invite })),
    renewStaffInvite: owner(() =>
      settings.renewStaffInvite(IDLE, { input: { email: sampleEmail("expired") } }),
    ),
    cancelStaffInvite: owner(() =>
      settings.cancelStaffInvite(IDLE, { input: { email: sampleEmail("invited") } }),
    ),
    changeStaffMemberRole: owner(() =>
      settings.changeStaffMemberRole(IDLE, { input: { email: EDITOR, role: "owner" } }),
    ),
    removeStaffMember: owner(() => settings.removeStaffMember(IDLE, { input: { email: EDITOR } })),
  },
  "./(shell)/users/actions.ts": {
    addTester: owner(() => users.addTester(IDLE, { input: { email: SAVES.betaTester } })),
    removeTester: owner(() => users.removeTester(IDLE, { input: { email: "tester@example.com" } })),
    forceSignOutMember: owner(() =>
      users.forceSignOutMember(IDLE, { input: { userId: BEA.userId, reason: "Shared" } }),
    ),
    grantAccessPass: owner(() =>
      users.grantAccessPass(IDLE, {
        input: { userId: BEA.userId, examCode: "CE", days: 30, reason: "Beta" },
      }),
    ),
    extendAccessPass: owner(() =>
      users.extendAccessPass(IDLE, {
        input: { userId: BEA.userId, examCode: "CE", days: 7, reason: "Late" },
      }),
    ),
    endAccessPass: owner(() =>
      users.endAccessPass(IDLE, {
        input: { userId: BEA.userId, examCode: "CE", reason: "Mistake" },
      }),
    ),
    deleteAccount: owner(() =>
      users.deleteAccount(IDLE, {
        input: { requestId: requests.deletion, confirmation: BEA.email },
      }),
    ),
    markRequestDone: owner(() =>
      users.markRequestDone(IDLE, { input: { requestId: requests.copy } }),
    ),
  },
  // Plans & prices (Phase 4, ticket 01).
  "./(shell)/plans/actions.ts": {
    addPlan: owner(() =>
      plans.addPlan(IDLE, {
        input: {
          name: "CE All-Access",
          examCode: "CE",
          days: "365",
          price: "3,999",
          bestValue: false,
          onSale: false,
        },
      }),
    ),
    savePlan: editorSave("owner", plans.savePlan, () => ({
      id: samplePlanId("CE", 30),
      name: "CE All-Access",
      examCode: "CE",
      days: "30",
      price: "549",
      bestValue: false,
      onSale: true,
    })),
    switchPlanOnSale: owner(() =>
      plans.switchPlanOnSale(IDLE, { input: { id: samplePlanId("CE", 30), onSale: false } }),
    ),
    removePlan: owner(() => plans.removePlan(IDLE, { input: { id: samplePlanId("CE", 180) } })),
  },
  "./(shell)/content/actions.ts": {
    addTopic: staff(() =>
      content.addTopic(IDLE, { input: { exam: "ce", subject: "mstc", name: "Highways" } }),
    ),
    saveTopicName: editorSave("staff", content.saveTopicName, () => ({
      id: SURVEYING,
      name: "Leveling",
    })),
    moveTopicInSubject: staff(() =>
      content.moveTopicInSubject(IDLE, { input: { id: SURVEYING, direction: "up" } }),
    ),
    removeTopic: staff(() => content.removeTopic(IDLE, { input: { id: SURVEYING } })),
    createImportUpload: staff(() =>
      content.createImportUpload(IDLE, { input: { purpose: "import-csv", size: 2048 } }),
    ),
    checkCardImport: staff(() => {
      const { basedOn: _, ...input } = cardImport;
      return content.checkCardImport(IDLE, { input });
    }),
    importCards: staff(() => content.importCards(IDLE, { input: cardImport })),
    createCardImageUpload: staff(() =>
      content.createCardImageUpload(IDLE, { input: { contentType: "image/png", size: 2048 } }),
    ),
    addCard: staff(() =>
      content.addCard(IDLE, {
        input: { topic: ALGEBRA, front: "Slope", back: "$m = \\frac{\\Delta y}{\\Delta x}$" },
      }),
    ),
    saveCard: editorSave("staff", content.saveCard, () => ({
      id: CARD,
      front: "Grade, edited",
      back: "Rise over run",
      note: "",
      image: null,
    })),
    moveCardInDeck: staff(() =>
      content.moveCardInDeck(IDLE, { input: { id: SECOND_CARD, direction: "up" } }),
    ),
    removeCard: staff(() => content.removeCard(IDLE, { input: { id: CARD } })),
    saveDeckVisibility: staff(() =>
      content.saveDeckVisibility(IDLE, { input: { deck: ALGEBRA_DECK, visible: true } }),
    ),
    saveDeckFreePreview: staff(() =>
      content.saveDeckFreePreview(IDLE, { input: { deck: ALGEBRA_DECK, freePreview: true } }),
    ),
    checkQuizImport: staff(() => {
      const { basedOn: _, ...input } = quizImport;
      return content.checkQuizImport(IDLE, { input });
    }),
    importQuizzes: staff(() => content.importQuizzes(IDLE, { input: quizImport })),
    saveQuizSettings: editorSave("staff", content.saveQuizSettings, () => ({
      id: SPIRAL_CURVES_QUIZ,
      passingScore: "80",
      shuffle: false,
      showAnswers: false,
    })),
    saveQuizVisibility: staff(() =>
      content.saveQuizVisibility(IDLE, { input: { quiz: SPIRAL_CURVES_QUIZ, visible: true } }),
    ),
    saveQuizFreePreview: staff(() =>
      content.saveQuizFreePreview(IDLE, {
        input: { quiz: SPIRAL_CURVES_QUIZ, freePreview: true },
      }),
    ),
    addQuestion: staff(() =>
      content.addQuestion(IDLE, {
        input: { topic: SPIRAL_CURVES, question: "Spiral angle?", ...QUESTION_FIELDS },
      }),
    ),
    saveQuestion: editorSave("staff", content.saveQuestion, () => ({
      id: QUESTION,
      question: "Length of spiral, edited?",
      ...QUESTION_FIELDS,
    })),
    moveQuestionInQuiz: staff(() =>
      content.moveQuestionInQuiz(IDLE, { input: { id: SECOND_QUESTION, direction: "up" } }),
    ),
    removeQuestion: staff(() => content.removeQuestion(IDLE, { input: { id: QUESTION } })),
  },
  "./(shell)/content/reviewer-pdfs/actions.ts": {
    createReviewerPdfUpload: staff(() =>
      reviewerPdfs.createReviewerPdfUpload(IDLE, {
        input: { contentType: "application/pdf", size: 2048 },
      }),
    ),
    addReviewerPdf: staff(() =>
      reviewerPdfs.addReviewerPdf(IDLE, {
        input: { path: reviewerPdfUpload, fileName: "MSTC Reviewer.pdf" },
      }),
    ),
    removeReviewerPdf: staff(() =>
      reviewerPdfs.removeReviewerPdf(IDLE, { input: { id: REVIEWER_PDF } }),
    ),
    saveReviewerPdfPlacement: editorSave("staff", reviewerPdfs.saveReviewerPdfPlacement, () => ({
      id: REVIEWER_PDF,
      topic: SURVEYING,
    })),
    saveReviewerPdfPublished: staff(() =>
      reviewerPdfs.saveReviewerPdfPublished(IDLE, {
        input: { id: REVIEWER_PDF, published: true },
      }),
    ),
    saveReviewerPdfFreePreview: staff(() =>
      reviewerPdfs.saveReviewerPdfFreePreview(IDLE, {
        input: { id: REVIEWER_PDF, freePreview: true },
      }),
    ),
  },
  "./(shell)/products/actions.ts": {
    setProductFlag: staff(() =>
      products.setProductFlag(IDLE, { input: { id: "prd-001", showOnWebsite: false } }),
    ),
    addProduct: staff(() =>
      products.addProduct(IDLE, {
        input: SAVES.newProduct,
      }),
    ),
    saveProduct: editorSave("staff", products.saveProduct, () => {
      const product = find(getSampleStore().catalogue.products, "prd-001");
      return { id: product.id, ...productFormValues(product), priceFrom: SAVES.priceFrom };
    }),
    countProductDelete: staff(() =>
      products.countProductDelete(IDLE, { input: { id: "prd-005" } }),
    ),
    removeProduct: staff(() => products.removeProduct(IDLE, { input: { id: "prd-005" } })),
    createPhotoUpload: staff(() =>
      products.createPhotoUpload(IDLE, { input: { contentType: "image/png", size: 2048 } }),
    ),
  },
  "./(shell)/reviews/actions.ts": {
    setReviewPin: staff(() =>
      reviews.setReviewPin(IDLE, { input: { id: "rev-002", pinned: true } }),
    ),
    moveReviewOnHome: staff(() =>
      reviews.moveReviewOnHome(IDLE, { input: { id: "rev-006", direction: "up" } }),
    ),
    addReview: staff(() => reviews.addReview(IDLE, { input: SAVES.newReview })),
    saveReview: editorSave("staff", reviews.saveReview, () => {
      const review = find(getSampleStore().catalogue.reviews, "rev-002");
      return { id: review.id, ...reviewFormValues(review), stars: 4 };
    }),
    countReviewDelete: staff(() => reviews.countReviewDelete(IDLE, { input: { id: "rev-014" } })),
    removeReview: staff(() => reviews.removeReview(IDLE, { input: { id: "rev-014" } })),
    addFaq: staff(() =>
      reviews.addFaq(IDLE, {
        input: SAVES.newFaq,
      }),
    ),
    saveFaq: editorSave("staff", reviews.saveFaq, () => {
      const faq = find(getSampleStore().catalogue.faqs, "faq-002");
      return { id: faq.id, ...faqFormValues(faq), answer: "Yes." };
    }),
    moveFaqInGroup: staff(() =>
      reviews.moveFaqInGroup(IDLE, { input: { id: "faq-001", direction: "down" } }),
    ),
    removeFaq: staff(() => reviews.removeFaq(IDLE, { input: { id: "faq-001" } })),
  },
  "./(shell)/exam-pages/actions.ts": {
    addExam: owner(() =>
      examPages.addExam(IDLE, { input: { ...UNUSED_EXAM, code: "NUR", board: "NLE" } }),
    ),
    addExamSubject: owner(() =>
      examPages.addExamSubject(IDLE, { input: { exam: "ce", code: "THERMO", name: "Thermo" } }),
    ),
    removeExamSubject: owner(() =>
      examPages.removeExamSubject(IDLE, { input: { exam: "che", code: "THERMO" } }),
    ),
    removeExam: owner(() => examPages.removeExam(IDLE, { input: { code: "che" } })),
    setExamPageSection: staff(() =>
      examPages.setExamPageSection(IDLE, { input: { code: "me", section: "reviews", on: false } }),
    ),
    saveExamHeader: editorSave("staff", examPages.saveExamHeader, async () => ({
      code: "ce",
      ...headerFormValues((await cePage()).exam),
      blurb: SAVES.examBlurb,
    })),
    saveSubjectNames: editorSave("staff", examPages.saveSubjectNames, async () => {
      const { subjects } = subjectFormValues((await cePage()).exam);
      return {
        code: "ce",
        subjects: subjects.map((subject, i) => (i === 0 ? { ...subject, name: "Math" } : subject)),
      };
    }),
    saveBundleOffer: editorSave("staff", examPages.saveBundleOffer, async () => ({
      code: "ce",
      ...bundleFormValues((await cePage()).page),
      headline: SAVES.bundleHeadline,
    })),
    saveExamSeo: editorSave("staff", examPages.saveExamSeo, async () => ({
      code: "ce",
      ...seoFormValues((await cePage()).page),
      seoTitle: SAVES.seoTitle,
    })),
    saveOfficialExamDate: editorSave("staff", examPages.saveOfficialExamDate, () => ({
      code: "ce",
      officialExamDate: SAVES.officialExamDate,
    })),
    createShareImageUpload: staff(() =>
      examPages.createShareImageUpload(IDLE, {
        input: { code: "CE", contentType: "image/png", size: 2048 },
      }),
    ),
    saveSitePageSeo: editorSave("staff", examPages.saveSitePageSeo, () => ({
      site: "about",
      seoTitle: SAVES.seoTitle,
      seoDescription: "",
      shareImage: "",
    })),
    createSitePageShareImageUpload: staff(() =>
      examPages.createSitePageShareImageUpload(IDLE, {
        input: { site: "faq", contentType: "image/png", size: 2048 },
      }),
    ),
    saveAboutSection: editorSave("staff", examPages.saveAboutSection, () => ({
      section: "closing",
      heading: "Your turn.",
    })),
    createAboutPhotoUpload: staff(() =>
      examPages.createAboutPhotoUpload(IDLE, {
        input: { slot: "story-2", contentType: "image/png", size: 2048 },
      }),
    ),
    savePromoBanner: editorSave("staff", examPages.savePromoBanner, () => ({
      ...promoBannerFormValues(getSampleStore().catalogue.settings.promoBanner),
      buttonLabel: SAVES.bannerButtonLabel,
    })),
    setPromoBanner: staff(() => examPages.setPromoBanner(IDLE, { input: { visible: true } })),
    saveAnnouncement: editorSave("staff", examPages.saveAnnouncement, () => {
      const { messages } = announcementFormValues(getSampleStore().catalogue.settings.announcement);
      return { messages: messages.slice(0, 1) };
    }),
  },
};

const ENTRIES = Object.entries(REGISTRY).flatMap(([module, actions]) =>
  Object.entries(actions).map(([name, entry]) => ({ module, name, ...entry })),
);
const GUARDED = ENTRIES.filter((entry) => entry.role !== "anyone");
const OWNERS_ONLY = ENTRIES.filter((entry) => entry.role === "owner");
const EDITOR_SAVES = ENTRIES.flatMap(({ withoutStamp, ...entry }) =>
  withoutStamp ? [{ ...entry, withoutStamp }] : [],
);
const named = <T extends { module: string; name: string }>(entries: T[]) =>
  entries.map(
    (entry) => [`${entry.module.replace(/^\.\/(\(shell\)\/)?/, "")} ${entry.name}`, entry] as const,
  );

/** The whole sample store, byte for byte. */
const snapshot = () => JSON.stringify(getSampleStore());

beforeEach(async () => {
  jar.clear();
  mode.current = "sample";
  // The seed, with an Exam nothing uses yet, which the Exam and Subject deletes can delete.
  editSampleCatalogue(withUnusedExam);
  // Two cards nobody has saved through the editor, so a card's stamp is the one opened() gives.
  getSampleStore().cards = [CARD, SECOND_CARD].map((id, index) => ({
    id,
    deckId: ALGEBRA_DECK,
    position: index + 1,
    front: index === 0 ? "Grade" : "Slope",
    back: "Rise over run",
    note: null,
    image: null,
  }));
  vi.mocked(revalidateTag).mockClear();
  const paths = await uploadSampleImport({ csv: importCsv(["Highways,Grade,Rise over run,,"]) });
  const input = { exam: "ce", subject: "mstc", mode: "add" as const, ...paths };
  const planned = await planCardImport(READER, input);
  if (!planned.ok) throw new Error("The card import's files were refused");
  cardImport = { ...input, basedOn: planned.value.basedOn };
  // Two questions in Spiral Curves' quiz, nobody has saved through the editor,
  // so it can be made Visible and a question's stamp is the one opened() gives.
  getSampleStore().questions = [QUESTION, SECOND_QUESTION].map((id, index) => ({
    id,
    quizId: SPIRAL_CURVES_QUIZ,
    position: index + 1,
    question: index === 0 ? "Length of spiral?" : "Spiral angle?",
    ...QUESTION_FIELDS,
    removedAt: null,
  }));
  const quizPaths = await uploadSampleImport({
    csv: quizCsv(["Highways,Grade?,1,2,3,4,A,Rise over run.,"]),
  });
  const quizInput = { exam: "ce", subject: "mstc", mode: "add" as const, ...quizPaths };
  const plannedQuiz = await planQuizImport(READER, quizInput);
  if (!plannedQuiz.ok) throw new Error("The quiz import's files were refused");
  quizImport = { ...quizInput, basedOn: plannedQuiz.value.basedOn };
  // A Reviewer PDF uploaded and not yet recorded, and a Draft one, placed
  // under Algebra, to move, publish, flag Free Preview and delete.
  afterTheResponse.length = 0;
  reviewerPdfUpload = await uploadSampleReviewerPdf(pdfOfPages(2));
  const store = getSampleStore();
  store.reviewerPdfs = [
    ...store.reviewerPdfs,
    { id: REVIEWER_PDF, topicId: ALGEBRA, status: "draft", freePreview: false },
  ];
  store.reviewerPdfUploads = {
    [REVIEWER_PDF]: {
      fileName: "Old Reviewer.pdf",
      fileSize: 2048,
      uploadedAt: store.bootedAt,
      pageCount: 2,
      pagesDone: 2,
      heartbeatAt: store.bootedAt,
      restarts: 0,
      failure: null,
    },
  };
  // A Member signed in to the Member App on one device, with a CE pass for 30 more days.
  await getOrCreateMember(BEA);
  await claimDevice(BEA.userId, {
    tokenHash: BEA_PHONE,
    deviceLabel: "Chrome on Android",
  });
  store.accessPasses = [
    ...store.accessPasses,
    {
      userId: BEA.userId,
      examCode: "CE",
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
  // Bea asks, from Account, for a copy of her data and for her account to be deleted.
  requests.copy = (await requestPrivacy(BEA.userId, "data-copy")).request.id;
  requests.deletion = (await requestPrivacy(BEA.userId, "deletion")).request.id;
});

describe("the action registry", () => {
  it("lists every exported Admin Server Action, and nothing else", async () => {
    // Every "use server" module, whatever its name, holds Server Actions.
    const files = readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        /^["']use server["']/.test(readFileSync(path.join(ADMIN_DIR, file), "utf8").trimStart()),
      )
      .map((file) => `./${file.split(path.sep).join("/")}`);
    const exported = Object.fromEntries(
      await Promise.all(
        files.map(async (module) => {
          const exports: Record<string, unknown> = await import(path.join(ADMIN_DIR, module));
          const actions = Object.keys(exports).filter(
            (name) => typeof exports[name] === "function",
          );
          return [module, actions.sort()] as const;
        }),
      ),
    );
    const registered = Object.fromEntries(
      Object.entries(REGISTRY).map(([module, actions]) => [module, Object.keys(actions).sort()]),
    );

    expect(registered).toEqual(exported);
  });

  // The registry's role and input are right: the least Staff Role it names
  // gets the action through, so the refusals below are the Guard's doing.
  it.each(named(GUARDED))("%s goes through for the least Staff Role allowed", async (_, entry) => {
    signInAs(entry.role === "owner" ? OWNER : EDITOR);
    const before = getSampleStore().generation;

    const result = await entry.call();

    if (entry.name === "resetSampleData") {
      expect(getSampleStore().generation).not.toBe(before);
    } else {
      expect(result).toMatchObject({ status: "saved" });
    }
  });

  it("lets anyone sign in and out: the staff list decides what happens next", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.signInAs?.call()).rejects.toThrow(
      "NEXT_REDIRECT /admin",
    );
    expect(jar.get("ayc_admin_sample")).toBe(OWNER);

    await expect(REGISTRY["./actions.ts"]?.signOut?.call()).rejects.toThrow(
      "NEXT_REDIRECT /admin/sign-in",
    );
    expect(jar.has("ayc_admin_sample")).toBe(false);
  });

  it("lets anyone use another account: sample mode signs out to the Sign in as list", async () => {
    signInAs(NOT_STAFF);
    await expect(REGISTRY["./actions.ts"]?.switchAccount?.call()).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/sign-in$/,
    );
    expect(jar.has("ayc_admin_sample")).toBe(false);
  });

  it("has no Continue with Google in sample mode", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.continueWithGoogle?.call()).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has no password box in sample mode", async () => {
    await expect(REGISTRY["./sign-in/actions.ts"]?.signInWithPassword?.call()).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});

describe("the permission matrix", () => {
  it.each(named(GUARDED))(
    "%s sends a signed-out caller to sign-in, changing nothing",
    async (_, entry) => {
      const before = snapshot();

      await expect(entry.call()).rejects.toThrow(/^NEXT_REDIRECT \/admin\/sign-in/);
      expect(snapshot()).toBe(before);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  // The Guard records the refusal, as it does on any Admin request from a
  // User who isn't Staff (ticket 03), and changes nothing else.
  it.each(named(GUARDED))(
    "%s sends a User who isn't Staff to the 403 screen, changing nothing but the refusal log",
    async (_, entry) => {
      signInAs(NOT_STAFF);
      const before = getSampleStore();
      const unchanged = JSON.stringify({ ...before, deniedSignIns: [] });

      await expect(entry.call()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=not-staff");
      const after = getSampleStore();
      expect(JSON.stringify({ ...after, deniedSignIns: [] })).toBe(unchanged);
      expect(after.deniedSignIns).toEqual([
        { id: expect.any(String), email: NOT_STAFF, reason: "not-staff", at: expect.any(String) },
      ]);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it.each(named(OWNERS_ONLY))("%s refuses an Editor, changing nothing", async (_, entry) => {
    signInAs(EDITOR);
    const before = snapshot();

    expect(await entry.call()).toEqual({
      status: "refused",
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
    });
    expect(snapshot()).toBe(before);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  // A forged request can't skip the conflict check by leaving out the stamp.
  it.each(named(EDITOR_SAVES))(
    "%s refuses a save sent without its editor's stamp, changing nothing",
    async (_, entry) => {
      signInAs(entry.role === "owner" ? OWNER : EDITOR);
      const before = snapshot();

      expect(await entry.withoutStamp()).toEqual({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "RELOAD THE PAGE AND TRY AGAIN" },
      });
      expect(snapshot()).toBe(before);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it.each(named(ENTRIES))(
    "%s answers 404 to an Owner with the Admin closed, changing nothing",
    async (_, entry) => {
      signInAs(OWNER);
      mode.current = "closed";
      const before = snapshot();

      await expect(entry.call()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(snapshot()).toBe(before);
      expect(jar.get("ayc_admin_sample")).toBe(OWNER);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );
});

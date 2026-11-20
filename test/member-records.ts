import type { MemberAccess } from "@/lib/member-app/access";
import type { AdminCard, AdminQuestion } from "@/services/admin.types";
import type { MemberUser } from "@/services/member.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { createFakeRenderer, fakeStamper } from "@/services/page-images.fake";

import type { AdminArm } from "./admin-arms";
import { sampleActor } from "./admin-inputs";
import { pdfOfPages } from "./reviewer-pdfs";

// ─────────────────────────────────────────────────────────────────────────────
// A Member with a record in every table the Member App keeps (ticket 19), for
// the Privacy Request tests: what a data copy must hold, and what deleting
// the account must remove. Everything goes through the Admin and Member
// seams, as the Admin and the Member App write it.
// ─────────────────────────────────────────────────────────────────────────────

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const mstc = (name: string) => sampleTopicId("CE", "MSTC", name);
const SIMPLE_CURVES = mstc("Simple Curves");
const SPIRAL_CURVES = mstc("Spiral Curves");
const SURVEYING = mstc("Surveying");

/** What the Members study: a card in Spiral Curves, a question in Simple Curves' quiz, a 2-page Reviewer PDF in Surveying. */
export interface StudyContent {
  card: AdminCard;
  question: AdminQuestion;
  reviewerPdfId: string;
}

/** An Editor writes the content the Members study. */
export async function writeStudyContent(arm: AdminArm): Promise<StudyContent> {
  const card = await arm.seam.createCard(EDITOR, {
    topic: SPIRAL_CURVES,
    front: "Spiral length",
    back: "L = …",
    note: "",
  });
  if (!card.ok) throw new Error(`The card wasn't written: ${JSON.stringify(card)}`);
  const question = await arm.seam.createQuestion(EDITOR, {
    topic: SIMPLE_CURVES,
    question: "Degree of curve?",
    choices: { A: "Right", B: "Wrong", C: "Wrong too", D: "Not this" },
    correct: "A",
    explanation: "Because.",
    figure: null,
  });
  if (!question.ok) throw new Error(`The question wasn't written: ${JSON.stringify(question)}`);

  const path = await arm.uploadReviewerPdf(pdfOfPages(2));
  const recorded = await arm.seam.recordReviewerPdf(EDITOR, { path, fileName: "Surveying.pdf" });
  if (!recorded.ok) throw new Error("The Reviewer PDF wasn't recorded");
  const reviewerPdfId = recorded.value.id;
  while ((await arm.seam.runReviewerPdfJob(reviewerPdfId, createFakeRenderer())) === "more");
  const placed = await arm.seam.placeReviewerPdf(EDITOR, { id: reviewerPdfId, topic: SURVEYING });
  if (!placed.ok) throw new Error("The Reviewer PDF wasn't placed");
  await arm.seam.setReviewerPdfPublished(EDITOR, reviewerPdfId, true);

  return { card: card.value, question: question.value, reviewerPdfId };
}

/**
 * The Member's whole life in the Member App: they join and agree, pick ME
 * (which selects it), get CE granted (a pass, its grant, a notice, a Target Exam), claim a
 * device, then mark the card (a Study Day), stop in the deck, take the quiz,
 * and read and stop on a Reviewer PDF page. `token` makes their device's
 * token hash their own.
 */
export async function studyEverything(
  arm: AdminArm,
  user: MemberUser,
  { card, question, reviewerPdfId }: StudyContent,
  token: string,
): Promise<void> {
  const { member } = arm;
  const { userId } = user;
  await member.getOrCreateMember(user);
  await member.recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  const added = await member.addTargetExam(userId, { examCode: "ME", examDate: "2027-04-20" });
  if (!added.ok) throw new Error(`ME wasn't added: ${added.error}`);
  const granted = await arm.seam.grantAccess(OWNER, {
    userId,
    examCode: "CE",
    days: 30,
    reason: "Beta tester",
  });
  if (!granted.ok) throw new Error(`Not granted: ${JSON.stringify(granted)}`);
  await member.claimDevice(userId, {
    tokenHash: token.repeat(64),
    deviceLabel: "Chrome on Android",
  });

  const access: MemberAccess = {
    gate: "open",
    device: "active",
    activeStaff: false,
    passes: (await member.listAccessPasses(userId)).map(({ examCode, endsAt }) => ({
      examCode,
      endsAt,
    })),
    now: new Date(),
  };
  const marked = await member.markCard(userId, { cardId: card.id, verdict: "got" }, access);
  if (!marked.ok) throw new Error(`Not marked: ${JSON.stringify(marked)}`);
  const deckId = sampleContentId(SPIRAL_CURVES, "deck");
  await member.saveDeckPosition(userId, { deckId, cardId: card.id }, access);
  const attemptId = crypto.randomUUID();
  const quizId = sampleContentId(SIMPLE_CURVES, "quiz");
  const answers = [{ questionId: question.id, choice: "A" as const }];
  const scored = await member.submitQuiz(userId, { attemptId, quizId, answers }, access);
  if (!scored.ok) throw new Error(`Not scored: ${JSON.stringify(scored)}`);
  const read = await member.readReviewerPage(
    userId,
    { reviewerPdfId, page: 1 },
    access,
    fakeStamper,
  );
  if (read.status !== "page") throw new Error(`Not read: ${read.status}`);
  await member.saveReaderPosition(userId, { reviewerPdfId, page: 1, zoom: 100 }, access);
}

/** The kinds of record the Member App keeps for a User id. */
export const MEMBER_RECORD_KINDS = [
  "member",
  "consents",
  "targetExams",
  "activeDevice",
  "deviceSwitches",
  "accessPasses",
  "accessPassGrants",
  "notices",
  "cardMarks",
  "studyDays",
  "deckPositions",
  "quizAttempts",
  "reviewerPageViews",
  "readerPositions",
  "privacyRequests",
] as const;

export type MemberRecordCounts = Record<(typeof MEMBER_RECORD_KINDS)[number], number>;

/** Every count none: what's kept for a User id with no account. */
export const NO_MEMBER_RECORDS = Object.fromEntries(
  MEMBER_RECORD_KINDS.map((kind) => [kind, 0]),
) as MemberRecordCounts;

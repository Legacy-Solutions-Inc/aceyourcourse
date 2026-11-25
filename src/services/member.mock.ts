import { type DeviceStatus, deviceStatusFor } from "@/lib/member-app/device-token";
import { noticesToShow } from "@/lib/member-app/notices";
import { type PrivacyRequestType, privacyRequestDueOn } from "@/lib/member-app/privacy-requests";
import { type Order, orderReference } from "@/lib/payments/order-ledger";
import { readablePageCount } from "@/lib/reviewer-pdfs/status";
import { contentItemOf, type ContentExam, libraryOf } from "@/services/content.rules";
import type { AccessPass, ContentKind, ContentRecords } from "@/services/content.types";
import { deckStudyCalls, type DeckStudyStore } from "@/services/deck-study.core";
import { progressCalls, progressSubjectsOf, type ProgressStore } from "@/services/progress.core";
import { quizStudyCalls, type QuizStudyStore } from "@/services/quiz-study.core";
import { reviewerStudyCalls, type ReviewerStudyStore } from "@/services/reviewer-study.core";
import {
  agreedVersionsSchema,
  contentRefSchema,
  deviceClaimSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
  noticeIdSchema,
  privacyRequestTypeSchema,
} from "@/services/member.schema";
import {
  applyChange,
  examCodesOnSale,
  examsForMembers,
  pickableExams,
  plansExams,
  targetExamOperations,
  targetExams,
  type MemberExams,
  type WithMemberExams,
} from "@/services/member.rules";
import type {
  ActiveDevice,
  AgreedVersions,
  ConsentRecord,
  ContentItem,
  DeviceClaim,
  DeviceSwitch,
  LibrarySubject,
  Member,
  MemberNotice,
  MemberUser,
  PickableExam,
  PlansExam,
  PrivacyRequest,
  PrivacyRequestOutcome,
  TargetExam,
} from "@/services/member.types";
import { writeSamplePass } from "@/services/mock/pass-writes";
import { getSampleStore, type SamplePrivacyRequest } from "@/services/mock/sample-store";
import { orderCalls, type OrderStore } from "@/services/orders.core";
import { sampleContentFiles, sampleReviewerPdfFiles } from "@/services/uploads.mock";

// The Member seam's sample arm: over the in-memory sample store
// (src/services/mock/sample-store.ts), which holds the Beta Tester list and
// the Topics the Admin's sample arm edits, the Members, their consent
// records, Target Exams, Active Devices and Access Passes, their study
// records, notices and Privacy Requests. The Target Exam rules (member.rules.ts), the content rules
// (content.rules.ts) and the study calls (deck-study.core.ts,
// quiz-study.core.ts and reviewer-study.core.ts) are shared with the
// database arm.

export async function isBetaTester(email: string): Promise<boolean> {
  const wanted = memberEmailSchema.safeParse(email);
  if (!wanted.success) return false;
  return getSampleStore().betaTesters.some((tester) => tester.email === wanted.data);
}

export async function getOrCreateMember(user: MemberUser): Promise<Member> {
  const { userId, email, name } = memberUserSchema.parse(user);
  const store = getSampleStore();
  const existing = store.members.find((member) => member.userId === userId);
  if (existing) return structuredClone(existing);

  const member: Member = { userId, email, name, joinedAt: new Date().toISOString() };
  store.members = [...store.members, member];
  return structuredClone(member);
}

export async function latestConsent(userId: string): Promise<ConsentRecord | null> {
  const wanted = memberUserIdSchema.parse(userId);
  const latest = getSampleStore().memberConsents.findLast((record) => record.userId === wanted);
  return latest ? structuredClone(latest) : null;
}

export async function recordConsent(
  userId: string,
  versions: AgreedVersions,
): Promise<ConsentRecord> {
  const wanted = memberUserIdSchema.parse(userId);
  const { termsVersion, privacyVersion } = agreedVersionsSchema.parse(versions);
  const store = getSampleStore();
  // Like the database's foreign key: only a Member, someone the gate let in, agrees.
  if (!store.members.some((member) => member.userId === wanted)) {
    throw new Error("Only a Member can agree to the Terms and Privacy Policy.");
  }
  const record: ConsentRecord = {
    userId: wanted,
    termsVersion,
    privacyVersion,
    agreedAt: new Date().toISOString(),
  };
  store.memberConsents = [...store.memberConsents, record];
  return structuredClone(record);
}

/**
 * One Member's Target Exams as the store holds them now, with the catalogue's
 * Exams. Like the database's cascade, a record whose Exam an Owner deleted is
 * gone for good: it doesn't come back if an Exam with that code is added.
 */
function memberExams(userId: string): MemberExams {
  const store = getSampleStore();
  const exams = examsForMembers(store.catalogue);
  const exists = (code: string) => exams.some((exam) => exam.code === code);
  const records = (store.memberTargetExams[userId] ?? []).filter((r) => exists(r.examCode));
  if (store.memberTargetExams[userId]) store.memberTargetExams[userId] = records;
  const selected = store.selectedExams[userId] ?? null;
  if (selected !== null && !exists(selected)) store.selectedExams[userId] = null;
  return structuredClone({
    records,
    selectedExamCode: store.selectedExams[userId] ?? null,
    exams,
  });
}

export async function listPickableExams(): Promise<PickableExam[]> {
  return pickableExams(examsForMembers(structuredClone(getSampleStore().catalogue)));
}

export async function listTargetExams(userId: string): Promise<TargetExam[]> {
  return targetExams(memberExams(memberUserIdSchema.parse(userId)));
}

const withMemberExams: WithMemberExams = async (userId, work) => {
  const store = getSampleStore();
  // Like the database's foreign key: only a Member, someone the gate let in, has Target Exams.
  if (!store.members.some((member) => member.userId === userId)) {
    throw new Error("Only a Member has Target Exams.");
  }
  const state = memberExams(userId);
  const { change, result } = work(state);
  if (change) {
    const after = applyChange(state, change);
    store.memberTargetExams[userId] = after.records;
    store.selectedExams[userId] = after.selectedExamCode;
  }
  return result;
};

export const { addTargetExam, setExamDate, selectTargetExam, removeTargetExam } =
  targetExamOperations(withMemberExams);

// ── The Active Device ───────────────────────────────────────────────────────

export async function claimDevice(userId: string, claim: DeviceClaim): Promise<ActiveDevice> {
  const wanted = memberUserIdSchema.parse(userId);
  const { tokenHash, deviceLabel } = deviceClaimSchema.parse(claim);
  const store = getSampleStore();
  // Like the database's foreign keys: only a Member, someone the gate let in, claims a device.
  if (!store.members.some((member) => member.userId === wanted)) {
    throw new Error("Only a Member has an Active Device.");
  }
  const claimedAt = new Date().toISOString();
  store.memberActiveDevices[wanted] = { tokenHash, deviceLabel, claimedAt };
  store.memberDeviceSwitches = [
    ...store.memberDeviceSwitches,
    { userId: wanted, deviceLabel, switchedAt: claimedAt },
  ];
  return { deviceLabel, claimedAt };
}

export async function deviceStatus(
  userId: string,
  tokenHash: string | null,
): Promise<DeviceStatus> {
  const wanted = memberUserIdSchema.parse(userId);
  const stored = getSampleStore().memberActiveDevices[wanted]?.tokenHash ?? null;
  return deviceStatusFor(stored, tokenHash);
}

export async function getActiveDevice(userId: string): Promise<ActiveDevice | null> {
  const wanted = memberUserIdSchema.parse(userId);
  const record = getSampleStore().memberActiveDevices[wanted];
  return record ? { deviceLabel: record.deviceLabel, claimedAt: record.claimedAt } : null;
}

/** One Member's claims, oldest first. */
function switchesOf(userId: string): DeviceSwitch[] {
  const wanted = memberUserIdSchema.parse(userId);
  return getSampleStore().memberDeviceSwitches.filter((entry) => entry.userId === wanted);
}

export async function listDeviceSwitches(userId: string): Promise<DeviceSwitch[]> {
  return structuredClone(switchesOf(userId));
}

export async function deviceSwitchCount(userId: string): Promise<number> {
  return switchesOf(userId).length;
}

// ── The Library and content ─────────────────────────────────────────────────

/** The catalogue's Exams with their Subjects, and every Topic with its content, as the store holds them. */
function contentOfStore(): { exams: ContentExam[]; content: ContentRecords } {
  const { catalogue, topics, decks, quizzes, reviewerPdfs } = getSampleStore();
  return structuredClone({
    exams: catalogue.exams.map(({ code, subjects }) => ({ code, subjects })),
    content: { topics, decks, quizzes, reviewerPdfs },
  });
}

export async function getLibrary(examCode: string): Promise<LibrarySubject[]> {
  const { exams, content } = contentOfStore();
  const exam = exams.find((candidate) => candidate.code === examCode.trim().toUpperCase());
  return exam ? libraryOf(exam, content) : [];
}

export async function getContentItem(kind: ContentKind, id: string): Promise<ContentItem | null> {
  const ref = contentRefSchema.safeParse({ kind, id });
  if (!ref.success) return null;
  const { exams, content } = contentOfStore();
  return contentItemOf(ref.data.kind, ref.data.id, exams, content);
}

export async function listAccessPasses(userId: string): Promise<AccessPass[]> {
  const wanted = memberUserIdSchema.parse(userId);
  const store = getSampleStore();
  // Like the database's cascade: a pass whose Exam an Owner deleted is gone
  // for good, so it doesn't come back if an Exam with that code is added.
  const exists = (code: string) => store.catalogue.exams.some((exam) => exam.code === code);
  if (store.accessPasses.some((pass) => !exists(pass.examCode))) {
    store.accessPasses = store.accessPasses.filter((pass) => exists(pass.examCode));
  }
  return structuredClone(store.accessPasses.filter((pass) => pass.userId === wanted));
}

// ── Studying a deck ─────────────────────────────────────────────────────────

/** Like the database's foreign keys: only a Member, someone the gate let in, has study records. */
function requireMemberRecord(userId: string): void {
  if (!getSampleStore().members.some((member) => member.userId === userId)) {
    throw new Error("Only a Member has study records.");
  }
}

/** Records a Study Day for a Member, once per day. */
function recordStudyDay(userId: string, day: string): void {
  const store = getSampleStore();
  if (!store.studyDays.some((kept) => kept.userId === userId && kept.day === day)) {
    store.studyDays = [...store.studyDays, { userId, day }];
  }
}

/** The sample bucket's signed URLs, for card images and quiz figures alike. */
const signSampleImages = (paths: readonly string[], seconds: number) =>
  sampleContentFiles.signedUrls(paths, seconds);

const cardsOf = (deckId: string) => getSampleStore().cards.filter((card) => card.deckId === deckId);

const sampleStudyStore: DeckStudyStore = {
  async readDeckItem(deckId) {
    const { exams, content } = contentOfStore();
    return contentItemOf("deck", deckId, exams, content);
  },
  async readCards(deckId) {
    return structuredClone(cardsOf(deckId).sort((a, b) => a.position - b.position));
  },
  async deckOfCard(cardId) {
    return getSampleStore().cards.find((card) => card.id === cardId)?.deckId ?? null;
  },
  async readMarks(userId, deckId) {
    const inDeck = new Set(cardsOf(deckId).map((card) => card.id));
    return structuredClone(
      getSampleStore().cardMarks.filter(
        (mark) => mark.userId === userId && inDeck.has(mark.cardId),
      ),
    );
  },
  async readPosition(userId, deckId) {
    const found = getSampleStore().deckPositions.find(
      (position) => position.userId === userId && position.deckId === deckId,
    );
    return found?.cardId ?? null;
  },
  async saveMark(mark, day) {
    requireMemberRecord(mark.userId);
    if (!getSampleStore().cards.some((card) => card.id === mark.cardId)) return false;
    const store = getSampleStore();
    const others = store.cardMarks.filter(
      (kept) => !(kept.userId === mark.userId && kept.cardId === mark.cardId),
    );
    store.cardMarks = [...others, structuredClone(mark)];
    recordStudyDay(mark.userId, day);
    return true;
  },
  async savePosition(userId, deckId, position) {
    requireMemberRecord(userId);
    if (position && !cardsOf(deckId).some((card) => card.id === position.cardId)) return false;
    const store = getSampleStore();
    const others = store.deckPositions.filter((p) => !(p.userId === userId && p.deckId === deckId));
    store.deckPositions = position ? [...others, structuredClone(position)] : others;
    return true;
  },
  async readStudyDays(userId) {
    return getSampleStore()
      .studyDays.filter((kept) => kept.userId === userId)
      .map((kept) => kept.day)
      .sort();
  },
  signImages: signSampleImages,
};

export const { openDeck, markCard, saveDeckPosition, listStudyDays } =
  deckStudyCalls(sampleStudyStore);

// ── Taking a quiz ───────────────────────────────────────────────────────────

const sampleQuizStore: QuizStudyStore = {
  async readQuizItem(quizId) {
    const { exams, content } = contentOfStore();
    return contentItemOf("quiz", quizId, exams, content);
  },
  async readQuiz(quizId) {
    const store = getSampleStore();
    const quiz = store.quizzes.find((candidate) => candidate.id === quizId);
    if (!quiz) return null;
    return structuredClone({
      quiz,
      questions: store.questions.filter((question) => question.quizId === quizId),
    });
  },
  async readAttempts(userId, quizId) {
    return getSampleStore()
      .quizAttempts.filter((attempt) => attempt.userId === userId && attempt.quizId === quizId)
      .map(({ answers: _answers, ...score }) => structuredClone(score))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id));
  },
  async readAttempt(userId, attemptId) {
    const found = getSampleStore().quizAttempts.find(
      (attempt) => attempt.id === attemptId && attempt.userId === userId,
    );
    return found ? structuredClone(found) : null;
  },
  async saveAttempt(attempt, day) {
    requireMemberRecord(attempt.userId);
    const store = getSampleStore();
    if (store.quizAttempts.some((saved) => saved.id === attempt.id)) return "exists";
    store.quizAttempts = [...store.quizAttempts, structuredClone(attempt)];
    recordStudyDay(attempt.userId, day);
    return "saved";
  },
  signImages: signSampleImages,
};

export const { openQuiz, submitQuiz, reviewQuizAttempt } = quizStudyCalls(sampleQuizStore);

// ── Reading a Reviewer PDF ──────────────────────────────────────────────────

const hasReviewerPdf = (id: string) => getSampleStore().reviewerPdfs.some((pdf) => pdf.id === id);

const sampleReviewerStore: ReviewerStudyStore = {
  async readReviewerPdfItem(reviewerPdfId) {
    const { exams, content } = contentOfStore();
    return contentItemOf("reviewer-pdf", reviewerPdfId, exams, content);
  },
  async readPageCount(reviewerPdfId) {
    return readablePageCount(getSampleStore().reviewerPdfUploads[reviewerPdfId] ?? null);
  },
  readPage: (reviewerPdfId, page) => sampleReviewerPdfFiles.readPage(reviewerPdfId, page),
  async readMemberEmail(userId) {
    return getSampleStore().members.find((member) => member.userId === userId)?.email ?? null;
  },
  async countPagesViewed(userId, reviewerPdfId) {
    return getSampleStore().reviewerPageViews.filter(
      (view) => view.userId === userId && view.reviewerPdfId === reviewerPdfId,
    ).length;
  },
  async readPosition(userId, reviewerPdfId) {
    const found = getSampleStore().readerPositions.find(
      (place) => place.userId === userId && place.reviewerPdfId === reviewerPdfId,
    );
    return found ? { page: found.page, zoom: found.zoom } : null;
  },
  async saveView(view, day) {
    requireMemberRecord(view.userId);
    if (!hasReviewerPdf(view.reviewerPdfId)) return false;
    const store = getSampleStore();
    const seen = store.reviewerPageViews.some(
      (kept) =>
        kept.userId === view.userId &&
        kept.reviewerPdfId === view.reviewerPdfId &&
        kept.page === view.page,
    );
    if (!seen) store.reviewerPageViews = [...store.reviewerPageViews, structuredClone(view)];
    recordStudyDay(view.userId, day);
    return true;
  },
  async savePosition(position) {
    requireMemberRecord(position.userId);
    if (!hasReviewerPdf(position.reviewerPdfId)) return false;
    const store = getSampleStore();
    const others = store.readerPositions.filter(
      (kept) => !(kept.userId === position.userId && kept.reviewerPdfId === position.reviewerPdfId),
    );
    store.readerPositions = [...others, structuredClone(position)];
    return true;
  },
};

export const { openReviewerPdf, readReviewerPage, saveReaderPosition } =
  reviewerStudyCalls(sampleReviewerStore);

// ── Progress ────────────────────────────────────────────────────────────────

const sampleProgressStore: ProgressStore = {
  async readExamContent(examCode) {
    const { exams, content } = contentOfStore();
    const exam = exams.find((candidate) => candidate.code === examCode);
    if (!exam) return [];
    const store = getSampleStore();
    const questionCounts = new Map<string, number>();
    for (const question of store.questions) {
      if (question.position === null) continue;
      questionCounts.set(question.quizId, (questionCounts.get(question.quizId) ?? 0) + 1);
    }
    return progressSubjectsOf(exam, content, {
      cards: store.cards.map(({ id, deckId, position }) => ({ id, deckId, position })),
      questionCounts,
      pageCounts: new Map(
        content.reviewerPdfs.map((pdf) => [
          pdf.id,
          readablePageCount(store.reviewerPdfUploads[pdf.id] ?? null),
        ]),
      ),
    });
  },
  async readRecords(userId) {
    const store = getSampleStore();
    const own = <T extends { userId: string }>(records: readonly T[]) =>
      structuredClone(records.filter((record) => record.userId === userId));
    return {
      cardMarks: own(store.cardMarks),
      quizScores: own(store.quizAttempts).map(({ quizId, score, submittedAt }) => ({
        quizId,
        score,
        submittedAt,
      })),
      pageViews: own(store.reviewerPageViews),
      deckPositions: own(store.deckPositions),
      readerPositions: own(store.readerPositions),
      studyDays: own(store.studyDays).map(({ day }) => day),
    };
  },
};

export const { getProgress, getTopicPercents } = progressCalls(sampleProgressStore);

// ── In-app notices ──────────────────────────────────────────────────────────

export async function listNotices(userId: string): Promise<MemberNotice[]> {
  const wanted = memberUserIdSchema.parse(userId);
  return structuredClone(
    noticesToShow(getSampleStore().memberNotices.filter((notice) => notice.userId === wanted)),
  );
}

export async function dismissNotice(userId: string, noticeId: string): Promise<boolean> {
  const wanted = memberUserIdSchema.parse(userId);
  const id = noticeIdSchema.safeParse(noticeId);
  if (!id.success) return false;
  const store = getSampleStore();
  const notice = store.memberNotices.find((n) => n.id === id.data && n.userId === wanted);
  if (!notice) return false;
  if (notice.dismissedAt === null) {
    const dismissed = { ...notice, dismissedAt: new Date().toISOString() };
    store.memberNotices = store.memberNotices.map((n) => (n === notice ? dismissed : n));
  }
  return true;
}

// ── Privacy Requests ────────────────────────────────────────────────────────

/** One of a Member's own requests, as the Member App reads it. */
const ownRequest = (
  { id, type, status, requestedAt, dueOn }: SamplePrivacyRequest,
  userId: string,
): PrivacyRequest => ({ id, userId, type, status, requestedAt, dueOn });

export async function listOpenPrivacyRequests(userId: string): Promise<PrivacyRequest[]> {
  const wanted = memberUserIdSchema.parse(userId);
  return getSampleStore()
    .privacyRequests.filter((request) => request.userId === wanted && request.status === "open")
    .map((request) => ownRequest(request, wanted));
}

export async function requestPrivacy(
  userId: string,
  type: PrivacyRequestType,
): Promise<PrivacyRequestOutcome> {
  const wanted = memberUserIdSchema.parse(userId);
  const asked = privacyRequestTypeSchema.parse(type);
  const store = getSampleStore();
  // Like the database's foreign key: only a Member, someone the gate let in, asks.
  if (!store.members.some((member) => member.userId === wanted)) {
    throw new Error("Only a Member can make a Privacy Request.");
  }
  const open = store.privacyRequests.find(
    (request) => request.userId === wanted && request.type === asked && request.status === "open",
  );
  if (open) return { request: ownRequest(open, wanted), created: false };

  const now = new Date();
  const request: SamplePrivacyRequest = {
    id: crypto.randomUUID(),
    userId: wanted,
    type: asked,
    status: "open",
    requestedAt: now.toISOString(),
    dueOn: privacyRequestDueOn(asked, now),
    doneAt: null,
    doneBy: null,
    deletedUserId: null,
  };
  store.privacyRequests = [...store.privacyRequests, request];
  return { request: ownRequest(request, wanted), created: true };
}

// ── Plans (Phase 4, ticket 02) ──────────────────────────────────────────────

export async function listMemberPlans(userId: string): Promise<PlansExam[]> {
  const wanted = memberUserIdSchema.parse(userId);
  const { catalogue, plans } = getSampleStore();
  return plansExams({
    exams: examsForMembers(structuredClone(catalogue)),
    plans: structuredClone(plans),
    targetExams: await listTargetExams(wanted),
    passes: await listAccessPasses(wanted),
  });
}

export async function listExamsOnSale(): Promise<string[]> {
  const { catalogue, plans } = getSampleStore();
  return examCodesOnSale(examsForMembers(structuredClone(catalogue)), structuredClone(plans));
}

// ── Buying (Phase 4, ticket 03) ─────────────────────────────────────────────

/** The sample data's grants that hold an Order's paid days, by Order id. */
const paidUntil = (orderId: string) =>
  getSampleStore().accessPassGrants.find((grant) => grant.orderId === orderId)?.endsAt ?? null;

// A Node process runs one call at a time here, so an outcome reads and writes
// in one step, and two Pays take consecutive numbers.
const sampleOrderStore: OrderStore = {
  async readOnSale() {
    const { catalogue, plans } = getSampleStore();
    return {
      exams: examsForMembers(structuredClone(catalogue)),
      plans: structuredClone(plans.filter((plan) => plan.onSale)),
    };
  },
  async readMember(userId) {
    const member = getSampleStore().members.find((candidate) => candidate.userId === userId);
    return member ? structuredClone(member) : null;
  },
  async addOrder(draft) {
    const store = getSampleStore();
    const order: Order = { ...draft, reference: orderReference(store.nextOrderNumber) };
    store.nextOrderNumber += 1;
    store.orders = [...store.orders, order];
    return structuredClone(order);
  },
  async setCheckoutId(orderId, checkoutId) {
    const store = getSampleStore();
    store.orders = store.orders.map((order) =>
      order.id === orderId ? { ...order, checkoutId } : order,
    );
  },
  async findOwnOrder(userId, reference) {
    const order = getSampleStore().orders.find(
      (candidate) => candidate.reference === reference && candidate.userId === userId,
    );
    return order ? { order: structuredClone(order), accessUntil: paidUntil(order.id) } : null;
  },
  async withOrder(orderId, work) {
    const store = getSampleStore();
    const order = store.orders.find((candidate) => candidate.id === orderId);
    if (!order) return null;
    const { userId, examCode } = order;
    const pass =
      store.accessPasses.find((held) => held.userId === userId && held.examCode === examCode) ??
      null;
    const { write, result } = work(
      structuredClone({
        order,
        member: store.members.find((candidate) => candidate.userId === userId) ?? null,
        pass,
        targetExams: userId ? (store.memberTargetExams[userId] ?? []) : [],
      }),
    );
    if (!write) return result;

    // The pass first, its Staff Activity before all: should that fail, the Order stays as it was.
    if (write.paid && userId) writeSamplePass(userId, examCode, write.paid);
    store.orders = store.orders.map((held) => (held.id === orderId ? write.order : held));
    return result;
  },
};

export const { payForPlan, getMemberOrder, checkOrderStatus } = orderCalls(sampleOrderStore);

import "server-only";

import { and, asc, type Column, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import type { Transaction } from "@/lib/db/connect";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { deviceStatusFor } from "@/lib/member-app/device-token";
import { noticesToShow } from "@/lib/member-app/notices";
import { privacyRequestDueOn } from "@/lib/member-app/privacy-requests";
import { toPlanDays } from "@/lib/plans/plan-rules";
import { isReaderZoom } from "@/lib/reviewer-pdfs/reader";
import { readablePageCount } from "@/lib/reviewer-pdfs/status";
import { isStorageConfigured } from "@/lib/supabase/admin";
import type { Plan } from "@/services/admin.types";
import { type ContentExam, contentItemOf, libraryOf } from "@/services/content.rules";
import {
  accessPassFromRow,
  cardFromRow,
  contentFromRows,
  questionFromRow,
  quizAttemptAnswerFromRow,
  quizAttemptAnswersToRows,
  quizAttemptFromRow,
  quizAttemptToRow,
  quizFromRow,
} from "@/services/content.rows";
import { deckStudyCalls, type DeckStudyStore } from "@/services/deck-study.core";
import { progressCalls, progressSubjectsOf, type ProgressStore } from "@/services/progress.core";
import { quizStudyCalls, type QuizStudyStore } from "@/services/quiz-study.core";
import { reviewerStudyCalls, type ReviewerStudyStore } from "@/services/reviewer-study.core";
import type { MemberService } from "@/services/member";
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
  examCodesOnSale,
  examsForMembers,
  pickableExams,
  plansExams,
  targetExamOperations,
  targetExams,
  type MemberExam,
  type TargetExamRecord,
  type WithMemberExams,
} from "@/services/member.rules";
import type { ContentKind } from "@/services/content.types";
import type {
  ConsentRecord,
  DeviceSwitch,
  Member,
  MemberNotice,
  PrivacyRequest,
} from "@/services/member.types";
import { sampleContentFiles, sampleReviewerPdfFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// The Member seam on Postgres, selected by src/services/member.ts when
// DATABASE_URL is set. Drizzle bypasses RLS, so each call is scoped here, in
// the app layer, to the User the Member App gate passes it (coding standards
// §3): a Member's records are only ever read or made by their own User id.
// The Target Exam rules (member.rules.ts), the content rules
// (content.rules.ts), the study calls (deck-study.core.ts,
// quiz-study.core.ts and reviewer-study.core.ts) and the Active Device's comparison (device-token.ts)
// are shared with the sample arm.

type MemberRow = typeof schema.members.$inferSelect;
type ConsentRow = typeof schema.memberConsents.$inferSelect;

export const memberFromRow = (row: MemberRow): Member => ({
  userId: row.userId,
  email: row.email,
  name: row.name,
  joinedAt: row.joinedAt.toISOString(),
});

export const consentFromRow = (row: ConsentRow): ConsentRecord => ({
  userId: row.userId,
  termsVersion: row.termsVersion,
  privacyVersion: row.privacyVersion,
  agreedAt: row.agreedAt.toISOString(),
});

const isBetaTester: MemberService["isBetaTester"] = async (email) => {
  const wanted = memberEmailSchema.safeParse(email);
  if (!wanted.success) return false;
  const { betaTesters } = schema;
  try {
    const [row] = await getDb()
      .select({ email: betaTesters.email })
      .from(betaTesters)
      .where(eq(betaTesters.email, wanted.data))
      .limit(1);
    return row !== undefined;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const getOrCreateMember: MemberService["getOrCreateMember"] = async (user) => {
  const { userId, email, name } = memberUserSchema.parse(user);
  const { members } = schema;
  try {
    // The first request makes the row; one arriving alongside it finds the
    // primary key taken, adds nothing, and reads the row that won.
    const [made] = await getDb()
      .insert(members)
      .values({ userId, email, name, joinedAt: new Date() })
      .onConflictDoNothing({ target: members.userId })
      .returning();
    if (made) return memberFromRow(made);
    const [existing] = await getDb().select().from(members).where(eq(members.userId, userId));
    if (!existing) throw new Error("The Member record was neither made nor found.");
    return memberFromRow(existing);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const latestConsent: MemberService["latestConsent"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberConsents } = schema;
  try {
    const [row] = await getDb()
      .select()
      .from(memberConsents)
      .where(eq(memberConsents.userId, wanted))
      .orderBy(desc(memberConsents.seq))
      .limit(1);
    return row ? consentFromRow(row) : null;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const recordConsent: MemberService["recordConsent"] = async (userId, versions) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { termsVersion, privacyVersion } = agreedVersionsSchema.parse(versions);
  try {
    // The foreign key to members refuses a User the gate never let in.
    const [made] = await getDb()
      .insert(schema.memberConsents)
      .values({ userId: wanted, termsVersion, privacyVersion, agreedAt: new Date() })
      .returning();
    if (!made) throw new Error("The consent record wasn't made.");
    return consentFromRow(made);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

type TargetExamRow = typeof schema.memberTargetExams.$inferSelect;

export const targetExamFromRow = (row: TargetExamRow): TargetExamRecord => ({
  examCode: row.examCode,
  memberExamDate: row.memberExamDate,
  addedAt: row.addedAt.toISOString(),
  removedAt: row.removedAt?.toISOString() ?? null,
});

type Reader = Pick<ReturnType<typeof getDb>, "select">;

/**
 * Every Exam as the Member App needs it, read fresh: only the columns the
 * rules use, so a Staff change to an Official Exam Date shows on the next
 * request.
 */
async function readExams(db: Reader): Promise<MemberExam[]> {
  const { exams, products, examPages } = schema;
  return examsForMembers({
    exams: await db
      .select({ code: exams.code, board: exams.board, name: exams.name })
      .from(exams)
      .orderBy(asc(exams.position)),
    products: await db
      .select({ examCode: products.examCode, showOnWebsite: products.showOnWebsite })
      .from(products),
    examPages: await db
      .select({ examCode: examPages.examCode, officialExamDate: examPages.officialExamDate })
      .from(examPages),
  });
}

/** One Member's Target Exam records, removed ones too, in the order first added. */
async function readRecords(db: Reader, userId: string): Promise<TargetExamRecord[]> {
  const { memberTargetExams } = schema;
  const rows = await db
    .select()
    .from(memberTargetExams)
    .where(eq(memberTargetExams.userId, userId))
    .orderBy(asc(memberTargetExams.seq));
  return rows.map(targetExamFromRow);
}

const listPickableExams: MemberService["listPickableExams"] = async () => {
  try {
    return pickableExams(await readExams(getDb()));
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listTargetExams: MemberService["listTargetExams"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { members } = schema;
  try {
    const db = getDb();
    const [member] = await db
      .select({ selectedExamCode: members.selectedExamCode })
      .from(members)
      .where(eq(members.userId, wanted));
    return targetExams({
      records: await readRecords(db, wanted),
      selectedExamCode: member?.selectedExamCode ?? null,
      exams: await readExams(db),
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
};

/**
 * Writes one of a Member's Target Exam records, added or replacing theirs for
 * its Exam: the Target Exam rules' change (member.rules.ts), or a grant's
 * (admin.access-passes.db.ts). The first-added time stays the first one.
 */
export async function writeTargetExam(
  tx: Transaction,
  userId: string,
  { examCode, memberExamDate, addedAt, removedAt }: TargetExamRecord,
): Promise<void> {
  const { memberTargetExams } = schema;
  const removed = removedAt === null ? null : new Date(removedAt);
  await tx
    .insert(memberTargetExams)
    .values({ userId, examCode, memberExamDate, addedAt: new Date(addedAt), removedAt: removed })
    .onConflictDoUpdate({
      target: [memberTargetExams.userId, memberTargetExams.examCode],
      set: { memberExamDate, removedAt: removed },
    });
}

const withMemberExams: WithMemberExams = async (userId, work) => {
  const { members } = schema;
  try {
    return await getDb().transaction(async (tx) => {
      // Locking the Member's row makes their changes take turns, so two
      // removals arriving together can't both leave them with no Target Exam.
      const [member] = await tx
        .select({ selectedExamCode: members.selectedExamCode })
        .from(members)
        .where(eq(members.userId, userId))
        .for("update");
      if (!member) throw new Error("Only a Member has Target Exams.");

      const { change, result } = work({
        records: await readRecords(tx, userId),
        selectedExamCode: member.selectedExamCode,
        exams: await readExams(tx),
      });
      if (change?.record) await writeTargetExam(tx, userId, change.record);
      if (change && change.selectedExamCode !== undefined) {
        await tx
          .update(members)
          .set({ selectedExamCode: change.selectedExamCode })
          .where(eq(members.userId, userId));
      }
      return result;
    });
  } catch (error) {
    throw asDatabaseError(error);
  }
};

// ── The Active Device ───────────────────────────────────────────────────────

type DeviceSwitchRow = typeof schema.memberDeviceSwitches.$inferSelect;

export const deviceSwitchFromRow = (row: DeviceSwitchRow): DeviceSwitch => ({
  userId: row.userId,
  deviceLabel: row.deviceLabel,
  switchedAt: row.switchedAt.toISOString(),
});

const claimDevice: MemberService["claimDevice"] = async (userId, claim) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { tokenHash, deviceLabel } = deviceClaimSchema.parse(claim);
  const { memberActiveDevices, memberDeviceSwitches } = schema;
  const claimedAt = new Date();
  try {
    // One transaction: the record is never replaced without its log row. The
    // foreign keys to members refuse a User the gate never let in.
    await getDb().transaction(async (tx) => {
      await tx
        .insert(memberActiveDevices)
        .values({ userId: wanted, tokenHash, deviceLabel, claimedAt })
        .onConflictDoUpdate({
          target: memberActiveDevices.userId,
          set: { tokenHash, deviceLabel, claimedAt },
        });
      await tx
        .insert(memberDeviceSwitches)
        .values({ userId: wanted, deviceLabel, switchedAt: claimedAt });
    });
    return { deviceLabel, claimedAt: claimedAt.toISOString() };
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const deviceStatus: MemberService["deviceStatus"] = async (userId, tokenHash) => {
  const wanted = memberUserIdSchema.parse(userId);
  if (tokenHash === null) return "no-token";
  const { memberActiveDevices } = schema;
  try {
    const [row] = await getDb()
      .select({ tokenHash: memberActiveDevices.tokenHash })
      .from(memberActiveDevices)
      .where(eq(memberActiveDevices.userId, wanted));
    return deviceStatusFor(row?.tokenHash ?? null, tokenHash);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const getActiveDevice: MemberService["getActiveDevice"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberActiveDevices } = schema;
  try {
    const [row] = await getDb()
      .select({
        deviceLabel: memberActiveDevices.deviceLabel,
        claimedAt: memberActiveDevices.claimedAt,
      })
      .from(memberActiveDevices)
      .where(eq(memberActiveDevices.userId, wanted));
    return row ? { deviceLabel: row.deviceLabel, claimedAt: row.claimedAt.toISOString() } : null;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listDeviceSwitches: MemberService["listDeviceSwitches"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberDeviceSwitches } = schema;
  try {
    const rows = await getDb()
      .select()
      .from(memberDeviceSwitches)
      .where(eq(memberDeviceSwitches.userId, wanted))
      .orderBy(asc(memberDeviceSwitches.seq));
    return rows.map(deviceSwitchFromRow);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const deviceSwitchCount: MemberService["deviceSwitchCount"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberDeviceSwitches } = schema;
  try {
    const [row] = await getDb()
      .select({ switches: count() })
      .from(memberDeviceSwitches)
      .where(eq(memberDeviceSwitches.userId, wanted));
    return row?.switches ?? 0;
  } catch (error) {
    throw asDatabaseError(error);
  }
};

// ── The Library and content ─────────────────────────────────────────────────

/** The Exams with these codes (or every one), each with its Subjects in order. */
async function readContentExams(db: Reader, examCode?: string): Promise<ContentExam[]> {
  const { exams, subjects } = schema;
  const rows = await db
    .select({ examCode: exams.code, code: subjects.code, name: subjects.name })
    .from(exams)
    .leftJoin(subjects, eq(subjects.examCode, exams.code))
    .where(examCode === undefined ? undefined : eq(exams.code, examCode))
    .orderBy(asc(exams.position), asc(subjects.position));
  const found = new Map<string, ContentExam & { subjects: { code: string; name: string }[] }>();
  for (const row of rows) {
    const exam = found.get(row.examCode) ?? { code: row.examCode, subjects: [] };
    found.set(row.examCode, exam);
    if (row.code !== null && row.name !== null)
      exam.subjects.push({ code: row.code, name: row.name });
  }
  return [...found.values()];
}

/** Joins a record's Topic, when it's in this Exam: what scopes each kind's records to an Exam. */
const topicInExam = (topicId: Column, examCode: string) =>
  and(eq(topicId, schema.topics.id), eq(schema.topics.examCode, examCode));

/** An Exam's Topics and each kind's records in them, Hidden and Draft ones too. */
async function readExamRecords(db: Reader, examCode: string) {
  const { topics, decks, quizzes, reviewerPdfs } = schema;
  const [topicRows, deckRows, quizRows, pdfRows] = await Promise.all([
    db.select().from(topics).where(eq(topics.examCode, examCode)),
    db.select({ row: decks }).from(decks).innerJoin(topics, topicInExam(decks.topicId, examCode)),
    db
      .select({ row: quizzes })
      .from(quizzes)
      .innerJoin(topics, topicInExam(quizzes.topicId, examCode)),
    db
      .select({ row: reviewerPdfs })
      .from(reviewerPdfs)
      .innerJoin(topics, topicInExam(reviewerPdfs.topicId, examCode)),
  ]);
  const pdfs = pdfRows.map(({ row }) => row);
  return {
    content: contentFromRows({
      topics: topicRows,
      decks: deckRows.map(({ row }) => row),
      quizzes: quizRows.map(({ row }) => row),
      reviewerPdfs: pdfs,
    }),
    /** How many pages a Member can read in each Reviewer PDF, by its id. */
    pageCounts: new Map(pdfs.map((pdf) => [pdf.id, readablePageCount(pdf)])),
  };
}

const getLibrary: MemberService["getLibrary"] = async (examCode) => {
  const wanted = examCode.trim().toUpperCase();
  try {
    const db = getDb();
    const [exam] = await readContentExams(db, wanted);
    if (!exam) return [];
    const { content } = await readExamRecords(db, wanted);
    return libraryOf(exam, content);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

/** The record of this kind with this id, as the content rules take it, or none. */
async function readRecord(db: Reader, ref: { kind: ContentKind; id: string }) {
  const { decks, quizzes, reviewerPdfs } = schema;
  const none = { decks: [], quizzes: [], reviewerPdfs: [] };
  switch (ref.kind) {
    case "deck":
      return { ...none, decks: await db.select().from(decks).where(eq(decks.id, ref.id)) };
    case "quiz":
      return { ...none, quizzes: await db.select().from(quizzes).where(eq(quizzes.id, ref.id)) };
    case "reviewer-pdf":
      return {
        ...none,
        reviewerPdfs: await db.select().from(reviewerPdfs).where(eq(reviewerPdfs.id, ref.id)),
      };
  }
}

const getContentItem: MemberService["getContentItem"] = async (kind, id) => {
  const ref = contentRefSchema.safeParse({ kind, id });
  if (!ref.success) return null;
  const { topics } = schema;
  try {
    const db = getDb();
    const records = await readRecord(db, ref.data);
    const [record] = [...records.decks, ...records.quizzes, ...records.reviewerPdfs];
    if (!record?.topicId) return null;
    const topicRows = await db.select().from(topics).where(eq(topics.id, record.topicId));
    const [topic] = topicRows;
    if (!topic) return null;
    return contentItemOf(
      ref.data.kind,
      ref.data.id,
      await readContentExams(db, topic.examCode),
      contentFromRows({ topics: topicRows, ...records }),
    );
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listAccessPasses: MemberService["listAccessPasses"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { accessPasses } = schema;
  try {
    const rows = await getDb()
      .select()
      .from(accessPasses)
      .where(eq(accessPasses.userId, wanted))
      .orderBy(asc(accessPasses.examCode));
    return rows.map(accessPassFromRow);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

// ── Studying a deck ─────────────────────────────────────────────────────────

type CardMarkRow = typeof schema.cardMarks.$inferSelect;

const cardMarkFromRow = (row: CardMarkRow) => ({
  userId: row.userId,
  cardId: row.cardId,
  verdict: row.verdict,
  markedAt: row.markedAt.toISOString(),
});

/** Runs a store call, giving the database's errors as one error type. */
async function inDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

/**
 * The private bucket's signed URLs for card images and quiz figures: Storage
 * when this server has it, as the Admin's editors store them there.
 */
const signContentImages = (paths: readonly string[], seconds: number) =>
  (isStorageConfigured ? storageArm.contentFiles : sampleContentFiles).signedUrls(paths, seconds);

const databaseStudyStore: DeckStudyStore = {
  readDeckItem: (deckId) => getContentItem("deck", deckId),
  readCards: (deckId) =>
    inDatabase(async () => {
      const { cards } = schema;
      const rows = await getDb()
        .select()
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(asc(cards.position));
      return rows.map(cardFromRow);
    }),
  deckOfCard: (cardId) =>
    inDatabase(async () => {
      const { cards } = schema;
      const [row] = await getDb()
        .select({ deckId: cards.deckId })
        .from(cards)
        .where(eq(cards.id, cardId));
      return row?.deckId ?? null;
    }),
  readMarks: (userId, deckId) =>
    inDatabase(async () => {
      const { cards, cardMarks } = schema;
      const rows = await getDb()
        .select({ mark: cardMarks })
        .from(cardMarks)
        .innerJoin(cards, eq(cards.id, cardMarks.cardId))
        .where(and(eq(cardMarks.userId, userId), eq(cards.deckId, deckId)));
      return rows.map(({ mark }) => cardMarkFromRow(mark));
    }),
  readPosition: (userId, deckId) =>
    inDatabase(async () => {
      const { deckPositions } = schema;
      const [row] = await getDb()
        .select({ cardId: deckPositions.cardId })
        .from(deckPositions)
        .where(and(eq(deckPositions.userId, userId), eq(deckPositions.deckId, deckId)));
      return row?.cardId ?? null;
    }),
  saveMark: (mark, day) =>
    inDatabase(() =>
      getDb().transaction(async (tx) => {
        const { cards, cardMarks, studyDays } = schema;
        // Holding the card keeps it from being deleted until the mark is in.
        const [card] = await tx
          .select({ id: cards.id })
          .from(cards)
          .where(eq(cards.id, mark.cardId))
          .for("share");
        if (!card) return false;
        const markedAt = new Date(mark.markedAt);
        // The foreign keys to members refuse a User the gate never let in.
        await tx
          .insert(cardMarks)
          .values({ userId: mark.userId, cardId: mark.cardId, verdict: mark.verdict, markedAt })
          .onConflictDoUpdate({
            target: [cardMarks.userId, cardMarks.cardId],
            set: { verdict: mark.verdict, markedAt },
          });
        await tx.insert(studyDays).values({ userId: mark.userId, day }).onConflictDoNothing();
        return true;
      }),
    ),
  savePosition: (userId, deckId, position) =>
    inDatabase(() =>
      getDb().transaction(async (tx) => {
        const { cards, deckPositions } = schema;
        const mine = and(eq(deckPositions.userId, userId), eq(deckPositions.deckId, deckId));
        if (!position) {
          await tx.delete(deckPositions).where(mine);
          return true;
        }
        const [card] = await tx
          .select({ id: cards.id })
          .from(cards)
          .where(and(eq(cards.id, position.cardId), eq(cards.deckId, deckId)))
          .for("share");
        if (!card) return false;
        const savedAt = new Date(position.savedAt);
        await tx
          .insert(deckPositions)
          .values({ userId, deckId, cardId: position.cardId, savedAt })
          .onConflictDoUpdate({
            target: [deckPositions.userId, deckPositions.deckId],
            set: { cardId: position.cardId, savedAt },
          });
        return true;
      }),
    ),
  readStudyDays: (userId) =>
    inDatabase(async () => {
      const { studyDays } = schema;
      const rows = await getDb()
        .select({ day: studyDays.day })
        .from(studyDays)
        .where(eq(studyDays.userId, userId))
        .orderBy(asc(studyDays.day));
      return rows.map((row) => row.day);
    }),
  signImages: signContentImages,
};

// ── Taking a quiz ───────────────────────────────────────────────────────────

const databaseQuizStore: QuizStudyStore = {
  readQuizItem: (quizId) => getContentItem("quiz", quizId),
  readQuiz: (quizId) =>
    inDatabase(async () => {
      const { quizzes, questions } = schema;
      const db = getDb();
      const [quizRows, questionRows] = await Promise.all([
        db.select().from(quizzes).where(eq(quizzes.id, quizId)),
        db.select().from(questions).where(eq(questions.quizId, quizId)),
      ]);
      const [quiz] = quizRows;
      return quiz
        ? { quiz: quizFromRow(quiz), questions: questionRows.map(questionFromRow) }
        : null;
    }),
  readAttempts: (userId, quizId) =>
    inDatabase(async () => {
      const { quizAttempts } = schema;
      const rows = await getDb()
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId)))
        .orderBy(desc(quizAttempts.submittedAt), desc(quizAttempts.id));
      return rows.map(quizAttemptFromRow);
    }),
  readAttempt: (userId, attemptId) =>
    inDatabase(async () => {
      const { quizAttempts, quizAttemptAnswers } = schema;
      const db = getDb();
      // Scoped to the Member: another Member's attempt reads as none.
      const [row] = await db
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)));
      if (!row) return null;
      const answers = await db
        .select()
        .from(quizAttemptAnswers)
        .where(eq(quizAttemptAnswers.attemptId, row.id))
        .orderBy(asc(quizAttemptAnswers.position));
      return { ...quizAttemptFromRow(row), answers: answers.map(quizAttemptAnswerFromRow) };
    }),
  saveAttempt: (attempt, day) =>
    inDatabase(() =>
      getDb().transaction(async (tx) => {
        const { quizAttempts, quizAttemptAnswers, studyDays } = schema;
        // The attempt's id is its own: one saved already, by anyone, saves nothing.
        // The foreign keys to members refuse a User the gate never let in.
        const [inserted] = await tx
          .insert(quizAttempts)
          .values(quizAttemptToRow(attempt))
          .onConflictDoNothing({ target: quizAttempts.id })
          .returning({ id: quizAttempts.id });
        if (!inserted) return "exists";
        await tx.insert(quizAttemptAnswers).values(quizAttemptAnswersToRows(attempt));
        await tx.insert(studyDays).values({ userId: attempt.userId, day }).onConflictDoNothing();
        return "saved";
      }),
    ),
  signImages: signContentImages,
};

// ── Reading a Reviewer PDF ──────────────────────────────────────────────────

/** The private Reviewer PDFs bucket: Storage when this server has it, as the Admin's job stores pages there. */
const reviewerPdfFiles = isStorageConfigured ? storageArm.reviewerPdfFiles : sampleReviewerPdfFiles;

/**
 * Runs a Member's write in a transaction that holds the Reviewer PDF, so it
 * can't be deleted until the write is in. False, writing nothing, when it's
 * gone. The foreign keys to members refuse a User the gate never let in.
 */
const whileReviewerPdfHeld = (reviewerPdfId: string, write: (tx: Transaction) => Promise<void>) =>
  inDatabase(() =>
    getDb().transaction(async (tx) => {
      const { reviewerPdfs } = schema;
      const [pdf] = await tx
        .select({ id: reviewerPdfs.id })
        .from(reviewerPdfs)
        .where(eq(reviewerPdfs.id, reviewerPdfId))
        .for("share");
      if (!pdf) return false;
      await write(tx);
      return true;
    }),
  );

const databaseReviewerStore: ReviewerStudyStore = {
  readReviewerPdfItem: (reviewerPdfId) => getContentItem("reviewer-pdf", reviewerPdfId),
  readPageCount: (reviewerPdfId) =>
    inDatabase(async () => {
      const { reviewerPdfs } = schema;
      const [row] = await getDb()
        .select({ pageCount: reviewerPdfs.pageCount, pagesDone: reviewerPdfs.pagesDone })
        .from(reviewerPdfs)
        .where(eq(reviewerPdfs.id, reviewerPdfId));
      return readablePageCount(row ?? null);
    }),
  readPage: (reviewerPdfId, page) => reviewerPdfFiles.readPage(reviewerPdfId, page),
  readMemberEmail: (userId) =>
    inDatabase(async () => {
      const { members } = schema;
      const [row] = await getDb()
        .select({ email: members.email })
        .from(members)
        .where(eq(members.userId, userId));
      return row?.email ?? null;
    }),
  countPagesViewed: (userId, reviewerPdfId) =>
    inDatabase(async () => {
      const { reviewerPageViews } = schema;
      const [row] = await getDb()
        .select({ viewed: count() })
        .from(reviewerPageViews)
        .where(
          and(
            eq(reviewerPageViews.userId, userId),
            eq(reviewerPageViews.reviewerPdfId, reviewerPdfId),
          ),
        );
      return row?.viewed ?? 0;
    }),
  readPosition: (userId, reviewerPdfId) =>
    inDatabase(async () => {
      const { readerPositions } = schema;
      const [row] = await getDb()
        .select({ page: readerPositions.page, zoom: readerPositions.zoom })
        .from(readerPositions)
        .where(
          and(eq(readerPositions.userId, userId), eq(readerPositions.reviewerPdfId, reviewerPdfId)),
        );
      if (!row) return null;
      // The table's check keeps the zoom one of the reader's.
      if (!isReaderZoom(row.zoom)) throw new Error(`A reader position has zoom ${row.zoom}.`);
      return { page: row.page, zoom: row.zoom };
    }),
  saveView: (view, day) =>
    whileReviewerPdfHeld(view.reviewerPdfId, async (tx) => {
      const { reviewerPageViews, studyDays } = schema;
      // The first view stays.
      await tx
        .insert(reviewerPageViews)
        .values({ ...view, viewedAt: new Date(view.viewedAt) })
        .onConflictDoNothing();
      await tx.insert(studyDays).values({ userId: view.userId, day }).onConflictDoNothing();
    }),
  savePosition: (position) =>
    whileReviewerPdfHeld(position.reviewerPdfId, async (tx) => {
      const { readerPositions } = schema;
      const savedAt = new Date(position.savedAt);
      await tx
        .insert(readerPositions)
        .values({ ...position, savedAt })
        .onConflictDoUpdate({
          target: [readerPositions.userId, readerPositions.reviewerPdfId],
          set: { page: position.page, zoom: position.zoom, savedAt },
        });
    }),
};

// ── Progress ────────────────────────────────────────────────────────────────

const databaseProgressStore: ProgressStore = {
  readExamContent: (examCode) =>
    inDatabase(async () => {
      const db = getDb();
      const [exam] = await readContentExams(db, examCode);
      if (!exam) return [];
      const { cards, decks, questions, quizzes, topics } = schema;
      const [{ content, pageCounts }, cardRows, questionRows] = await Promise.all([
        readExamRecords(db, examCode),
        db
          .select({ id: cards.id, deckId: cards.deckId, position: cards.position })
          .from(cards)
          .innerJoin(decks, eq(decks.id, cards.deckId))
          .innerJoin(topics, topicInExam(decks.topicId, examCode)),
        // A removed question has no place: it's no longer in its quiz.
        db
          .select({ quizId: questions.quizId, questions: count() })
          .from(questions)
          .innerJoin(quizzes, eq(quizzes.id, questions.quizId))
          .innerJoin(topics, topicInExam(quizzes.topicId, examCode))
          .where(isNotNull(questions.position))
          .groupBy(questions.quizId),
      ]);
      return progressSubjectsOf(exam, content, {
        cards: cardRows,
        questionCounts: new Map(questionRows.map((row) => [row.quizId, row.questions])),
        pageCounts,
      });
    }),
  readRecords: (userId, examCode) =>
    inDatabase(async () => {
      const db = getDb();
      const { cardMarks, cards, decks, quizAttempts, quizzes, reviewerPageViews, reviewerPdfs } =
        schema;
      const { deckPositions, readerPositions, studyDays, topics } = schema;
      // Each record is the Member's own, of content in this Exam.
      const [marks, scores, views, deckPlaces, readerPlaces, days] = await Promise.all([
        db
          .select({ cardId: cardMarks.cardId, verdict: cardMarks.verdict, at: cardMarks.markedAt })
          .from(cardMarks)
          .innerJoin(cards, eq(cards.id, cardMarks.cardId))
          .innerJoin(decks, eq(decks.id, cards.deckId))
          .innerJoin(topics, topicInExam(decks.topicId, examCode))
          .where(eq(cardMarks.userId, userId)),
        db
          .select({
            quizId: quizAttempts.quizId,
            score: quizAttempts.score,
            at: quizAttempts.submittedAt,
          })
          .from(quizAttempts)
          .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
          .innerJoin(topics, topicInExam(quizzes.topicId, examCode))
          .where(eq(quizAttempts.userId, userId)),
        db
          .select({ reviewerPdfId: reviewerPageViews.reviewerPdfId, page: reviewerPageViews.page })
          .from(reviewerPageViews)
          .innerJoin(reviewerPdfs, eq(reviewerPdfs.id, reviewerPageViews.reviewerPdfId))
          .innerJoin(topics, topicInExam(reviewerPdfs.topicId, examCode))
          .where(eq(reviewerPageViews.userId, userId)),
        db
          .select({
            deckId: deckPositions.deckId,
            cardId: deckPositions.cardId,
            at: deckPositions.savedAt,
          })
          .from(deckPositions)
          .innerJoin(decks, eq(decks.id, deckPositions.deckId))
          .innerJoin(topics, topicInExam(decks.topicId, examCode))
          .where(eq(deckPositions.userId, userId)),
        db
          .select({
            reviewerPdfId: readerPositions.reviewerPdfId,
            page: readerPositions.page,
            at: readerPositions.savedAt,
          })
          .from(readerPositions)
          .innerJoin(reviewerPdfs, eq(reviewerPdfs.id, readerPositions.reviewerPdfId))
          .innerJoin(topics, topicInExam(reviewerPdfs.topicId, examCode))
          .where(eq(readerPositions.userId, userId)),
        db.select({ day: studyDays.day }).from(studyDays).where(eq(studyDays.userId, userId)),
      ]);
      return {
        cardMarks: marks.map(({ at, ...mark }) => ({ ...mark, markedAt: at.toISOString() })),
        quizScores: scores.map(({ at, ...score }) => ({ ...score, submittedAt: at.toISOString() })),
        pageViews: views,
        deckPositions: deckPlaces.map(({ at, ...place }) => ({
          ...place,
          savedAt: at.toISOString(),
        })),
        readerPositions: readerPlaces.map(({ at, ...place }) => ({
          ...place,
          savedAt: at.toISOString(),
        })),
        studyDays: days.map(({ day }) => day),
      };
    }),
};

// ── In-app notices ──────────────────────────────────────────────────────────

type NoticeRow = typeof schema.memberNotices.$inferSelect;

export const noticeFromRow = (row: NoticeRow): MemberNotice => ({
  id: row.id,
  userId: row.userId,
  examCode: row.examCode,
  kind: row.kind,
  endsAt: row.endsAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  dismissedAt: row.dismissedAt?.toISOString() ?? null,
});

/** A notice as a row to add: its `seq` is the table's to give. */
export const noticeToRow = (notice: MemberNotice): Omit<NoticeRow, "seq"> => ({
  id: notice.id,
  userId: notice.userId,
  examCode: notice.examCode,
  kind: notice.kind,
  endsAt: new Date(notice.endsAt),
  createdAt: new Date(notice.createdAt),
  dismissedAt: notice.dismissedAt === null ? null : new Date(notice.dismissedAt),
});

const listNotices: MemberService["listNotices"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { memberNotices } = schema;
  return inDatabase(async () => {
    const rows = await getDb()
      .select()
      .from(memberNotices)
      .where(eq(memberNotices.userId, wanted))
      .orderBy(asc(memberNotices.seq));
    return noticesToShow(rows.map(noticeFromRow));
  });
};

const dismissNotice: MemberService["dismissNotice"] = async (userId, noticeId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const id = noticeIdSchema.safeParse(noticeId);
  if (!id.success) return false;
  const { memberNotices } = schema;
  return inDatabase(async () => {
    const owned = and(eq(memberNotices.id, id.data), eq(memberNotices.userId, wanted));
    // Only the first dismissal is kept: one dismissed before matches nothing here.
    await getDb()
      .update(memberNotices)
      .set({ dismissedAt: new Date() })
      .where(and(owned, isNull(memberNotices.dismissedAt)));
    const [found] = await getDb().select({ id: memberNotices.id }).from(memberNotices).where(owned);
    return found !== undefined;
  });
};

// ── Privacy Requests ────────────────────────────────────────────────────────

type PrivacyRequestRow = typeof schema.privacyRequests.$inferSelect;

/** A request row's own fields: all but who asked, which is gone once their account is deleted. */
export const privacyRequestFieldsFromRow = (
  row: PrivacyRequestRow,
): Omit<PrivacyRequest, "userId"> => ({
  id: row.id,
  type: row.type,
  status: row.status,
  requestedAt: row.requestedAt.toISOString(),
  dueOn: row.dueOn,
});

/** One of a Member's own requests, read by their User id. */
const ownPrivacyRequest = (row: PrivacyRequestRow, userId: string): PrivacyRequest => ({
  ...privacyRequestFieldsFromRow(row),
  userId,
});

/** The Member's open Privacy Requests. */
const openRequestsOf = (userId: string) =>
  and(eq(schema.privacyRequests.userId, userId), eq(schema.privacyRequests.status, "open"));

const listOpenPrivacyRequests: MemberService["listOpenPrivacyRequests"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  const { privacyRequests } = schema;
  return inDatabase(async () =>
    (
      await getDb()
        .select()
        .from(privacyRequests)
        .where(openRequestsOf(wanted))
        .orderBy(asc(privacyRequests.requestedAt), asc(privacyRequests.id))
    ).map((row) => ownPrivacyRequest(row, wanted)),
  );
};

const requestPrivacy: MemberService["requestPrivacy"] = async (userId, type) => {
  const wanted = memberUserIdSchema.parse(userId);
  const asked = privacyRequestTypeSchema.parse(type);
  const { members, privacyRequests } = schema;
  return inDatabase(() =>
    getDb().transaction(async (tx) => {
      // Holding the Member's row makes two asks from the same Member take
      // turns, so the second finds the first open; the partial unique index
      // refuses a second open request of a type all the same.
      const [member] = await tx
        .select({ userId: members.userId })
        .from(members)
        .where(eq(members.userId, wanted))
        .for("update");
      if (!member) throw new Error("Only a Member can make a Privacy Request.");
      const [open] = await tx
        .select()
        .from(privacyRequests)
        .where(and(openRequestsOf(wanted), eq(privacyRequests.type, asked)));
      if (open) return { request: ownPrivacyRequest(open, wanted), created: false };

      const now = new Date();
      const [made] = await tx
        .insert(privacyRequests)
        .values({
          id: crypto.randomUUID(),
          userId: wanted,
          type: asked,
          status: "open",
          requestedAt: now,
          dueOn: privacyRequestDueOn(asked, now),
        })
        .returning();
      if (!made) throw new Error("The Privacy Request wasn't made.");
      return { request: ownPrivacyRequest(made, wanted), created: true };
    }),
  );
};

// ── Plans (Phase 4, ticket 02) ──────────────────────────────────────────────

/** Every Plan on sale, read fresh: an Owner switching one off takes it off the page on the next request. */
async function readPlansOnSale(db: Reader): Promise<Plan[]> {
  const { plans } = schema;
  const rows = await db
    .select({
      id: plans.id,
      examCode: plans.examCode,
      name: plans.name,
      days: plans.days,
      priceCentavos: plans.priceCentavos,
      bestValue: plans.bestValue,
      onSale: plans.onSale,
    })
    .from(plans)
    .where(eq(plans.onSale, true));
  // The table's check keeps the days to a Plan's durations.
  return rows.map((row) => ({ ...row, days: toPlanDays(row.days) }));
}

const listMemberPlans: MemberService["listMemberPlans"] = async (userId) => {
  const wanted = memberUserIdSchema.parse(userId);
  try {
    const db = getDb();
    const [exams, plans, targetExams, passes] = await Promise.all([
      readExams(db),
      readPlansOnSale(db),
      listTargetExams(wanted),
      listAccessPasses(wanted),
    ]);
    return plansExams({ exams, plans, targetExams, passes });
  } catch (error) {
    throw asDatabaseError(error);
  }
};

const listExamsOnSale: MemberService["listExamsOnSale"] = async () => {
  try {
    const db = getDb();
    const [exams, plans] = await Promise.all([readExams(db), readPlansOnSale(db)]);
    return examCodesOnSale(exams, plans);
  } catch (error) {
    throw asDatabaseError(error);
  }
};

export const databaseArm: MemberService = {
  isBetaTester,
  getOrCreateMember,
  latestConsent,
  recordConsent,
  listPickableExams,
  listTargetExams,
  ...targetExamOperations(withMemberExams),
  claimDevice,
  deviceStatus,
  getActiveDevice,
  listDeviceSwitches,
  deviceSwitchCount,
  getLibrary,
  getContentItem,
  listAccessPasses,
  ...deckStudyCalls(databaseStudyStore),
  ...quizStudyCalls(databaseQuizStore),
  ...reviewerStudyCalls(databaseReviewerStore),
  ...progressCalls(databaseProgressStore),
  listNotices,
  dismissNotice,
  listOpenPrivacyRequests,
  requestPrivacy,
  listMemberPlans,
  listExamsOnSale,
};

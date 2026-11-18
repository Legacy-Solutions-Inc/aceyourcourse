import "server-only";

import { and, asc, type Column, count, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { deviceStatusFor } from "@/lib/member-app/device-token";
import { isStorageConfigured } from "@/lib/supabase/admin";
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
import { quizStudyCalls, type QuizStudyStore } from "@/services/quiz-study.core";
import type { MemberService } from "@/services/member";
import {
  agreedVersionsSchema,
  contentRefSchema,
  deviceClaimSchema,
  memberEmailSchema,
  memberUserIdSchema,
  memberUserSchema,
} from "@/services/member.schema";
import {
  examsForMembers,
  pickableExams,
  targetExamOperations,
  targetExams,
  type MemberExam,
  type TargetExamRecord,
  type WithMemberExams,
} from "@/services/member.rules";
import type { ContentKind } from "@/services/content.types";
import type { ConsentRecord, DeviceSwitch, Member } from "@/services/member.types";
import { sampleContentFiles } from "@/services/uploads.mock";
import { storageArm } from "@/services/uploads.storage";

// The Member seam on Postgres, selected by src/services/member.ts when
// DATABASE_URL is set. Drizzle bypasses RLS, so each call is scoped here, in
// the app layer, to the User the Member App gate passes it (coding standards
// §3): a Member's records are only ever read or made by their own User id.
// The Target Exam rules (member.rules.ts), the content rules
// (content.rules.ts), the study calls (deck-study.core.ts and
// quiz-study.core.ts) and the Active Device's comparison (device-token.ts)
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

const targetExamFromRow = (row: TargetExamRow): TargetExamRecord => ({
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

const withMemberExams: WithMemberExams = async (userId, work) => {
  const { members, memberTargetExams } = schema;
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
      if (change?.record) {
        const { examCode, memberExamDate, addedAt, removedAt } = change.record;
        const removed = removedAt === null ? null : new Date(removedAt);
        await tx
          .insert(memberTargetExams)
          .values({
            userId,
            examCode,
            memberExamDate,
            addedAt: new Date(addedAt),
            removedAt: removed,
          })
          .onConflictDoUpdate({
            target: [memberTargetExams.userId, memberTargetExams.examCode],
            set: { memberExamDate, removedAt: removed },
          });
      }
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

const getLibrary: MemberService["getLibrary"] = async (examCode) => {
  const wanted = examCode.trim().toUpperCase();
  const { topics, decks, quizzes, reviewerPdfs } = schema;
  try {
    const db = getDb();
    const [exam] = await readContentExams(db, wanted);
    if (!exam) return [];
    // Each kind's records whose Topic is in this Exam.
    const inExam = (topicId: Column) => and(eq(topicId, topics.id), eq(topics.examCode, wanted));
    const [topicRows, deckRows, quizRows, pdfRows] = await Promise.all([
      db.select().from(topics).where(eq(topics.examCode, wanted)),
      db.select({ row: decks }).from(decks).innerJoin(topics, inExam(decks.topicId)),
      db.select({ row: quizzes }).from(quizzes).innerJoin(topics, inExam(quizzes.topicId)),
      db
        .select({ row: reviewerPdfs })
        .from(reviewerPdfs)
        .innerJoin(topics, inExam(reviewerPdfs.topicId)),
    ]);
    const content = contentFromRows({
      topics: topicRows,
      decks: deckRows.map(({ row }) => row),
      quizzes: quizRows.map(({ row }) => row),
      reviewerPdfs: pdfRows.map(({ row }) => row),
    });
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
};

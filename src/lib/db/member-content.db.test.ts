import type { TransactionSql } from "postgres";
import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase, rolledBack } from "./test-database";

// The Member App content's own rules in the database (spec, Phase 3 →
// Content model; Topics editor), so a save that skipped the seam's checks
// still can't break them: a Topic with content can't be deleted, nor can its
// Subject; a Topic's name is unique within its Subject, ignoring case; a
// Topic has at most one deck; and only a Reviewer PDF placed under a Topic
// can be Published. Each case runs in a rolled-back transaction, on its own
// fixture Exam.

const database = await openTestDatabase();

const ZZ = "ZZ";
const id = () => crypto.randomUUID();

/** A fixture Exam with two Subjects, S1 and S2. */
async function fixtureExam(tx: TransactionSql) {
  await tx`insert into exams (code, position, board, name, long_name, blurb, made_for)
    values (${ZZ}, 999, 'ZZLE', 'Fixture', 'Fixture Exam', 'Fixture.', 'Tests')`;
  await tx`insert into subjects (exam_code, code, position, name)
    values (${ZZ}, 'S1', 0, 'Subject one'), (${ZZ}, 'S2', 1, 'Subject two')`;
}

async function topic(tx: TransactionSql, name: string, subject = "S1") {
  const topicId = id();
  await tx`insert into topics (id, exam_code, subject_code, name, position)
    values (${topicId}, ${ZZ}, ${subject}, ${name}, 1)`;
  return topicId;
}

/** The SQLSTATE a statement fails with, run in a savepoint so the transaction goes on; null when it succeeds. */
async function failsWith(tx: TransactionSql, statement: (sp: TransactionSql) => Promise<unknown>) {
  try {
    await tx.savepoint(statement);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

const FOREIGN_KEY = "23503";
const UNIQUE = "23505";
const CHECK = "23514";

describeWithDatabase("Member App content rules in the database", database, (db) => {
  it("refuses to delete a Topic that has a deck, and deletes an empty one", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      await fixtureExam(tx);
      const full = await topic(tx, "With a deck");
      const empty = await topic(tx, "Empty");
      await tx`insert into decks (id, topic_id) values (${id()}, ${full})`;
      return {
        full: await failsWith(tx, (sp) => sp`delete from topics where id = ${full}`),
        empty: await failsWith(tx, (sp) => sp`delete from topics where id = ${empty}`),
      };
    });
    expect(outcome).toEqual({ full: FOREIGN_KEY, empty: null });
  });

  it("refuses a Topic name already in the Subject, ignoring case, but not in another Subject", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      await fixtureExam(tx);
      await topic(tx, "Simple Curves");
      return {
        sameSubject: await failsWith(tx, (sp) => topic(sp, "simple CURVES")),
        otherSubject: await failsWith(tx, (sp) => topic(sp, "Simple Curves", "S2")),
      };
    });
    expect(outcome).toEqual({ sameSubject: UNIQUE, otherSubject: null });
  });

  it("refuses to delete a Subject whose Topic has a quiz, and takes empty Topics with a deleted one", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      await fixtureExam(tx);
      const full = await topic(tx, "With a quiz");
      await topic(tx, "Empty", "S2");
      await tx`insert into quizzes (id, topic_id) values (${id()}, ${full})`;
      const blocked = await failsWith(
        tx,
        (sp) => sp`delete from subjects where exam_code = ${ZZ} and code = 'S1'`,
      );
      await tx`delete from subjects where exam_code = ${ZZ} and code = 'S2'`;
      const [left] = await tx<{ n: number }[]>`
        select count(*)::int as n from topics where exam_code = ${ZZ} and subject_code = 'S2'`;
      return { blocked, emptyTopicsLeft: left?.n };
    });
    expect(outcome).toEqual({ blocked: FOREIGN_KEY, emptyTopicsLeft: 0 });
  });

  it("allows one deck per Topic", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      await fixtureExam(tx);
      const topicId = await topic(tx, "Decked");
      await tx`insert into decks (id, topic_id) values (${id()}, ${topicId})`;
      return failsWith(
        tx,
        (sp) => sp`insert into decks (id, topic_id) values (${id()}, ${topicId})`,
      );
    });
    expect(outcome).toBe(UNIQUE);
  });

  it("starts decks and quizzes Hidden, and refuses a Published Reviewer PDF with no Topic", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      await fixtureExam(tx);
      const topicId = await topic(tx, "Defaults");
      const [deck] = await tx<{ visibility: string; free_preview: boolean }[]>`
        insert into decks (id, topic_id) values (${id()}, ${topicId})
        returning visibility, free_preview`;
      return {
        deck,
        draftWithoutTopic: await failsWith(
          tx,
          (sp) => sp`insert into reviewer_pdfs (id, status) values (${id()}, 'draft')`,
        ),
        publishedWithoutTopic: await failsWith(
          tx,
          (sp) => sp`insert into reviewer_pdfs (id, status) values (${id()}, 'published')`,
        ),
      };
    });
    expect(outcome).toEqual({
      deck: { visibility: "hidden", free_preview: false },
      draftWithoutTopic: null,
      publishedWithoutTopic: CHECK,
    });
  });
});

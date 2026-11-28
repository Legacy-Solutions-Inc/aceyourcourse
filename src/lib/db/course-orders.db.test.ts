import type { TransactionSql } from "postgres";
import { expect, it } from "vitest";

import { describeWithDatabase, openTestDatabase, rolledBack } from "./test-database";

// Orders hold one Plan or one Course in the database (Phase 5, ticket 06;
// spec, Phase 5 planning decisions → Buying a Course), so a write that
// skipped the seam's checks still can't break it: exactly one of plan_id and
// course_id is set, a Course Order has no days, and only a paid Course Order
// can be marked paid while the Course was owned. A Course an Order names
// can't be deleted. Each case runs in a rolled-back transaction, on its own
// fixture Exam.

const database = await openTestDatabase();

const ZZ = "ZZ";
const id = () => crypto.randomUUID();
const CHECK = "23514";
/** ON DELETE RESTRICT refuses with restrict_violation. */
const RESTRICTED = "23001";

/** A fixture Exam with a Subject, a 30-day Plan and a Course; gives their ids. */
async function fixtures(tx: TransactionSql) {
  await tx`insert into exams (code, position, board, name, long_name, blurb, made_for)
    values (${ZZ}, 999, 'ZZLE', 'Fixture', 'Fixture Exam', 'Fixture.', 'Tests')`;
  await tx`insert into subjects (exam_code, code, position, name)
    values (${ZZ}, 'S1', 0, 'Subject one')`;
  const planId = id();
  await tx`insert into plans (id, exam_code, name, days, price_centavos, saved_at)
    values (${planId}, ${ZZ}, 'ZZ All-Access', 30, 44900, now())`;
  const courseId = id();
  await tx`insert into courses (id, exam_code, subject_code, title, access, price_centavos, on_sale)
    values (${courseId}, ${ZZ}, 'S1', 'Fixture Course', 'sold-separately', 149900, true)`;
  return { planId, courseId };
}

/** An Order row with what it holds, as only the columns the checks read differ. */
function insertOrder(
  tx: TransactionSql,
  item: {
    planId: string | null;
    courseId: string | null;
    days: number | null;
    status?: "pending" | "paid";
    paidAlreadyOwned?: boolean;
  },
) {
  const status = item.status ?? "pending";
  return tx`insert into orders (id, exam_code, plan_id, course_id, plan_name, days,
      price_centavos, method, status, livemode, buyer_email, created_at, paid_at,
      status_changed_at, paid_already_owned)
    values (${id()}, ${ZZ}, ${item.planId}, ${item.courseId}, 'Item', ${item.days}, 149900,
      'qrph', ${status}, false, 'buyer@example.com', now(),
      ${status === "paid" ? new Date() : null}, now(), ${item.paidAlreadyOwned ?? false})`;
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

describeWithDatabase("Orders hold one Plan or one Course", database, (db) => {
  it("takes a Plan Order with days, and a Course Order with none", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      const { planId, courseId } = await fixtures(tx);
      return {
        plan: await failsWith(tx, (sp) => insertOrder(sp, { planId, courseId: null, days: 30 })),
        course: await failsWith(tx, (sp) =>
          insertOrder(sp, { planId: null, courseId, days: null }),
        ),
      };
    });
    expect(outcome).toEqual({ plan: null, course: null });
  });

  it("refuses an Order holding both a Plan and a Course, or neither, or a Course with days", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      const { planId, courseId } = await fixtures(tx);
      return {
        both: await failsWith(tx, (sp) => insertOrder(sp, { planId, courseId, days: 30 })),
        neither: await failsWith(tx, (sp) =>
          insertOrder(sp, { planId: null, courseId: null, days: null }),
        ),
        courseWithDays: await failsWith(tx, (sp) =>
          insertOrder(sp, { planId: null, courseId, days: 30 }),
        ),
        planWithoutDays: await failsWith(tx, (sp) =>
          insertOrder(sp, { planId, courseId: null, days: null }),
        ),
      };
    });
    expect(outcome).toEqual({
      both: CHECK,
      neither: CHECK,
      courseWithDays: CHECK,
      planWithoutDays: CHECK,
    });
  });

  it("marks only a paid Course Order as paid while the Course was owned", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      const { planId, courseId } = await fixtures(tx);
      const course = { planId: null, courseId, days: null, paidAlreadyOwned: true };
      return {
        paidCourse: await failsWith(tx, (sp) => insertOrder(sp, { ...course, status: "paid" })),
        pendingCourse: await failsWith(tx, (sp) => insertOrder(sp, course)),
        paidPlan: await failsWith(tx, (sp) =>
          insertOrder(sp, {
            planId,
            courseId: null,
            days: 30,
            status: "paid",
            paidAlreadyOwned: true,
          }),
        ),
      };
    });
    expect(outcome).toEqual({ paidCourse: null, pendingCourse: CHECK, paidPlan: CHECK });
  });

  it("refuses to delete a Course an Order names", async () => {
    const outcome = await rolledBack(db(), async (tx) => {
      const { courseId } = await fixtures(tx);
      await insertOrder(tx, { planId: null, courseId, days: null });
      return failsWith(tx, (sp) => sp`delete from courses where id = ${courseId}`);
    });
    expect(outcome).toBe(RESTRICTED);
  });
});

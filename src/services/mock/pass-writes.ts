import type { PassHistoryRow } from "@/lib/payments/order-ledger";
import type { PassWrite } from "@/services/access-passes.core";
import type { TargetExamRecord } from "@/services/member.rules";
import { getSampleStore } from "@/services/mock/sample-store";

/**
 * A Member's pass history for an Exam in the sample data, in order, each row
 * keyed by its place in the whole history, as the Order ledger's segment
 * model reads it and a write gives it back (writeSamplePass, a refund's
 * reduction in member.mock.ts).
 */
export function samplePassHistory(userId: string, examCode: string): PassHistoryRow[] {
  return getSampleStore().accessPassGrants.flatMap((row, key) =>
    row.userId === userId && row.examCode === examCode
      ? [{ key, orderId: row.orderId, startsAt: row.startsAt, endsAt: row.endsAt }]
      : [],
  );
}

/**
 * Writes a change to a Member's Access Pass for an Exam into the sample
 * data: the Staff Activity first (should it fail, nothing else is written),
 * then the pass (made when they held none), its history row or the rows an
 * end moved (ticket 10), the Target Exam
 * record (added, or replacing theirs for its Exam) and the notice. An Owner's
 * grant, extension or end (mock/admin/access-passes.ts) and a Paid Order
 * (member.mock.ts) write the same way. A Node process runs one call at a time
 * here, so the writes happen together.
 */
export function writeSamplePass(userId: string, examCode: string, write: PassWrite): void {
  const store = getSampleStore();
  store.staffActivity = [...store.staffActivity, write.activity];
  const ends = { userId, examCode, endsAt: write.endsAt };
  const held = (pass: { userId: string; examCode: string }) =>
    pass.userId === userId && pass.examCode === examCode;
  store.accessPasses = store.accessPasses.some(held)
    ? store.accessPasses.map((pass) => (held(pass) ? ends : pass))
    : [...store.accessPasses, ends];
  // The rows an end moved, by their place in the whole history (ticket 10), before any new row.
  const moved = new Map(write.segments.map((segment) => [segment.key, segment]));
  store.accessPassGrants = store.accessPassGrants.map((row, key) => {
    const segment = moved.get(key);
    return segment ? { ...row, startsAt: segment.startsAt, endsAt: segment.endsAt } : row;
  });
  if (write.grant) store.accessPassGrants = [...store.accessPassGrants, write.grant];
  writeSampleTargetExam(userId, write.targetExam);
  store.memberNotices = [...store.memberNotices, write.notice];
}

/** Writes a Target Exam record a grant adds or brings back: added, or replacing theirs for its Exam. */
export function writeSampleTargetExam(userId: string, targetExam: TargetExamRecord | null): void {
  if (!targetExam) return;
  const store = getSampleStore();
  const records = store.memberTargetExams[userId] ?? [];
  store.memberTargetExams[userId] = records.some((r) => r.examCode === targetExam.examCode)
    ? records.map((r) => (r.examCode === targetExam.examCode ? targetExam : r))
    : [...records, targetExam];
}

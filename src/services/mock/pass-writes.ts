import type { PassWrite } from "@/services/access-passes.core";
import { getSampleStore } from "@/services/mock/sample-store";

/**
 * Writes a change to a Member's Access Pass for an Exam into the sample
 * data: the Staff Activity first (should it fail, nothing else is written),
 * then the pass (made when they held none), its history row, the Target Exam
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
  if (write.grant) store.accessPassGrants = [...store.accessPassGrants, write.grant];
  const { targetExam } = write;
  if (targetExam) {
    const records = store.memberTargetExams[userId] ?? [];
    store.memberTargetExams[userId] = records.some((r) => r.examCode === targetExam.examCode)
      ? records.map((r) => (r.examCode === targetExam.examCode ? targetExam : r))
      : [...records, targetExam];
  }
  store.memberNotices = [...store.memberNotices, write.notice];
}

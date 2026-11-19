import { type AccessPassStore, accessPassCalls } from "@/services/access-passes.core";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's Access Pass actions (Phase 3, ticket 17):
// the shared calls (src/services/access-passes.core.ts) over the in-memory
// sample store, where the Member App's sample arm reads the passes, Target
// Exams and notices they write. A Node process runs one call at a time here,
// so a change reads and writes in one step.

const sampleAccessPassStore: AccessPassStore = {
  async withPass(userId, examCode, work) {
    const store = getSampleStore();
    const member = store.members.find((candidate) => candidate.userId === userId);
    if (!member) return null;
    const pass =
      store.accessPasses.find((held) => held.userId === userId && held.examCode === examCode) ??
      null;
    const { write, result } = work(
      structuredClone({
        member,
        examExists: store.catalogue.exams.some((exam) => exam.code === examCode),
        pass,
        targetExams: store.memberTargetExams[userId] ?? [],
      }),
    );
    if (!write) return result;

    // The Staff Activity first: should it fail, nothing else is written.
    store.staffActivity = [...store.staffActivity, write.activity];
    const ends = { userId, examCode, endsAt: write.endsAt };
    store.accessPasses = pass
      ? store.accessPasses.map((held) => (held === pass ? ends : held))
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
    return result;
  },
};

export const { grantAccess, extendAccess, endAccess } = accessPassCalls(sampleAccessPassStore);

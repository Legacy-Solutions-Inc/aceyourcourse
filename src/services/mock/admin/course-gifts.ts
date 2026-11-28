import { type CourseGiftStore, courseGiftCalls } from "@/services/course-ownership.core";
import { sampleCourseOwnership, samplePaidCourseOrders } from "@/services/mock/course-ownerships";
import { writeSampleTargetExam } from "@/services/mock/pass-writes";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's "Give Course" and "Remove Course" (Phase
// 5, ticket 07): the shared calls (src/services/course-ownership.core.ts)
// over the in-memory sample store, where the Member App's sample arm reads
// the Course Ownerships, Target Exams and notices they write. A Node process
// runs one call at a time here, so a change reads and writes in one step.

const sampleCourseGiftStore: CourseGiftStore = {
  async withMemberCourse(userId, courseId, work) {
    const store = getSampleStore();
    const member = store.members.find((candidate) => candidate.userId === userId);
    if (!member) return null;
    const { write, result } = work(
      structuredClone({
        member,
        course: store.courses.find((candidate) => candidate.id === courseId) ?? null,
        ownership: sampleCourseOwnership(userId, courseId),
        paidOrders: samplePaidCourseOrders(userId, courseId),
        targetExams: store.memberTargetExams[userId] ?? [],
      }),
    );
    if (!write) return result;

    // Staff Activity first: should it fail, nothing else is written.
    store.staffActivity = [...store.staffActivity, write.activity];
    const { change } = write;
    if (change.kind === "give") {
      store.courseOwnerships = [...store.courseOwnerships, structuredClone(change.ownership)];
      writeSampleTargetExam(userId, change.targetExam);
    } else {
      store.courseOwnerships = store.courseOwnerships.filter(
        (held) => held.userId !== change.userId || held.courseId !== change.courseId,
      );
    }
    store.memberNotices = [...store.memberNotices, write.notice];
    return result;
  },
};

export const { giveCourse, removeCourse } = courseGiftCalls(sampleCourseGiftStore);

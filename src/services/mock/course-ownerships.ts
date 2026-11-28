import type { Order } from "@/lib/payments/order-ledger";
import type { CourseOwnership } from "@/services/courses.types";
import { getSampleStore } from "@/services/mock/sample-store";

// A Member's hold on one Course in the sample data (Phase 5, ticket 07), as a
// Course Order's outcome (member.mock.ts) and an Owner's gift
// (mock/admin/course-gifts.ts) both read it, the way the database arm's
// readPaidCourseOrders does (member.db.ts).

/** The Member's Ownership of the Course in the sample data, or null. */
export const sampleCourseOwnership = (userId: string, courseId: string): CourseOwnership | null =>
  getSampleStore().courseOwnerships.find(
    (ownership) => ownership.userId === userId && ownership.courseId === courseId,
  ) ?? null;

/** The Member's Paid Orders for the Course in the sample data, oldest paid first, then by reference. */
export const samplePaidCourseOrders = (
  userId: string,
  courseId: string,
): Pick<Order, "id" | "reference">[] =>
  getSampleStore()
    .orders.filter(
      (order) => order.userId === userId && order.courseId === courseId && order.status === "paid",
    )
    .sort(
      (a, b) =>
        (a.paidAt ?? "").localeCompare(b.paidAt ?? "") || a.reference.localeCompare(b.reference),
    )
    .map(({ id, reference }) => ({ id, reference }));

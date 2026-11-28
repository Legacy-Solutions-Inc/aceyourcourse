import { describe, expect, it } from "vitest";

import type { Course } from "@/services/courses.types";

import {
  courseFromRow,
  courseOwnershipFromRow,
  courseToRow,
  lessonProgressFromRow,
} from "./courses.rows";

// A Course's row keeps its creation time as a timestamp (Phase 5, ticket 01).
describe("a Course's row", () => {
  const course: Course = {
    id: "c0000000-0000-4000-8000-000000000001",
    examCode: "CE",
    subjectCode: "PSAD",
    title: "PSAD Masterclass",
    description: "",
    coverSrc: null,
    visibility: "hidden",
    access: "sold-separately",
    priceCentavos: 149_900,
    onSale: true,
    createdAt: "2026-11-28T00:00:00.000Z",
  };

  it("keeps the creation time as a timestamp, and gives it back as the same ISO time", () => {
    const row = courseToRow(course);
    expect(row.createdAt).toEqual(new Date("2026-11-28T00:00:00.000Z"));
    expect(courseFromRow(row)).toEqual(course);
  });
});

// A Course Ownership's row keeps when it began as a timestamp (ticket 07).
describe("a Course Ownership's row", () => {
  it("gives when it began back as an ISO time, and its Order, or none for a gift", () => {
    const row = {
      userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
      courseId: "c0000000-0000-4000-8000-000000000001",
      since: new Date("2026-11-28T12:00:00.000Z"),
      orderId: null,
    };
    expect(courseOwnershipFromRow(row)).toEqual({ ...row, since: "2026-11-28T12:00:00.000Z" });
  });
});

// Lesson progress keeps when it was done and last watched as timestamps (ticket 07).
describe("a Lesson progress row", () => {
  const row = {
    userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
    lessonId: "c0000000-0000-4000-8000-000000000002",
    positionSeconds: 140,
    furthestSeconds: 600,
    doneAt: new Date("2026-11-28T12:10:00.000Z"),
    watchedAt: new Date("2026-11-28T12:20:00.000Z"),
  };

  it("gives when it was done and last watched back as ISO times", () => {
    expect(lessonProgressFromRow(row)).toEqual({
      ...row,
      doneAt: "2026-11-28T12:10:00.000Z",
      watchedAt: "2026-11-28T12:20:00.000Z",
    });
  });

  it("gives no done time while the Lesson isn't done", () => {
    expect(lessonProgressFromRow({ ...row, doneAt: null }).doneAt).toBeNull();
  });
});

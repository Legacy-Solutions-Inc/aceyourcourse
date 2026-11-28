import { describe, expect, it } from "vitest";

import type { Course } from "@/services/courses.types";

import { courseFromRow, courseToRow } from "./courses.rows";

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

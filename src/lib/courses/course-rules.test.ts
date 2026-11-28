import { describe, expect, it } from "vitest";

import {
  ADD_A_VIDEO,
  courseMeta,
  howMembersGetIt,
  lessonsAfterMoveToModule,
  lessonStateLabel,
  moduleDeleteRefusal,
  NEEDS_PUBLISHED_LESSON,
  publishRefusal,
  subjectRefusal,
  visibilityRefusal,
  WAIT_FOR_VIDEO,
} from "./course-rules";

// The Course builder's rules (Phase 5, ticket 01; spec, Phase 5 planning
// decisions → A Course, The Course builder): which Subject a Course may
// take, when it may be Visible, when a Lesson may be published, when a
// Module may be deleted, and where Lessons end up after "Move to Module…".

const CE = { code: "CE", subjects: [{ code: "MSTC" }, { code: "HPGE" }, { code: "PSAD" }] };

describe("subjectRefusal", () => {
  it("allows one of the Exam's own Subjects", () => {
    expect(subjectRefusal(CE, "PSAD")).toBeNull();
  });

  it("refuses a Subject of another Exam, or no Exam at all", () => {
    expect(subjectRefusal(CE, "ANAT")).toBe("PICK ONE OF CE’S SUBJECTS");
    expect(subjectRefusal(undefined, "PSAD")).toBe("PICK AN EXAM");
  });
});

describe("visibilityRefusal", () => {
  it("refuses Visible without a Published Lesson", () => {
    expect(visibilityRefusal("visible", 0)).toBe(NEEDS_PUBLISHED_LESSON);
    expect(NEEDS_PUBLISHED_LESSON).toBe("Needs at least one published lesson");
  });

  it("allows Visible with a Published Lesson, and Hidden always", () => {
    expect(visibilityRefusal("visible", 1)).toBeNull();
    expect(visibilityRefusal("hidden", 0)).toBeNull();
  });
});

describe("publishRefusal", () => {
  it("refuses a Lesson with no video, or whose upload failed", () => {
    expect(publishRefusal("no-video")).toBe(ADD_A_VIDEO);
    expect(publishRefusal("upload-failed")).toBe(ADD_A_VIDEO);
    expect(ADD_A_VIDEO).toBe("ADD A VIDEO BEFORE PUBLISHING");
  });

  it("asks to wait while the video is uploading or processing", () => {
    expect(publishRefusal("uploading")).toBe(WAIT_FOR_VIDEO);
    expect(publishRefusal("processing")).toBe(WAIT_FOR_VIDEO);
  });

  it("allows a Lesson whose video is ready", () => {
    expect(publishRefusal("draft")).toBeNull();
    expect(publishRefusal("published")).toBeNull();
  });
});

describe("moduleDeleteRefusal", () => {
  it("refuses a Module that still has Lessons", () => {
    expect(moduleDeleteRefusal(1)).toBe("MOVE OR DELETE ITS 1 LESSON FIRST");
    expect(moduleDeleteRefusal(3)).toBe("MOVE OR DELETE ITS 3 LESSONS FIRST");
  });

  it("allows an empty Module", () => {
    expect(moduleDeleteRefusal(0)).toBeNull();
  });
});

describe("lessonsAfterMoveToModule", () => {
  const lessons = [
    { id: "a1", moduleId: "A", position: 1 },
    { id: "a2", moduleId: "A", position: 2 },
    { id: "a3", moduleId: "A", position: 3 },
    { id: "b1", moduleId: "B", position: 1 },
  ];

  it("puts the Lesson last in the other Module and closes the gap it leaves", () => {
    const moved = lessonsAfterMoveToModule(lessons, "a1", "B");
    expect(moved).toEqual([
      { id: "a2", moduleId: "A", position: 1 },
      { id: "a3", moduleId: "A", position: 2 },
      { id: "b1", moduleId: "B", position: 1 },
      { id: "a1", moduleId: "B", position: 2 },
    ]);
  });

  it("moves into an empty Module as its first Lesson", () => {
    const moved = lessonsAfterMoveToModule(lessons, "b1", "C");
    expect(moved.find((lesson) => lesson.id === "b1")).toEqual({
      id: "b1",
      moduleId: "C",
      position: 1,
    });
  });

  it("changes nothing when the Lesson is already in that Module", () => {
    expect(lessonsAfterMoveToModule(lessons, "a2", "A")).toEqual(lessons);
  });
});

describe("howMembersGetIt", () => {
  it("names the Exam's All-Access for an included Course", () => {
    expect(howMembersGetIt({ access: "included", priceCentavos: null }, "CE")).toBe(
      "Included in CE All-Access",
    );
  });

  it("gives a separately sold Course's price in whole pesos", () => {
    expect(howMembersGetIt({ access: "sold-separately", priceCentavos: 149_900 }, "CE")).toBe(
      "Sold separately · ₱1,499",
    );
    expect(howMembersGetIt({ access: "sold-separately", priceCentavos: null }, "CE")).toBe(
      "Sold separately · No price yet",
    );
  });
});

describe("courseMeta and lessonStateLabel", () => {
  it("counts the Modules, Lessons and Published Lessons", () => {
    expect(
      courseMeta({ examCode: "CE", subjectCode: "PSAD" }, [
        { lessons: [{ state: "published" }, { state: "no-video" }] },
        { lessons: [{ state: "draft" }] },
      ]),
    ).toBe("CE · PSAD · 2 MODULES · 3 LESSONS · 1 PUBLISHED");
    expect(courseMeta({ examCode: "CE", subjectCode: "MSTC" }, [{ lessons: [] }])).toBe(
      "CE · MSTC · 1 MODULE · 0 LESSONS · 0 PUBLISHED",
    );
  });

  it("names every Lesson state", () => {
    expect(lessonStateLabel("no-video")).toBe("NO VIDEO");
    expect(lessonStateLabel("upload-failed")).toBe("UPLOAD FAILED");
    expect(lessonStateLabel("published")).toBe("PUBLISHED");
  });
});

import { describe, expect, it } from "vitest";

import {
  ADD_A_VIDEO,
  courseMeta,
  howMembersGetIt,
  lessonsAfterMoveToModule,
  lessonStateLabel,
  moduleDeleteRefusal,
  NEEDS_PUBLISHED_LESSON,
  ADD_A_TITLE,
  PICK_A_VIDEO_FILE,
  publishRefusal,
  unpublishRefusal,
  uploadProgressLine,
  videoFileRefusal,
  videoLength,
  subjectRefusal,
  visibilityRefusal,
  WAIT_FOR_VIDEO,
} from "./course-rules";
import type { LessonState } from "@/services/courses.types";

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
  const titled = (state: LessonState, title = "Beams in flexure") => ({ state, title });

  it("refuses a Lesson with no video, or whose upload failed", () => {
    expect(publishRefusal(titled("no-video"))).toBe(ADD_A_VIDEO);
    expect(publishRefusal(titled("upload-failed"))).toBe(ADD_A_VIDEO);
    expect(ADD_A_VIDEO).toBe("ADD A VIDEO BEFORE PUBLISHING");
  });

  it("asks to wait while the video is uploading or processing", () => {
    expect(publishRefusal(titled("uploading"))).toBe(WAIT_FOR_VIDEO);
    expect(publishRefusal(titled("processing"))).toBe(WAIT_FOR_VIDEO);
    expect(WAIT_FOR_VIDEO).toBe("WAIT FOR THE VIDEO TO FINISH UPLOADING");
  });

  it("refuses a Lesson with no title first, whatever its video", () => {
    expect(publishRefusal(titled("draft", "  "))).toBe(ADD_A_TITLE);
    expect(publishRefusal(titled("no-video", ""))).toBe(ADD_A_TITLE);
    expect(ADD_A_TITLE).toBe("ADD A TITLE BEFORE PUBLISHING");
  });

  it("allows a titled Lesson whose video is ready", () => {
    expect(publishRefusal(titled("draft"))).toBeNull();
    expect(publishRefusal(titled("published"))).toBeNull();
  });
});

describe("unpublishRefusal", () => {
  it("refuses unpublishing the last Published Lesson of a Visible Course", () => {
    expect(unpublishRefusal("visible", 0)).toBe(
      "A visible course needs a published lesson. Hide the course first.",
    );
  });

  it("allows it with another Published Lesson left, or on a Hidden Course", () => {
    expect(unpublishRefusal("visible", 1)).toBeNull();
    expect(unpublishRefusal("hidden", 0)).toBeNull();
  });
});

describe("videoFileRefusal", () => {
  const GB = 1024 ** 3;

  it("takes an MP4 or a MOV of up to 4 GB", () => {
    expect(videoFileRefusal({ name: "beams.mp4", type: "video/mp4", size: 1024 })).toBeNull();
    expect(
      videoFileRefusal({ name: "BEAMS.MOV", type: "video/quicktime", size: 4 * GB }),
    ).toBeNull();
    // Some browsers give no type: the name decides.
    expect(videoFileRefusal({ name: "beams.mov", type: "", size: 1024 })).toBeNull();
  });

  it("refuses any other kind of file", () => {
    for (const file of [
      { name: "beams.avi", type: "video/x-msvideo", size: 1024 },
      { name: "beams.mp4.exe", type: "application/octet-stream", size: 1024 },
      { name: "beams.mp4", type: "video/webm", size: 1024 },
      { name: "notes.pdf", type: "application/pdf", size: 1024 },
    ]) {
      expect(videoFileRefusal(file)).toBe(PICK_A_VIDEO_FILE);
    }
    expect(PICK_A_VIDEO_FILE).toBe("PICK AN MP4 OR MOV VIDEO");
  });

  it("refuses a file over 4 GB, or an empty one", () => {
    expect(videoFileRefusal({ name: "beams.mp4", type: "video/mp4", size: 4 * GB + 1 })).toBe(
      "KEEP THE VIDEO TO 4 GB OR LESS",
    );
    expect(videoFileRefusal({ name: "beams.mp4", type: "video/mp4", size: 0 })).toBe(
      PICK_A_VIDEO_FILE,
    );
  });
});

describe("uploadProgressLine", () => {
  it("says how far along, about how long is left, and to keep the page open", () => {
    expect(uploadProgressLine(0.41, 6 * 60)).toBe("41% · about 6 min left · keep this page open");
    expect(uploadProgressLine(0.995, 20)).toBe(
      "99% · less than a minute left · keep this page open",
    );
    expect(uploadProgressLine(0.5, 90)).toBe("50% · about 2 min left · keep this page open");
  });

  it("says nothing of the time left before it can tell", () => {
    expect(uploadProgressLine(0, null)).toBe("0% · keep this page open");
  });
});

describe("videoLength", () => {
  it("reads minutes and seconds, with hours when it's that long", () => {
    expect(videoLength(754)).toBe("12:34");
    expect(videoLength(59)).toBe("0:59");
    expect(videoLength(3723)).toBe("1:02:03");
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

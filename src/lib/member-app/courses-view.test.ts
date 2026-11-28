import { describe, expect, it } from "vitest";

import type { AccessDecision } from "@/lib/member-app/access";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import type { MemberCourse, MemberModule } from "@/services/member.types";

import {
  countsLabel,
  courseCard,
  courseCardState,
  courseGroups,
  emptyShelfMessage,
  lessonCrumb,
  lessonNeighbours,
} from "./courses-view";

// The Courses screen's view (Phase 5, ticket 03; spec, Phase 5 planning
// decisions → The Courses screen): pure, from the Member seam's shelf and
// each Course's access decision.

const PLANS: UnlockRoute = { kind: "plans", href: "/app/plans?exam=CE" };
const CONTACT: UnlockRoute = { kind: "contact", contactEmail: "hello@example.com" };
const ENDED = "2026-11-25T03:42:00.000Z";

const course = (change: Partial<MemberCourse> = {}): MemberCourse => ({
  id: "course-1",
  examCode: "CE",
  subjectCode: "MSTC",
  title: "Surveying & Curves Lectures",
  description: "",
  coverSrc: null,
  access: "included",
  priceCentavos: null,
  onSale: false,
  visible: true,
  owned: false,
  modules: 3,
  lessons: 32,
  freePreviewLessons: 0,
  firstLessonId: "lesson-1",
  firstFreeLessonId: null,
  decision: { outcome: "locked" },
  ...change,
});
const allowed = (via: "pass" | "ownership" | "staff"): AccessDecision => ({
  outcome: "allowed",
  via,
});
const soldSeparately = { access: "sold-separately", priceCentavos: 149_900, onSale: true } as const;

describe("courseCardState", () => {
  it.each<[string, Partial<MemberCourse>, ReturnType<typeof courseCardState>]>([
    ["owned", { ...soldSeparately, owned: true, decision: allowed("ownership") }, "owned"],
    [
      "owned, switched back to Included, for a pass holder: still OWNED",
      { owned: true, decision: allowed("pass") },
      "owned",
    ],
    [
      "owned by active Staff",
      { ...soldSeparately, owned: true, decision: allowed("staff") },
      "owned",
    ],
    ["included, active Access Pass", { decision: allowed("pass") }, "in-plan"],
    ["included, no Access Pass", {}, "see-plans"],
    [
      "included, Access Pass ended",
      { decision: { outcome: "expired", passEndedAt: ENDED } },
      "renew",
    ],
    ["sold separately, not owned, on sale", soldSeparately, "unlock"],
    [
      "sold separately, not owned, not on sale",
      { access: "sold-separately", priceCentavos: null, onSale: false },
      "not-on-sale",
    ],
    [
      "sold separately with a price but off sale",
      { ...soldSeparately, onSale: false },
      "not-on-sale",
    ],
    ["opened for active Staff", { ...soldSeparately, decision: allowed("staff") }, "staff"],
  ])("%s", (_name, change, expected) => {
    expect(courseCardState(course(change))).toBe(expected);
  });
});

describe("courseCard", () => {
  it("opens an included Course in the Member's plan at its first Lesson", () => {
    expect(courseCard(course({ decision: allowed("pass") }), PLANS)).toEqual({
      id: "course-1",
      title: "Surveying & Curves Lectures",
      href: "/app/courses/course-1",
      subjectCode: "MSTC",
      coverSrc: null,
      meta: "3 MODULES · 32 LESSONS",
      state: "in-plan",
      tag: "IN YOUR PLAN",
      locked: false,
      action: { label: "Start course", href: "/app/courses/course-1/lessons/lesson-1" },
      note: null,
      free: null,
    });
  });

  it("tags an owned Course OWNED", () => {
    const card = courseCard(
      course({ ...soldSeparately, owned: true, decision: allowed("ownership") }),
      PLANS,
    );
    expect(card).toMatchObject({ tag: "OWNED", locked: false, action: { label: "Start course" } });
  });

  it("sends a locked included Course to the Exam's Plans", () => {
    expect(courseCard(course(), PLANS)).toMatchObject({
      tag: "LOCKED",
      locked: true,
      action: { label: "See plans", href: "/app/plans?exam=CE" },
    });
  });

  it("says renew, progress kept, once the Access Pass ended", () => {
    expect(
      courseCard(course({ decision: { outcome: "expired", passEndedAt: ENDED } }), PLANS),
    ).toMatchObject({
      locked: true,
      action: { label: "Renew access", href: "/app/plans?exam=CE" },
      note: "PROGRESS KEPT",
    });
  });

  it("points at the contact note while the Exam has no Plan on sale", () => {
    expect(courseCard(course(), CONTACT).action).toEqual({ label: "See plans", href: "#unlock" });
  });

  it("unlocks a separately sold Course on sale at its price, through the Exam's Plans for now", () => {
    expect(courseCard(course(soldSeparately), CONTACT).action).toEqual({
      label: "Unlock for ₱1,499",
      href: "/app/plans?exam=CE",
    });
  });

  it("says a separately sold Course not on sale isn't on sale, with nowhere to go", () => {
    expect(
      courseCard(course({ access: "sold-separately", priceCentavos: null }), PLANS).action,
    ).toEqual({ label: "Not on sale right now", href: null });
  });

  it("adds the Free Preview Lessons to a locked Course, to watch free", () => {
    const card = courseCard(
      course({ freePreviewLessons: 2, firstFreeLessonId: "lesson-4" }),
      PLANS,
    );
    expect(card.free).toEqual({
      label: "2 FREE LESSONS",
      href: "/app/courses/course-1/lessons/lesson-4",
    });
    expect(
      courseCard(course({ freePreviewLessons: 1, firstFreeLessonId: "lesson-4" }), PLANS).free
        ?.label,
    ).toBe("1 FREE LESSON");
  });

  it("doesn't offer free Lessons on a Course the Member can already watch", () => {
    const open = course({
      decision: allowed("pass"),
      freePreviewLessons: 2,
      firstFreeLessonId: "x",
    });
    expect(courseCard(open, PLANS).free).toBeNull();
  });

  it("starts a Course with no Published Lesson at its page", () => {
    expect(
      courseCard(course({ decision: allowed("pass"), firstLessonId: null }), PLANS).action.href,
    ).toBe("/app/courses/course-1");
  });
});

describe("countsLabel", () => {
  it("counts Modules and Lessons, one in the singular", () => {
    expect(countsLabel(3, 32)).toBe("3 MODULES · 32 LESSONS");
    expect(countsLabel(1, 1)).toBe("1 MODULE · 1 LESSON");
  });
});

describe("courseGroups", () => {
  const subjects = [
    { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
    { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
    { code: "PSAD", name: "Structural Design & Construction" },
  ];

  it("groups the cards by Subject, in the Exam's Subject order, leaving out empty Subjects", () => {
    const groups = courseGroups(
      {
        subjects,
        courses: [
          course({ id: "psad", subjectCode: "PSAD" }),
          course({ id: "mstc-1" }),
          course({ id: "mstc-2" }),
        ],
      },
      PLANS,
    );
    expect(groups.map((group) => [group.subject.code, group.cards.map((card) => card.id)])).toEqual(
      [
        ["MSTC", ["mstc-1", "mstc-2"]],
        ["PSAD", ["psad"]],
      ],
    );
  });

  it("has no groups for an empty shelf", () => {
    expect(courseGroups({ subjects, courses: [] }, PLANS)).toEqual([]);
  });
});

describe("emptyShelfMessage", () => {
  it("says the Exam's Courses are on the way, and the rest is ready", () => {
    expect(emptyShelfMessage("CE")).toBe(
      "Courses for CE are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now.",
    );
  });
});

describe("lessonCrumb", () => {
  it("names the Course, Module and Lesson by number, in capitals", () => {
    expect(lessonCrumb("PSAD Masterclass", 2, 3)).toBe("PSAD MASTERCLASS · MODULE 2 · LESSON 3");
  });
});

describe("lessonNeighbours", () => {
  const lesson = (id: string, playable = true) => ({
    id,
    number: 1,
    title: `Lesson ${id}`,
    seconds: 600,
    freePreview: false,
    playable,
  });
  const outline: MemberModule[] = [
    { id: "m1", number: 1, title: "One", lessons: [lesson("a"), lesson("b")] },
    { id: "m2", number: 2, title: "Two", lessons: [lesson("c", false)] },
  ];

  it("gives the Lessons before and after, across Modules", () => {
    expect(lessonNeighbours(outline, "b")).toEqual({
      previous: lesson("a"),
      next: lesson("c", false),
    });
  });

  it("has no previous for the first Lesson and no next for the last", () => {
    expect(lessonNeighbours(outline, "a").previous).toBeNull();
    expect(lessonNeighbours(outline, "c").next).toBeNull();
  });
});

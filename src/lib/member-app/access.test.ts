import { describe, expect, it } from "vitest";

import {
  type AccessCourse,
  type AccessDecision,
  type AccessInputs,
  type AllowedVia,
  accessDecision,
  passEndDate,
} from "./access";

// The access decision (spec, Phase 3 → Access decision seam; Testing
// Decisions → Seam 2): one table over every outcome and the order the rule
// checks them in. Noon in Manila on 17 Nov 2026 is the time of every row
// that doesn't set its own.

const NOW = new Date("2026-11-17T04:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

/** A Member with no pass, on their Active Device, opening a Visible CE item that isn't Free Preview. */
const BASE: AccessInputs = {
  gate: "open",
  device: "active",
  content: { examCode: "CE", available: true, freePreview: false },
  activeStaff: false,
  passes: [],
  now: NOW,
};

type Row = [name: string, change: Partial<AccessInputs>, expected: AccessDecision];

const content = (change: Partial<AccessInputs["content"]>) => ({
  content: { ...BASE.content, ...change },
});
const activeCe = { passes: [{ examCode: "CE", endsAt: at(30 * DAY) }] };
const expiredCe = { passes: [{ examCode: "CE", endsAt: at(-DAY) }] };

const ROWS: Row[] = [
  // 4. Allowed: Free Preview, active Staff, or a pass that ends later than now.
  ["Free Preview with no pass", content({ freePreview: true }), allowed("free-preview")],
  ["an active pass for the content's Exam", activeCe, allowed("pass")],
  ["active Staff with no pass", { activeStaff: true }, allowed("staff")],
  ["active Staff whose pass expired", { activeStaff: true, ...expiredCe }, allowed("staff")],
  [
    "Free Preview with an expired pass",
    { ...content({ freePreview: true }), ...expiredCe },
    allowed("free-preview"),
  ],
  [
    "Free Preview with an active pass reads as the pass",
    { ...content({ freePreview: true }), ...activeCe },
    allowed("pass"),
  ],
  [
    "active Staff with an active pass reads as Staff",
    { activeStaff: true, ...activeCe },
    allowed("staff"),
  ],

  // 5. Otherwise expired if a pass exists for the content's Exam, or locked.
  ["no pass at all", {}, { outcome: "locked" }],
  [
    "a pass for another Exam only",
    { passes: [{ examCode: "ME", endsAt: at(30 * DAY) }] },
    { outcome: "locked" },
  ],
  [
    "an expired pass: expired, not locked",
    expiredCe,
    { outcome: "expired", passEndedAt: at(-DAY) },
  ],
  [
    "an expired pass for another Exam: locked, not expired",
    { passes: [{ examCode: "ME", endsAt: at(-DAY) }] },
    { outcome: "locked" },
  ],
  [
    "removed Staff with no pass, treated as a Member",
    { activeStaff: false },
    { outcome: "locked" },
  ],
  [
    "removed Staff with an expired pass, treated as a Member",
    { activeStaff: false, ...expiredCe },
    { outcome: "expired", passEndedAt: at(-DAY) },
  ],

  // A pass ending today: allowed up to its end, expired from the instant it ends.
  [
    "a pass ending later today, just before its end",
    { passes: [{ examCode: "CE", endsAt: at(1) }] },
    allowed("pass"),
  ],
  [
    "a pass ending exactly now",
    { passes: [{ examCode: "CE", endsAt: at(0) }] },
    { outcome: "expired", passEndedAt: at(0) },
  ],
  [
    "a pass that ended a moment ago",
    { passes: [{ examCode: "CE", endsAt: at(-1) }] },
    { outcome: "expired", passEndedAt: at(-1) },
  ],

  // 3. Unavailable: Hidden decks and quizzes, Reviewer PDFs not Published.
  [
    "Hidden content for a Member with an active pass",
    { ...content({ available: false }), ...activeCe },
    { outcome: "unavailable" },
  ],
  [
    "Hidden content for active Staff",
    { ...content({ available: false }), activeStaff: true },
    { outcome: "unavailable" },
  ],
  [
    "Hidden Free Preview content",
    content({ available: false, freePreview: true }),
    { outcome: "unavailable" },
  ],

  // 2. The Active Device, before the content.
  [
    "no device token",
    { device: "no-token", ...content({ freePreview: true }) },
    { outcome: "no-token" },
  ],
  ["a replaced device", { device: "replaced", ...activeCe }, { outcome: "device-replaced" }],
  [
    "a replaced device, for active Staff",
    { device: "replaced", activeStaff: true },
    { outcome: "device-replaced" },
  ],
  [
    "no device token for Hidden content",
    { device: "no-token", ...content({ available: false }) },
    { outcome: "no-token" },
  ],

  // 1. The gate, before everything.
  ["the gate closed for a non-tester", { gate: "not-open-yet" }, { outcome: "not-open-yet" }],
  [
    "the gate closed, even for Free Preview",
    { gate: "not-open-yet", ...content({ freePreview: true }) },
    { outcome: "not-open-yet" },
  ],
  [
    "the gate closed, before a replaced device",
    { gate: "not-open-yet", device: "replaced" },
    { outcome: "not-open-yet" },
  ],
  [
    "the gate closed, before Hidden content",
    { gate: "not-open-yet", ...content({ available: false }) },
    { outcome: "not-open-yet" },
  ],
];

function allowed(via: AllowedVia): AccessDecision {
  return { outcome: "allowed", via };
}

// A Lesson (Phase 5, ticket 03; spec, Access decision seam as amended on
// 2026-11-28; Testing Decisions → Phase 5 seams → Access decision): its
// Course's facts join the rule. An included Course's Lessons open with an
// active pass for its Exam; a separately sold Course's only with Course
// Ownership, never a pass; a Hidden Course stays open to its owners only;
// an Unpublished Lesson is unavailable to everyone.
const included = { visible: true, soldSeparately: false, owned: false };
const soldSeparately = { visible: true, soldSeparately: true, owned: false };
const lesson = (
  course: AccessCourse,
  change: Partial<Omit<AccessInputs["content"], "course">> = {},
) => content({ ...change, course });

const LESSON_ROWS: Row[] = [
  // An included Course: like any content of its Exam.
  [
    "an included Course's Lesson with an active pass",
    { ...lesson(included), ...activeCe },
    allowed("pass"),
  ],
  ["an included Course's Lesson with no pass", lesson(included), { outcome: "locked" }],
  [
    "an included Course's Lesson with a pass for another Exam",
    { ...lesson(included), passes: [{ examCode: "ME", endsAt: at(30 * DAY) }] },
    { outcome: "locked" },
  ],
  [
    "an included Course's Lesson with an ended pass: expired, progress kept",
    { ...lesson(included), ...expiredCe },
    { outcome: "expired", passEndedAt: at(-DAY) },
  ],
  [
    "an included Course's Free Preview Lesson with no pass",
    lesson(included, { freePreview: true }),
    allowed("free-preview"),
  ],

  // A separately sold Course: only Course Ownership opens it.
  [
    "a separately sold Course's Lesson with an active pass but no Ownership",
    { ...lesson(soldSeparately), ...activeCe },
    { outcome: "locked" },
  ],
  [
    "a separately sold Course's Lesson with an ended pass: locked, never expired",
    { ...lesson(soldSeparately), ...expiredCe },
    { outcome: "locked" },
  ],
  [
    "a separately sold Course's Lesson with Ownership and no pass",
    lesson({ ...soldSeparately, owned: true }),
    allowed("ownership"),
  ],
  [
    "a separately sold Course's Free Preview Lesson with no Ownership",
    { ...lesson(soldSeparately, { freePreview: true }), ...activeCe },
    allowed("free-preview"),
  ],
  [
    "a separately sold Course's Lesson for active Staff",
    { ...lesson(soldSeparately), activeStaff: true },
    allowed("staff"),
  ],
  [
    "an included Course its owner owns (switched back from Sold separately): still theirs",
    lesson({ ...included, owned: true }),
    allowed("ownership"),
  ],

  // Hidden Courses and Unpublished Lessons.
  [
    "a Hidden Course's Lesson for its owner",
    lesson({ ...soldSeparately, visible: false, owned: true }),
    allowed("ownership"),
  ],
  [
    "a Hidden Course's Lesson for a non-owner with an active pass",
    { ...lesson({ ...included, visible: false }), ...activeCe },
    { outcome: "unavailable" },
  ],
  [
    "a Hidden Course's Free Preview Lesson for a non-owner",
    lesson({ ...soldSeparately, visible: false }, { freePreview: true }),
    { outcome: "unavailable" },
  ],
  [
    "a Hidden Course's Lesson for active Staff who don't own it",
    { ...lesson({ ...included, visible: false }), activeStaff: true },
    { outcome: "unavailable" },
  ],
  [
    "an Unpublished Lesson for the Course's owner",
    lesson({ ...soldSeparately, owned: true }, { available: false }),
    { outcome: "unavailable" },
  ],
  [
    "an Unpublished Lesson in a Hidden Course for its owner",
    lesson({ ...soldSeparately, visible: false, owned: true }, { available: false }),
    { outcome: "unavailable" },
  ],

  // The gate and the Active Device first, as for all content.
  [
    "an owned Lesson on a replaced device",
    { ...lesson({ ...soldSeparately, owned: true }), device: "replaced" },
    { outcome: "device-replaced" },
  ],
  [
    "a Free Preview Lesson with no device token",
    { ...lesson(included, { freePreview: true }), device: "no-token" },
    { outcome: "no-token" },
  ],
  [
    "an owned Lesson with the gate closed",
    { ...lesson({ ...soldSeparately, owned: true }), gate: "not-open-yet" },
    { outcome: "not-open-yet" },
  ],
];

describe("accessDecision", () => {
  it.each(ROWS)("%s", (_name, change, expected) => {
    expect(accessDecision({ ...BASE, ...change })).toEqual(expected);
  });

  it.each(LESSON_ROWS)("%s", (_name, change, expected) => {
    expect(accessDecision({ ...BASE, ...change })).toEqual(expected);
  });

  it("decides a pass ending at Manila midnight by the instant, not the calendar day", () => {
    // 2026-11-17T16:00Z is 00:00 on 18 Nov in Manila.
    const passes = [{ examCode: "CE", endsAt: "2026-11-17T16:00:00.000Z" }];
    const lastSecond = new Date("2026-11-17T15:59:59.000Z");
    const nextDay = new Date("2026-11-17T16:00:01.000Z");

    expect(accessDecision({ ...BASE, passes, now: lastSecond })).toEqual(allowed("pass"));
    expect(accessDecision({ ...BASE, passes, now: nextDay })).toEqual({
      outcome: "expired",
      passEndedAt: "2026-11-17T16:00:00.000Z",
    });
  });

  it("matches the content's Exam by code, whatever its case", () => {
    const passes = [{ examCode: "ce", endsAt: at(DAY) }];
    expect(accessDecision({ ...BASE, passes })).toEqual(allowed("pass"));
  });
});

describe("passEndDate", () => {
  it("shows a pass's end as its calendar date in Manila", () => {
    expect(passEndDate("2026-11-17T15:59:59.000Z")).toBe("17 Nov 2026");
    expect(passEndDate("2026-11-17T16:00:00.000Z")).toBe("18 Nov 2026");
  });

  it("refuses a time that isn't one", () => {
    expect(() => passEndDate("soon")).toThrow(RangeError);
  });
});

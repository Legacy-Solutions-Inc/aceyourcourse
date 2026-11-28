import { videoLength } from "@/lib/courses/course-rules";
import { manilaDate, manilaDayStart } from "@/lib/manila-time";
import type { LessonResume } from "@/lib/member-app/progress";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import { formatPeso } from "@/lib/money";
import { paths } from "@/paths";
import type {
  CourseShelf,
  MemberCourse,
  MemberLesson,
  MemberModule,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Courses screen's view (Phase 5, ticket 03; spec, Phase 5 planning
// decisions → The Courses screen; mockup `courses` and `player`): pure, from
// the Member seam's shelf and each Course's access decision. A card's state
// comes from the decision on the Course's Lessons that aren't Free Preview,
// and how Members get the Course:
//
//   | State                                   | Tag          | Button                       |
//   | Owned                                   | OWNED        | Start course                 |
//   | Included, active Access Pass            | IN YOUR PLAN | Start course                 |
//   | Included, no Access Pass                | LOCKED       | See plans                    |
//   | Included, Access Pass ended             | LOCKED       | Renew access (progress kept) |
//   | Sold separately, not owned, on sale     | LOCKED       | Unlock for ₱1,499            |
//   | Sold separately, not owned, not on sale | LOCKED       | Not on sale right now        |
//
// Active Staff, who open everything Published, see STAFF ACCESS. An open
// Course the Member has watched shows "Continue: {Lesson} →" in place of
// "Start course" (ticket 04), and every card the Member can open, or has
// progress in, shows its Lessons done: "9 / 32".
// ─────────────────────────────────────────────────────────────────────────────

export type CourseCardState =
  "owned" | "in-plan" | "staff" | "see-plans" | "renew" | "unlock" | "not-on-sale";

/** Pure: a Course card's state, from its access decision and how Members get it. */
export function courseCardState(
  course: Pick<MemberCourse, "access" | "onSale" | "priceCentavos" | "owned" | "decision">,
): CourseCardState {
  const { decision } = course;
  if (decision.outcome === "allowed") {
    // A Course they own reads OWNED, whatever else would open it too.
    if (course.owned || decision.via === "ownership") return "owned";
    if (decision.via === "staff") return "staff";
    if (decision.via === "pass") return "in-plan";
  }
  if (decision.outcome === "expired") return "renew";
  if (course.access === "included") return "see-plans";
  return course.onSale && course.priceCentavos !== null ? "unlock" : "not-on-sale";
}

/** Pure: whether the Member can watch the Course's full Lessons (else its card shows locked). */
const isOpenState = (state: CourseCardState) =>
  state === "owned" || state === "in-plan" || state === "staff";

const TAGS: Record<CourseCardState, string> = {
  owned: "OWNED",
  "in-plan": "IN YOUR PLAN",
  staff: "STAFF ACCESS",
  "see-plans": "LOCKED",
  renew: "LOCKED",
  unlock: "LOCKED",
  "not-on-sale": "LOCKED",
};

export interface CourseCardView {
  id: string;
  title: string;
  /** The Course's page: its Lesson list opens even while it's locked. */
  href: string;
  subjectCode: string;
  coverSrc: string | null;
  /** "3 MODULES · 32 LESSONS". */
  meta: string;
  state: CourseCardState;
  tag: string;
  locked: boolean;
  /** The button, or plain text when there's nowhere to go ("Not on sale right now"). */
  action: { label: string; href: string | null };
  /** The Lessons done, "9 / 32": on a Course the Member can open, or one with progress kept. */
  progress: string | null;
  /** A line under the button: "PROGRESS KEPT" once access ended. */
  note: string | null;
  /** A locked Course's Free Preview Lessons: "2 FREE LESSONS · Watch free". */
  free: { label: string; href: string } | null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Pure: "3 MODULES · 32 LESSONS". */
export const countsLabel = (modules: number, lessons: number) =>
  `${plural(modules, "MODULE", "MODULES")} · ${plural(lessons, "LESSON", "LESSONS")}`;

/** Pure: whether a card's way in is the Exam's All-Access ("See plans", "Renew access"), not the Course's own price. */
export const leadsToPlans = (state: CourseCardState) => state === "see-plans" || state === "renew";

/** Pure: where a lock's "See plans" or "Renew access" goes: the Exam's Plans, or the contact note. */
const plansHref = (unlock: UnlockRoute) => (unlock.kind === "plans" ? unlock.href : "#unlock");

/** Pure: one Course's card, for the Exam's way to unlock it. */
export function courseCard(course: MemberCourse, unlock: UnlockRoute): CourseCardView {
  const state = courseCardState(course);
  const page = paths.memberApp.course(course.id);
  const lessonHref = (lessonId: string) => paths.memberApp.lesson(course.id, lessonId);
  const action: CourseCardView["action"] = (() => {
    switch (state) {
      case "owned":
      case "in-plan":
      case "staff":
        return course.continueLesson
          ? {
              label: `Continue: ${course.continueLesson.title} →`,
              href: lessonHref(course.continueLesson.id),
            }
          : {
              label: "Start course",
              href: course.firstLessonId ? lessonHref(course.firstLessonId) : page,
            };
      case "see-plans":
        return { label: "See plans", href: plansHref(unlock) };
      case "renew":
        return { label: "Renew access", href: plansHref(unlock) };
      case "unlock":
        // Ticket 06 points it at the Course on the Plans page.
        return {
          label: `Unlock for ${formatPeso(course.priceCentavos ?? 0)}`,
          href: paths.memberApp.plansFor(course.examCode),
        };
      case "not-on-sale":
        return { label: "Not on sale right now", href: null };
    }
  })();
  const locked = !isOpenState(state);
  return {
    id: course.id,
    title: course.title,
    href: page,
    subjectCode: course.subjectCode,
    coverSrc: course.coverSrc,
    meta: countsLabel(course.modules, course.lessons),
    state,
    tag: TAGS[state],
    locked,
    action,
    progress:
      !locked || course.lessonsDone > 0 ? `${course.lessonsDone} / ${course.lessons}` : null,
    note: state === "renew" ? "PROGRESS KEPT" : null,
    free:
      locked && course.firstFreeLessonId
        ? {
            label: plural(course.freePreviewLessons, "FREE LESSON", "FREE LESSONS"),
            href: lessonHref(course.firstFreeLessonId),
          }
        : null,
  };
}

export interface CourseGroup {
  subject: { code: string; name: string };
  cards: CourseCardView[];
}

/** Pure: the shelf's cards grouped by Subject, in the Exam's Subject order; empty Subjects are left out. */
export function courseGroups(shelf: CourseShelf, unlock: UnlockRoute): CourseGroup[] {
  return shelf.subjects.flatMap((subject) => {
    const cards = shelf.courses
      .filter((course) => course.subjectCode === subject.code)
      .map((course) => courseCard(course, unlock));
    return cards.length > 0 ? [{ subject, cards }] : [];
  });
}

/** Pure: what the Courses screen says for an Exam with no Courses to show. */
export const emptyShelfMessage = (examCode: string) =>
  `Courses for ${examCode} are on the way. Your flashcards, quizzes and Reviewer PDFs are ready now.`;

/** Pure: the Lesson screen's crumb, "PSAD MASTERCLASS · MODULE 2 · LESSON 3". */
export const lessonCrumb = (courseTitle: string, moduleNumber: number, lessonNumber: number) =>
  `${courseTitle.toUpperCase()} · MODULE ${moduleNumber} · LESSON ${lessonNumber}`;

/** Pure: the Lessons before and after one, across Modules, in the outline's order. */
export function lessonNeighbours(
  outline: readonly MemberModule[],
  lessonId: string,
): { previous: MemberLesson | null; next: MemberLesson | null } {
  const lessons = outline.flatMap((module) => module.lessons);
  const at = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (at < 0) return { previous: null, next: null };
  return { previous: lessons[at - 1] ?? null, next: lessons[at + 1] ?? null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: how many Manila calendar days before `now` an instant was: 0 for today. */
function manilaDaysAgo(iso: string, now: Date): number {
  const then = manilaDayStart(manilaDate(new Date(iso))).getTime();
  const today = manilaDayStart(manilaDate(now)).getTime();
  return Math.max(0, Math.round((today - then) / DAY_MS));
}

/**
 * Pure: the note under a Lesson's video (mockup `player`): "You stopped here
 * 2 days ago. The video picks up at 12:40."; "You finished this lesson.
 * Watch it again anytime."; or "Starts from the beginning."
 */
export function resumeNote(resume: LessonResume, now: Date): string {
  if (resume.state === "finished") return "You finished this lesson. Watch it again anytime.";
  if (resume.state === "start") return "Starts from the beginning.";
  const days = manilaDaysAgo(resume.savedAt, now);
  const when = days === 0 ? "earlier today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `You stopped here ${when}. The video picks up at ${videoLength(resume.from)}.`;
}

/** Pure: the Lesson screen's "Mark complete" button: on to the next Lesson, or done with the Course. */
export const completeLabel = (hasNext: boolean) =>
  hasNext ? "Mark complete · next lesson →" : "Mark complete · finish course";

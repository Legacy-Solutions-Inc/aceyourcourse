"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction } from "@/lib/admin/action";
import { refusalText, UNREACHABLE } from "@/lib/admin/users-refusal";
import { passEndDate as manilaDay } from "@/lib/member-app/access";
import { cn } from "@/lib/utils";
import type { CourseOwnershipChange } from "@/services/admin.types";
import type { OwnedCourse } from "@/services/member.types";

/** A Course sold separately, as "Give Course" offers it (One-time purchases). */
export interface CourseToGive {
  id: string;
  title: string;
  examCode: string;
}

/** The Server Actions the panel calls: give and remove a Member's Course. */
export interface CourseActions {
  give: AdminAction<CourseOwnershipChange>;
  remove: AdminAction<CourseOwnershipChange>;
}

interface MemberCoursesProps {
  member: { userId: string; name: string | null; email: string };
  /** The Courses the Member owns, oldest first, each with its source. */
  courses: OwnedCourse[];
  /** Every Course sold separately (One-time purchases): the ones they don't own can be given. */
  soldSeparately: CourseToGive[];
  actions: CourseActions;
}

type Open = { action: "give" } | { action: "remove"; course: OwnedCourse } | null;
type Notice = { tone: "done" | "refused"; text: string };

const label = "font-mono text-[11px] font-bold tracking-[0.06em]";
const smallButton =
  "min-h-9 cursor-pointer border-[1.5px] bg-transparent px-3 text-[13px] font-bold hover:bg-ayc-sand disabled:cursor-not-allowed disabled:opacity-60";
const NO_PAYMENT =
  "No payment is collected. They get an in-app notice the next time they open the Member App.";

/** Pure: a Course's source, as its row says it: the Order's reference, or given by Ace Your Course. */
const sourceOf = ({ orderReference }: OwnedCourse) => orderReference ?? "GIVEN BY ACE YOUR COURSE";

/**
 * COURSES on a Member's detail page (Phase 5, ticket 07; story 172): each
 * Course they own, since when (Manila) and its source, "Remove…" on a given
 * one only (a paid one goes by a full refund in PayMongo), then "Give
 * Course…" with the separately sold Courses they don't own. The server
 * decides everything (Owners only, which Courses, who owns what); this panel
 * only shows what it read and answered, then reads the page again. The
 * Member gets an in-app notice, never an email.
 */
export function MemberCourses({ member, courses, soldSeparately, actions }: MemberCoursesProps) {
  const { pending, run } = useStaffAction();
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [courseError, setCourseError] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);
  const owned = new Set(courses.map(({ courseId }) => courseId));
  const toGive = soldSeparately.filter(({ id }) => !owned.has(id));
  const [giving, setGiving] = useState(toGive[0]?.id ?? "");
  const heading = useRef<HTMLHeadingElement>(null);
  const answered = useRef(false);
  const selectId = useId();
  const firstName = member.name?.trim().split(/\s+/)[0] ?? member.email;

  function start(next: NonNullable<Open>) {
    setNotice(null);
    setCourseError(undefined);
    setFailed(false);
    if (next.action === "give") setGiving(toGive[0]?.id ?? "");
    setOpen(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!open || pending) return;
    const action = open.action;
    const courseId = open.action === "give" ? giving : open.course.courseId;
    setCourseError(undefined);
    setFailed(false);
    run(actions[action], { userId: member.userId, courseId }, (state) => {
      if (state.status === "failed") {
        setFailed(true);
        return;
      }
      if (state.status === "refused") {
        const field = state.error.kind === "invalid" ? state.error.fieldErrors.courseId?.[0] : null;
        if (field) {
          setCourseError(field);
          return;
        }
        setNotice({ tone: "refused", text: refusalText(state.error) });
      } else if (state.status === "saved") {
        const title = state.value.course.toUpperCase();
        setNotice({
          tone: "done",
          text:
            action === "give"
              ? `✓ GAVE THE ${title} · NO PAYMENT COLLECTED`
              : `✓ REMOVED THE ${title}`,
        });
      }
      answered.current = true;
      setOpen(null);
    });
  }

  const removing = open?.action === "remove" ? open.course : null;

  return (
    <section aria-labelledby="member-courses" className="flex min-w-0 flex-col gap-2">
      <h2 ref={heading} tabIndex={-1} id="member-courses" className={label}>
        COURSES
      </h2>
      <div className="border-[1.5px] bg-ayc-paper">
        {courses.length > 0 ? (
          <ul>
            {courses.map((course) => (
              <li
                key={course.courseId}
                aria-label={course.title}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-ayc-ruled px-3.5 py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold">{course.title}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {course.examCode} · SINCE {manilaDay(course.since).toUpperCase()} ·{" "}
                    {sourceOf(course)}
                  </span>
                </span>
                {course.orderReference === null ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start({ action: "remove", course })}
                    className={cn(smallButton, "border-destructive text-destructive")}
                  >
                    Remove…<span className="sr-only"> {course.title}</span>
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Paid · a full refund in PayMongo removes it
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3.5 py-3 text-sm text-muted-foreground">
            No Courses. Courses they buy or are given show here.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-ayc-rule px-3.5 py-2.5">
          <button
            type="button"
            disabled={pending || toGive.length === 0}
            onClick={() => start({ action: "give" })}
            className={smallButton}
          >
            Give Course…
          </button>
          <span className="text-xs text-muted-foreground">{NO_PAYMENT}</span>
        </div>
        {/* On paper, where the success green passes 4.5:1 (it doesn't on cream). */}
        <p
          role="status"
          className={cn(
            "px-3.5 pb-2.5 empty:pb-0",
            notice?.tone === "refused"
              ? "text-sm font-semibold text-destructive"
              : "font-mono text-[11px] font-medium text-ayc-success",
          )}
        >
          {notice?.text ?? ""}
        </p>
      </div>

      <AdminDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        tag={removing ? "REMOVE COURSE" : "GIVE COURSE"}
        tone={removing ? "danger" : "info"}
        title={
          removing
            ? `Remove the ${removing.title} from ${firstName}?`
            : `Give ${firstName} a Course`
        }
        description={
          removing
            ? "They lose it straight away and get an in-app notice. Their Lesson progress stays."
            : `It’s theirs for good, given by Ace Your Course, and its Exam joins their Target Exams. ${NO_PAYMENT}`
        }
        onCloseAutoFocus={(event) => {
          if (!answered.current) return;
          // Answered, the button may be gone with the row, so focus goes to the heading.
          answered.current = false;
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          {open?.action === "give" ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor={selectId}
                className="font-mono text-xs font-medium text-muted-foreground"
              >
                COURSE
              </label>
              <select
                id={selectId}
                name="courseId"
                value={giving}
                aria-invalid={courseError ? true : undefined}
                aria-describedby={courseError ? `${selectId}-error` : undefined}
                onChange={(event) => setGiving(event.target.value)}
                className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 font-mono text-[13px] text-foreground aria-invalid:border-destructive"
              >
                {toGive.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} · {course.examCode}
                  </option>
                ))}
              </select>
              {courseError ? (
                <p
                  id={`${selectId}-error`}
                  className="font-mono text-[11px] font-medium text-destructive"
                >
                  {courseError}
                </p>
              ) : null}
            </div>
          ) : null}
          {failed ? (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {UNREACHABLE}
            </p>
          ) : null}
          <AdminDialogButtons>
            <AdminDialogButton onClick={() => setOpen(null)}>Cancel</AdminDialogButton>
            <AdminDialogButton
              type="submit"
              variant={removing ? "danger" : "primary"}
              disabled={pending}
            >
              {pending
                ? removing
                  ? "Removing…"
                  : "Giving…"
                : removing
                  ? "Remove Course"
                  : "Give Course"}
            </AdminDialogButton>
          </AdminDialogButtons>
        </form>
      </AdminDialog>
    </section>
  );
}

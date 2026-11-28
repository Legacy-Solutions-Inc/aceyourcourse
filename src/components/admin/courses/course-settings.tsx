"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminSwitch } from "@/components/admin/admin-switch";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { photoState } from "@/lib/admin/photo-rules";
import { formatPeso } from "@/lib/money";
import {
  accessSwitchText,
  DELETE_BLOCKED,
  howMembersGetIt,
  NEEDS_PUBLISHED_LESSON,
} from "@/lib/courses/course-rules";
import { paths } from "@/paths";
import type {
  AdminCourse,
  AdminCourseSummary,
  AdminError,
  CourseExamChoice,
  StaffRole,
} from "@/services/admin.types";
import type { ContentVisibility } from "@/services/content.types";
import type { Course } from "@/services/courses.types";
import type { UploadTicket } from "@/services/uploads.types";

import { CoverField } from "./cover-field";
import {
  conflictOf,
  fieldErrorsOf,
  LABEL,
  PLAIN_BUTTON,
  PRIMARY_BUTTON,
  refusalText,
  TEXT_BUTTON,
} from "./course-ui";

export interface CourseSettingsActions {
  createCourseCoverUpload: AdminAction<UploadTicket>;
  addCourse: AdminAction<AdminCourseSummary>;
  saveCourse: AdminAction<AdminCourseSummary>;
  saveCourseVisibility: AdminAction<{ visibility: ContentVisibility }>;
  removeCourse: AdminAction<Course>;
  /** "How members get it", an Owner's alone (Phase 5, ticket 06). */
  saveCourseAccess: AdminAction<Course>;
}

interface CourseSettingsProps {
  /** The Course being edited, or null for "+ New course". */
  opened: AdminCourse | null;
  exams: CourseExamChoice[];
  actions: CourseSettingsActions;
  /** The signed-in Staff member's role: only an Owner switches how Members get it. */
  role: StaffRole;
}

const WAIT_FOR_COVER = "WAIT FOR THE COVER TO FINISH UPLOADING";
const COVER_FAILED = "THE COVER’S UPLOAD FAILED · CHOOSE IT AGAIN, OR REMOVE IT";

/** Pure: what "How members get it" explains under the choice (BUILD-MAP §3.7). */
const accessNote = (access: Course["access"]) =>
  access === "included"
    ? "Members with an active plan can watch every lesson."
    : "A one-time purchase with no expiry.";

/**
 * Course settings (Phase 5, ticket 01; BUILD-MAP §3.7): the title,
 * description, 16:9 cover, the Exam and one of its Subjects, picked from the
 * list. "How members get it": an Owner switches an open Course between
 * Included and Sold separately, after a confirmation saying how many Members
 * it affects (ticket 06); Editors see it read-only. A separately sold
 * Course's price shows read-only, with a link to Plans & prices, where it's
 * set. An open Course also has "Course visible to members", refused without
 * a Published Lesson, and Delete course, which explains why it can't while
 * anyone owns the Course or an Order names it. The server enforces every
 * rule; this only shows what it answered.
 */
export function CourseSettings({ opened, exams, actions, role }: CourseSettingsProps) {
  const router = useRouter();
  const course = opened?.course ?? null;
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [exam, setExam] = useState(course?.examCode ?? exams[0]?.code ?? "");
  const [subject, setSubject] = useState(course?.subjectCode ?? "");
  const [cover, setCover] = useState(course?.coverSrc ?? "");
  const [answer, setAnswer] = useState<AdminActionState<unknown>>({ status: "idle" });
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const descriptionId = useId();
  const examId = useId();
  const subjectId = useId();

  const subjects = exams.find((candidate) => candidate.code === exam)?.subjects ?? [];
  const errors = fieldErrorsOf(answer);
  const conflict = conflictOf(answer);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const coverState = photoState(cover);
    if (coverState !== "ready") {
      setBlocked(coverState === "pending" ? WAIT_FOR_COVER : COVER_FAILED);
      return;
    }
    setBlocked(null);
    const settings = { title, description, exam, subject, cover: cover === "" ? null : cover };
    startTransition(async () => {
      const state = opened
        ? await callAdminAction(actions.saveCourse, {
            input: { ...settings, id: opened.course.id },
            expected: { savedAt: opened.stamp.savedAt },
          })
        : await callAdminAction(actions.addCourse, { input: settings });
      setAnswer(state);
      if (state.status !== "saved") return;
      toast(`✓ ${opened ? "SAVED" : "ADDED"} · ${state.value.title.toUpperCase()}`);
      router.push(paths.admin.course(state.value.id));
      router.refresh();
    });
  }

  const line =
    blocked ??
    (answer.status === "saved" ? "" : refusalText(answer, "FIX THE FIELDS MARKED IN RED"));

  return (
    <section
      aria-labelledby="course-settings"
      className="flex max-w-3xl min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5"
    >
      {opened ? (
        <Link href={paths.admin.course(opened.course.id)} className={`${TEXT_BUTTON} w-fit`}>
          ← {opened.course.title}
        </Link>
      ) : null}
      <h2
        id="course-settings"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        {opened ? "COURSE SETTINGS" : "NEW COURSE"}
      </h2>

      <form noValidate onSubmit={save} className="flex flex-col gap-3.5">
        <AdminTextField
          label="COURSE TITLE"
          name="title"
          value={title}
          error={errors.title}
          placeholder="e.g. PSAD Masterclass"
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={descriptionId} className={LABEL}>
            DESCRIPTION
          </label>
          <textarea
            id={descriptionId}
            name="description"
            rows={3}
            value={description}
            aria-invalid={errors.description ? true : undefined}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 text-[13px] aria-invalid:border-destructive"
          />
          {errors.description ? (
            <p className="font-mono text-[11px] font-medium text-destructive">
              {errors.description}
            </p>
          ) : null}
        </div>
        <CoverField
          value={cover}
          onChange={(next) => setCover(next)}
          createUpload={actions.createCourseCoverUpload}
          courseId={opened?.course.id ?? null}
          subject={subject || "—"}
          error={errors.cover}
        />
        <div className="flex flex-wrap gap-3.5">
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <label htmlFor={examId} className={LABEL}>
              EXAM
            </label>
            <select
              id={examId}
              name="exam"
              value={exam}
              aria-invalid={errors.exam ? true : undefined}
              onChange={(event) => {
                setExam(event.target.value);
                // A Subject belongs to its Exam: pick again from the new Exam's.
                setSubject("");
              }}
              className="min-h-10 border-[1.5px] bg-white px-2 font-mono text-[13px] aria-invalid:border-destructive"
            >
              {exams.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.code} · {choice.name}
                </option>
              ))}
            </select>
            {errors.exam ? (
              <p className="font-mono text-[11px] font-medium text-destructive">{errors.exam}</p>
            ) : null}
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <label htmlFor={subjectId} className={LABEL}>
              SUBJECT
            </label>
            <select
              id={subjectId}
              name="subject"
              value={subject}
              aria-invalid={errors.subject ? true : undefined}
              onChange={(event) => setSubject(event.target.value)}
              className="min-h-10 border-[1.5px] bg-white px-2 font-mono text-[13px] aria-invalid:border-destructive"
            >
              <option value="">Pick a subject</option>
              {subjects.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.code} · {choice.name}
                </option>
              ))}
            </select>
            {errors.subject ? (
              <p className="font-mono text-[11px] font-medium text-destructive">{errors.subject}</p>
            ) : null}
          </div>
        </div>

        <HowMembersGetIt
          course={course}
          exam={exam}
          switching={
            opened && role === "owner"
              ? { opened, action: actions.saveCourseAccess, onSwitched: () => router.refresh() }
              : null
          }
        />

        <div className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5">
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {pending ? "Saving…" : opened ? "Save settings" : "Add course"}
          </button>
          {line ? (
            <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
              {line}
            </p>
          ) : null}
        </div>
      </form>
      {conflict ? <ConflictNotice {...conflict} what="these settings" /> : null}

      {opened ? (
        <>
          <CourseVisibility opened={opened} action={actions.saveCourseVisibility} />
          <div className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5">
            {opened.deleteBlocked ? (
              <>
                <button
                  type="button"
                  disabled
                  aria-describedby="course-delete-blocked"
                  className={`${PLAIN_BUTTON} text-destructive disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  Delete course
                </button>
                <p
                  id="course-delete-blocked"
                  className="max-w-prose text-[13px] text-muted-foreground"
                >
                  {DELETE_BLOCKED[opened.deleteBlocked]}
                </p>
              </>
            ) : (
              <ConfirmDelete
                label="Delete course"
                buttonClassName={`${PLAIN_BUTTON} text-destructive`}
                tag="DELETE COURSE"
                title={`Delete “${opened.course.title}”?`}
                description={deleteDescription(opened)}
                confirmLabel="Delete course"
                send={() =>
                  callAdminAction(actions.removeCourse, { input: { id: opened.course.id } })
                }
                onDeleted={() => {
                  toast(`✓ DELETED · ${opened.course.title.toUpperCase()}`);
                  router.push(paths.admin.courses);
                  router.refresh();
                }}
              />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Pure: what deleting a Course takes with it. */
function deleteDescription({ modules }: AdminCourse): string {
  const lessons = modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `Its ${count(modules.length, "module", "modules")} and ${count(lessons, "lesson", "lessons")} are deleted too. This can’t be undone.`;
}

/** An Owner's way to switch how Members get an open Course (ticket 06). */
interface AccessSwitching {
  opened: AdminCourse;
  action: AdminAction<Course>;
  onSwitched: () => void;
}

/**
 * "How members get it": read-only for an Editor and a new Course (it starts
 * Included); an Owner picks the other choice and confirms it, the
 * confirmation saying how many Members it affects. A separately sold Course
 * shows the Owner its price, set in Plans & prices (Owners only).
 */
function HowMembersGetIt({
  course,
  exam,
  switching,
}: {
  course: Course | null;
  exam: string;
  switching: AccessSwitching | null;
}) {
  // A new Course starts Included in its Exam's All-Access.
  const access = course ?? { access: "included" as const, priceCentavos: null };
  return (
    <div className="flex flex-col gap-1.5 border-[1.5px] bg-white px-3 py-2.5">
      <p className={LABEL}>HOW MEMBERS GET IT</p>
      {switching ? (
        <AccessChoice switching={switching} />
      ) : (
        <p className="text-sm font-bold">{howMembersGetIt(access, exam)}</p>
      )}
      <p className="text-[13px] text-muted-foreground">{accessNote(access.access)}</p>
      {switching && access.access === "sold-separately" ? (
        <p className="text-[13px]">
          {access.priceCentavos === null ? "No price yet" : formatPeso(access.priceCentavos)} ·{" "}
          <Link href={paths.admin.plans} className="font-bold text-ayc-blue underline">
            Set the price in Plans &amp; prices
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Pure: what a refused switch says. */
function accessRefusal(state: AdminActionState<unknown>): string {
  if (state.status === "failed") return "NOT SWITCHED · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return "";
  const { error } = state;
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "invalid" && error.formError) return error.formError;
  if (error.kind === "not-found") return "THAT COURSE IS GONE · RELOAD THE PAGE";
  return "NOT SWITCHED · RELOAD THE PAGE AND TRY AGAIN";
}

/** The Owner's two choices, and the confirmation before a switch. */
function AccessChoice({ switching }: { switching: AccessSwitching }) {
  const { opened, action, onSwitched } = switching;
  const { course } = opened;
  const [asked, setAsked] = useState<Course["access"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choices = [
    {
      value: "included",
      label: howMembersGetIt({ access: "included", priceCentavos: null }, course.examCode),
    },
    { value: "sold-separately", label: "Sold separately" },
  ] as const;

  function confirm(to: Course["access"]) {
    setError(null);
    startTransition(async () => {
      const state = await callAdminAction(action, { input: { id: course.id, access: to } });
      if (state.status !== "saved") {
        setError(accessRefusal(state));
        return;
      }
      setAsked(null);
      toast(to === "included" ? "✓ INCLUDED IN ALL-ACCESS" : "✓ SOLD SEPARATELY");
      onSwitched();
    });
  }

  return (
    <>
      <div role="radiogroup" aria-label="How members get it" className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold"
          >
            <input
              type="radio"
              name="access"
              value={choice.value}
              checked={course.access === choice.value}
              onChange={() => {
                setError(null);
                setAsked(choice.value);
              }}
              className="size-4 accent-ayc-navy"
            />
            {choice.label}
          </label>
        ))}
      </div>
      <AdminDialog
        open={asked !== null}
        onOpenChange={(open) => {
          if (!open) setAsked(null);
        }}
        tag="HOW MEMBERS GET IT"
        tone="warning"
        title={
          asked === "sold-separately"
            ? `Sell “${course.title}” separately?`
            : `Include “${course.title}” in ${course.examCode} All-Access?`
        }
        description={asked ? accessSwitchText(asked, course.examCode, opened.accessChange) : ""}
      >
        {error ? (
          <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => setAsked(null)}>Cancel</AdminDialogButton>
          <AdminDialogButton
            variant="primary"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => asked && confirm(asked)}
          >
            {asked === "sold-separately" ? "Sell separately" : "Include in All-Access"}
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </>
  );
}

/** Pure: what a refused visibility switch says. */
function visibilityRefusal(error: AdminError): string {
  if (error.kind === "invalid" && error.formError) return error.formError;
  if (error.kind === "not-found") return "That Course is gone. Reload the page.";
  return "The Course’s visibility wasn’t changed. Reload the page and try again.";
}

/** "Course visible to members", a single toggle, refused without a Published Lesson. */
function CourseVisibility({
  opened,
  action,
}: {
  opened: AdminCourse;
  action: AdminAction<{ visibility: ContentVisibility }>;
}) {
  const labelId = useId();
  const visible = opened.course.visibility === "visible";
  const published = opened.modules.some((module) =>
    module.lessons.some((lesson) => lesson.state === "published"),
  );
  const { save, pending } = useInstantSave(action, {
    what: opened.course.title,
    kept: "The switch is back as it was.",
    refused: visibilityRefusal,
    onSaved: ({ visibility }) =>
      toast(visibility === "visible" ? "✓ VISIBLE TO MEMBERS" : "✓ HIDDEN FROM MEMBERS"),
  });
  return (
    <div className="flex flex-col gap-1.5 border-t-[1.5px] pt-3.5">
      <div className="flex items-center gap-2.5">
        <AdminSwitch
          checked={visible}
          disabled={pending}
          aria-labelledby={labelId}
          onCheckedChange={(checked) => save({ course: opened.course.id, visible: checked })}
        />
        <span id={labelId} className="text-sm font-bold">
          Course visible to members
        </span>
      </div>
      {published ? null : (
        <p className="font-mono text-[11px] font-medium text-muted-foreground">
          {NEEDS_PUBLISHED_LESSON}
        </p>
      )}
    </div>
  );
}

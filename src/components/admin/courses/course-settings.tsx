"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { photoState } from "@/lib/admin/photo-rules";
import { howMembersGetIt, NEEDS_PUBLISHED_LESSON } from "@/lib/courses/course-rules";
import { paths } from "@/paths";
import type {
  AdminCourse,
  AdminCourseSummary,
  AdminError,
  CourseExamChoice,
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
}

interface CourseSettingsProps {
  /** The Course being edited, or null for "+ New course". */
  opened: AdminCourse | null;
  exams: CourseExamChoice[];
  actions: CourseSettingsActions;
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
 * list. "How members get it" is shown read-only: nobody changes it here (an
 * Owner will, from ticket 06). An open Course also has "Course visible to
 * members", refused without a Published Lesson, and Delete course. The server
 * enforces every rule; this only shows what it answered.
 */
export function CourseSettings({ opened, exams, actions }: CourseSettingsProps) {
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

        <HowMembersGetIt course={course} exam={exam} />

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

/** "How members get it", read-only: nobody changes it in this ticket. */
function HowMembersGetIt({ course, exam }: { course: Course | null; exam: string }) {
  // A new Course starts Included in its Exam's All-Access.
  const access = course ?? { access: "included" as const, priceCentavos: null };
  return (
    <div className="flex flex-col gap-1 border-[1.5px] bg-white px-3 py-2.5">
      <p className={LABEL}>HOW MEMBERS GET IT</p>
      <p className="text-sm font-bold">{howMembersGetIt(access, exam)}</p>
      <p className="text-[13px] text-muted-foreground">{accessNote(access.access)}</p>
    </div>
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

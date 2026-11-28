"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { MoveButtons } from "@/components/admin/move-buttons";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { courseMeta, lessonStateLabel, moduleDeleteRefusal } from "@/lib/courses/course-rules";
import { paths } from "@/paths";
import type {
  AdminCourse,
  AdminCourseModule,
  AdminError,
  AdminLesson,
  RecordStamp,
} from "@/services/admin.types";
import type { CourseModule } from "@/services/courses.types";

import {
  conflictOf,
  fieldErrorsOf,
  PLAIN_BUTTON,
  PRIMARY_BUTTON,
  refusalText,
  TAG,
  TEXT_BUTTON,
} from "./course-ui";

export interface CourseBuilderActions {
  addCourseModule: AdminAction<AdminCourseModule>;
  saveCourseModuleTitle: AdminAction<{ id: string; title: string; stamp: RecordStamp }>;
  moveCourseModuleInCourse: AdminAction<string[]>;
  removeCourseModule: AdminAction<CourseModule>;
  addLesson: AdminAction<AdminLesson>;
  moveLessonInModule: AdminAction<string[]>;
  moveLessonToOtherModule: AdminAction<string[]>;
}

interface CourseBuilderProps {
  opened: AdminCourse;
  actions: CourseBuilderActions;
}

/** A title typed, sent with `send`, and the title field's message, or what else the refusal says. */
function useTitleForm(
  send: (title: string) => Promise<AdminActionState<unknown>>,
  onSaved: (title: string) => void,
  initial = "",
) {
  const [title, setTitle] = useState(initial);
  const [error, setError] = useState<string>();
  const [answer, setAnswer] = useState<AdminActionState<unknown>>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    startTransition(async () => {
      const state = await send(title);
      setAnswer(state);
      if (state.status === "saved") {
        onSaved(title);
        setTitle(initial === "" ? "" : title);
      } else if (!conflictOf(state)) {
        setError(fieldErrorsOf(state).title ?? refusalText(state, "CHECK THE TITLE"));
      }
    });
  }

  return { title, setTitle, error, setError, submit, pending, conflict: conflictOf(answer) };
}

/**
 * The Course builder (Phase 5, ticket 01; BUILD-MAP §3.7): the Course's
 * header card, then its Modules in order, each with its title edited in
 * place, ▲▼ and its Lessons; each Lesson with ▲▼ within its Module, its Free
 * Preview tag and state, and "Move to Module…"; then "+ Lesson" and
 * "+ Module". The server enforces every rule and records each change in
 * Staff Activity; this screen only shows what it answered.
 */
export function CourseBuilder({ opened, actions }: CourseBuilderProps) {
  const router = useRouter();
  const { course, modules } = opened;
  const adding = useTitleForm(
    (title) => callAdminAction(actions.addCourseModule, { input: { course: course.id, title } }),
    (title) => {
      toast(`✓ ADDED · ${title.toUpperCase()}`);
      router.refresh();
    },
  );

  return (
    <section aria-labelledby="course-builder" className="flex max-w-3xl min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3.5 border-[1.5px] bg-ayc-paper p-3.5">
        <span className="relative flex aspect-video w-28 flex-none items-center justify-center overflow-hidden border bg-ayc-blue font-mono text-xs font-bold text-white">
          {course.coverSrc ? (
            <Image src={course.coverSrc} alt="" fill unoptimized className="object-cover" />
          ) : (
            course.subjectCode
          )}
        </span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <h2 id="course-builder" className="text-lg font-bold wrap-anywhere">
            {course.title}
          </h2>
          <p className="font-mono text-[11px] font-bold tracking-[0.04em] text-muted-foreground">
            {courseMeta(course, modules)}
          </p>
          <p className="font-mono text-[11px] font-bold tracking-[0.04em]">
            {course.visibility === "visible" ? "VISIBLE" : "HIDDEN"}
          </p>
        </div>
        <Link href={paths.admin.course(course.id, { settings: true })} className={TEXT_BUTTON}>
          Course settings →
        </Link>
      </div>

      {modules.length > 0 ? (
        <ol aria-label="Modules" className="flex flex-col gap-3">
          {modules.map((module, index) => (
            <ModuleCard
              key={`${module.id}:${module.title}`}
              courseId={course.id}
              module={module}
              index={index}
              modules={modules}
              actions={actions}
            />
          ))}
        </ol>
      ) : (
        <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
          Group lessons into modules, like “Reinforced concrete” or “Steel design”.
        </p>
      )}

      <form noValidate onSubmit={adding.submit} className="flex flex-wrap items-start gap-2.5">
        <AdminTextField
          label="NEW MODULE"
          name="title"
          value={adding.title}
          error={adding.error}
          placeholder="e.g. Steel design"
          onChange={(event) => adding.setTitle(event.target.value)}
          className="flex-[1_1_260px]"
        />
        <button type="submit" disabled={adding.pending} className={`${PRIMARY_BUTTON} mt-[22px]`}>
          {adding.pending ? "Saving…" : "+ Module"}
        </button>
      </form>
      <p className="font-mono text-[11px] font-bold tracking-[0.04em] text-muted-foreground">
        MEMBERS RESUME WHERE THEY STOPPED · PROGRESS COUNTS A LESSON AS DONE AT 90% WATCHED
      </p>
    </section>
  );
}

/** One Module: its title (edited in place), ▲▼, Delete when empty, its Lessons and "+ Lesson". */
function ModuleCard({
  courseId,
  module,
  index,
  modules,
  actions,
}: {
  courseId: string;
  module: AdminCourseModule;
  index: number;
  modules: AdminCourseModule[];
  actions: CourseBuilderActions;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const rename = useTitleForm(
    (title) =>
      callAdminAction(actions.saveCourseModuleTitle, {
        input: { id: module.id, title },
        expected: { savedAt: module.stamp.savedAt },
      }),
    (title) => {
      setRenaming(false);
      toast(`✓ RENAMED · ${title.toUpperCase()}`);
      router.refresh();
    },
    module.title,
  );
  const adding = useTitleForm(
    (title) => callAdminAction(actions.addLesson, { input: { module: module.id, title } }),
    (title) => {
      toast(`✓ ADDED · ${title.toUpperCase()}`);
      router.refresh();
    },
  );
  const deleteBlocker = moduleDeleteRefusal(module.lessons.length);
  const count = module.lessons.length;

  return (
    <li
      aria-label={`Module ${index + 1}: ${module.title}`}
      className="flex flex-col gap-2.5 border-[1.5px] bg-ayc-paper p-3.5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-xs font-bold text-ayc-blue">M{index + 1}</span>
        {renaming ? (
          <form
            noValidate
            onSubmit={rename.submit}
            className="flex flex-[1_1_260px] flex-wrap items-start gap-2"
          >
            <AdminTextField
              label="MODULE TITLE"
              name="title"
              value={rename.title}
              error={rename.error}
              onChange={(event) => rename.setTitle(event.target.value)}
              className="flex-[1_1_200px]"
            />
            <button
              type="submit"
              disabled={rename.pending}
              className={`${PRIMARY_BUTTON} mt-[22px]`}
            >
              {rename.pending ? "Saving…" : "Save title"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                rename.setTitle(module.title);
                rename.setError(undefined);
              }}
              className={`${PLAIN_BUTTON} mt-[22px]`}
            >
              Cancel
            </button>
          </form>
        ) : (
          <h3 className="min-w-0 flex-[1_1_180px] text-[15px] font-bold wrap-anywhere uppercase">
            <button
              type="button"
              aria-label={`Rename ${module.title}`}
              onClick={() => setRenaming(true)}
              className="cursor-text text-left uppercase hover:underline"
            >
              {module.title}
            </button>
          </h3>
        )}
        <span className="font-mono text-[11px] font-bold text-muted-foreground">
          {count} {count === 1 ? "LESSON" : "LESSONS"}
        </span>
        <MoveButtons
          id={module.id}
          labels={{ up: `Move up: ${module.title}`, down: `Move down: ${module.title}` }}
          first={index === 0}
          last={index === modules.length - 1}
          disabledReason={null}
          action={actions.moveCourseModuleInCourse}
          what="The Module order"
          gone="That Module is gone. Reload the page."
        />
      </div>
      {rename.conflict ? <ConflictNotice {...rename.conflict} what="this Module’s title" /> : null}

      {module.lessons.length > 0 ? (
        <ol aria-label={`Lessons in ${module.title}`} className="flex flex-col">
          {module.lessons.map((lesson, lessonIndex) => (
            <LessonRow
              key={lesson.id}
              courseId={courseId}
              lesson={lesson}
              number={`${index + 1}.${lessonIndex + 1}`}
              first={lessonIndex === 0}
              last={lessonIndex === module.lessons.length - 1}
              module={module}
              modules={modules}
              actions={actions}
            />
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-muted-foreground">No lessons yet.</p>
      )}

      <form noValidate onSubmit={adding.submit} className="flex flex-wrap items-start gap-2">
        <AdminTextField
          label={`NEW LESSON IN ${module.title.toUpperCase()}`}
          name="title"
          value={adding.title}
          error={adding.error}
          onChange={(event) => adding.setTitle(event.target.value)}
          className="flex-[1_1_240px]"
        />
        <button type="submit" disabled={adding.pending} className={`${PLAIN_BUTTON} mt-[22px]`}>
          {adding.pending ? "Saving…" : "+ Lesson"}
        </button>
      </form>

      {deleteBlocker ? (
        <p className="text-xs leading-[1.45] text-muted-foreground">
          Delete module: {deleteBlocker.toLowerCase()}.
        </p>
      ) : (
        <ConfirmDelete
          label="Delete module"
          ariaLabel={`Delete ${module.title}`}
          buttonClassName="min-h-6 w-fit cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
          tag="DELETE MODULE"
          title={`Delete “${module.title}”?`}
          description="It has no lessons, so nothing else goes with it. This can’t be undone."
          confirmLabel="Delete module"
          send={() => callAdminAction(actions.removeCourseModule, { input: { id: module.id } })}
          onDeleted={() => {
            toast(`✓ DELETED · ${module.title.toUpperCase()}`);
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

/** Pure: what a refused move to another Module says. */
function moveRefusal(error: AdminError): string {
  if (error.kind === "not-found") return "That Lesson or Module is gone. Reload the page.";
  if (error.kind === "invalid" && error.formError) return error.formError;
  return "The Lesson wasn’t moved. Reload the page and try again.";
}

/** One Lesson: its number, ▲▼, title (opening the Lesson editor), tags and "Move to Module…". */
function LessonRow({
  courseId,
  lesson,
  number,
  first,
  last,
  module,
  modules,
  actions,
}: {
  courseId: string;
  lesson: AdminLesson;
  number: string;
  first: boolean;
  last: boolean;
  module: AdminCourseModule;
  modules: AdminCourseModule[];
  actions: CourseBuilderActions;
}) {
  const selectId = useId();
  const others = modules.filter((candidate) => candidate.id !== module.id);
  const { save, pending } = useInstantSave(actions.moveLessonToOtherModule, {
    what: lesson.title,
    kept: "The Lesson is where it was.",
    refused: moveRefusal,
    onSaved: () => toast(`✓ MOVED · ${lesson.title.toUpperCase()}`),
  });
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ayc-ruled py-2 last:border-b-0">
      <span className="font-mono text-xs font-bold text-ayc-blue">{number}</span>
      <MoveButtons
        id={lesson.id}
        labels={{ up: `Move up: ${lesson.title}`, down: `Move down: ${lesson.title}` }}
        first={first}
        last={last}
        disabledReason={null}
        action={actions.moveLessonInModule}
        what={`The ${module.title} order`}
        gone="That Lesson is gone. Reload the page."
      />
      <Link
        href={paths.admin.course(courseId, { lesson: lesson.id })}
        className="min-w-0 flex-[1_1_160px] text-sm font-semibold wrap-anywhere hover:underline"
      >
        {lesson.title}
      </Link>
      {lesson.freePreview ? <span className={TAG}>FREE PREVIEW</span> : null}
      <span className={TAG}>{lessonStateLabel(lesson.state)}</span>
      {others.length > 0 ? (
        <span className="flex items-center gap-1.5">
          <label htmlFor={selectId} className="sr-only">
            Move {lesson.title} to Module
          </label>
          <select
            id={selectId}
            value=""
            disabled={pending}
            onChange={(event) => {
              if (event.target.value) save({ id: lesson.id, module: event.target.value });
            }}
            className="min-h-8 border-[1.5px] bg-white px-1.5 text-[12px] font-semibold"
          >
            <option value="">Move to Module…</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.title}
              </option>
            ))}
          </select>
        </span>
      ) : null}
    </li>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { TypedDeleteDialog } from "@/components/admin/typed-delete-dialog";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { lessonStateLabel } from "@/lib/courses/course-rules";
import { paths } from "@/paths";
import { DELETE_WORD } from "@/services/admin.schema";
import type { AdminLesson } from "@/services/admin.types";
import type { Lesson } from "@/services/courses.types";

import {
  conflictOf,
  fieldErrorsOf,
  LABEL,
  PLAIN_BUTTON,
  PRIMARY_BUTTON,
  refusalText,
  TAG,
  TEXT_BUTTON,
} from "./course-ui";

export interface LessonEditorActions {
  saveLesson: AdminAction<AdminLesson>;
  saveLessonPublished: AdminAction<AdminLesson>;
  removeLesson: AdminAction<Lesson>;
}

interface LessonEditorProps {
  course: { id: string; title: string };
  /** The Module the Lesson is in, for the heading. */
  moduleTitle: string;
  lesson: AdminLesson;
  actions: LessonEditorActions;
}

/** Pure: what deleting a Lesson takes from Members. */
export function savedPositionsLine(count: number): string {
  return count === 1
    ? "1 member loses their saved position in this lesson."
    : `${count} members lose their saved position in this lesson.`;
}

/**
 * The Lesson editor (Phase 5, ticket 01; BUILD-MAP §3.7): the title, the
 * video (none yet: ticket 02 adds uploads), notes shown under the video, Free
 * Preview, Publish or Unpublish, Save, and Delete lesson, which needs DELETE
 * typed. The server enforces every rule (Publish needs a ready video).
 */
export function LessonEditor({ course, moduleTitle, lesson, actions }: LessonEditorProps) {
  const router = useRouter();
  const notesId = useId();
  const previewId = useId();
  const [title, setTitle] = useState(lesson.title);
  const [notes, setNotes] = useState(lesson.notes);
  const [freePreview, setFreePreview] = useState(lesson.freePreview);
  const [answer, setAnswer] = useState<AdminActionState<unknown>>({ status: "idle" });
  const [publishLine, setPublishLine] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const errors = fieldErrorsOf(answer);
  const conflict = conflictOf(answer);
  const published = lesson.state === "published";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const state = await callAdminAction(actions.saveLesson, {
        input: { id: lesson.id, title, notes, freePreview },
        expected: { savedAt: lesson.stamp.savedAt },
      });
      setAnswer(state);
      if (state.status === "saved") {
        toast(`✓ SAVED · ${state.value.title.toUpperCase()}`);
        router.refresh();
      }
    });
  }

  function publish() {
    if (pending) return;
    setPublishLine(null);
    startTransition(async () => {
      const state = await callAdminAction(actions.saveLessonPublished, {
        input: { id: lesson.id, published: !published },
      });
      if (state.status === "saved") {
        toast(published ? "✓ UNPUBLISHED" : "✓ PUBLISHED");
        router.refresh();
      } else {
        setPublishLine(refusalText(state, "NOT PUBLISHED"));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      setDeleteError(undefined);
      const state = await callAdminAction(actions.removeLesson, {
        input: { id: lesson.id, confirm: DELETE_WORD },
      });
      if (state.status === "saved") {
        setDeleting(false);
        toast(`✓ DELETED · ${lesson.title.toUpperCase()}`);
        router.push(paths.admin.course(course.id));
        router.refresh();
      } else {
        setDeleteError(refusalText(state, "NOT DELETED"));
      }
    });
  }

  const line = answer.status === "saved" ? "" : refusalText(answer, "FIX THE FIELDS MARKED IN RED");

  return (
    <section
      aria-labelledby="lesson-editor"
      className="flex max-w-3xl min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <Link href={paths.admin.course(course.id)} className={`${TEXT_BUTTON} w-fit`}>
        ← {course.title}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="lesson-editor"
          className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
        >
          LESSON · {moduleTitle.toUpperCase()}
        </h2>
        <span className={TAG}>{lessonStateLabel(lesson.state)}</span>
      </div>

      <form noValidate onSubmit={save} className="flex flex-col gap-3.5">
        <AdminTextField
          label="LESSON TITLE"
          name="title"
          value={title}
          error={errors.title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <p className={LABEL}>VIDEO</p>
          <div className="flex aspect-video max-w-md flex-col items-center justify-center gap-1 border-[1.5px] border-dashed bg-white p-4 text-center">
            <span className={TAG}>NO VIDEO</span>
            <p className="text-[13px] text-muted-foreground">
              Video uploads come with the video service.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={notesId} className={LABEL}>
            LESSON NOTES · SHOWN UNDER THE VIDEO
          </label>
          <textarea
            id={notesId}
            name="notes"
            rows={5}
            value={notes}
            aria-invalid={errors.notes ? true : undefined}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2.25 text-[13px] aria-invalid:border-destructive"
          />
          {errors.notes ? (
            <p className="font-mono text-[11px] font-medium text-destructive">{errors.notes}</p>
          ) : null}
        </div>
        <div className="flex items-start gap-2.5">
          <input
            id={previewId}
            type="checkbox"
            checked={freePreview}
            onChange={(event) => setFreePreview(event.target.checked)}
            className="mt-0.5 size-5 flex-none accent-ayc-blue"
          />
          <label htmlFor={previewId} className="flex flex-col text-sm">
            <span className="font-bold">Free preview</span>
            <span className="text-muted-foreground">
              Anyone signed in can watch this one lesson.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5">
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" disabled={pending} onClick={publish} className={PLAIN_BUTTON}>
            {published ? "Unpublish" : "Publish lesson"}
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className={`${PLAIN_BUTTON} text-destructive`}
          >
            Delete lesson
          </button>
        </div>
        {line ? (
          <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
            {line}
          </p>
        ) : null}
        {publishLine ? (
          <p role="alert" className="font-mono text-[11px] font-bold text-destructive">
            {publishLine}
          </p>
        ) : null}
      </form>
      {conflict ? <ConflictNotice {...conflict} what="this Lesson" /> : null}

      <TypedDeleteDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) setDeleteError(undefined);
        }}
        tag="DELETE LESSON"
        title={`Delete “${lesson.title}”?`}
        description={`${savedPositionsLine(lesson.savedPositions)} This can’t be undone.`}
        confirmLabel="Delete lesson"
        onConfirm={remove}
        pending={pending}
        error={deleteError}
      />
    </section>
  );
}

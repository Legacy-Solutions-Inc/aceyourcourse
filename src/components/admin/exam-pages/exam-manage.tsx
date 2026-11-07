"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { TextField } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { blankSubject, newExamFormValues } from "@/lib/admin/exam-page-form";
import { examPageAddress, examPagesHref } from "@/lib/admin/exam-pages-view";
import { listNumber } from "@/lib/text";
import { examDeleteBlocker, subjectDeleteBlocker } from "@/services/admin.schema";
import type { AdminExamPage } from "@/services/admin.types";
import type { Exam } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Adding and deleting Exams and Subjects in Pages & promo (ticket 23; spec,
// Phase 2 → "Adding Exams and Subjects"), for Owners: the screen shows none
// of this to an Editor, and the Server Actions and the seam refuse one. Each
// delete is confirmed in the page; while something still uses the Exam or
// Subject, the reason replaces its button. The codes are fixed once saved.
// ─────────────────────────────────────────────────────────────────────────────

/** The Owner-only actions on an Exam page. */
export interface ExamManageActions {
  addSubject: AdminAction<AdminExamPage>;
  removeSubject: AdminAction<AdminExamPage>;
  removeExam: AdminAction<Exam>;
}

/** A form that adds something has no stamp to check. */
const NEVER_SAVED = new Date(0).toISOString();
const INVALID = "FIX THE FIELDS MARKED IN RED";
const NOTE = "text-[13px] leading-[1.45] text-muted-foreground";
const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue";
const PLAIN_BUTTON =
  "min-h-8.5 cursor-pointer border-[1.5px] bg-ayc-paper px-3 text-[13px] font-bold hover:bg-ayc-sand";

/** "+ Add exam" (story 80d): the codes, the Header's fields and at least one Subject. */
export function AddExamForm({ action }: { action: AdminAction<AdminExamPage> }) {
  const router = useRouter();
  const form = useAdminForm({
    action,
    initialValues: newExamFormValues(),
    savedAt: NEVER_SAVED,
    valuesFrom: () => newExamFormValues(),
    // Saving opens the new Exam's Header.
    onSaved: (saved: AdminExamPage) => router.push(examPagesHref({ exam: saved.exam.code })),
    title: "The new Exam",
    invalidMessage: INVALID,
  });
  const { values, change, fieldError } = form;
  const field = (path: "code" | "board" | "name" | "longName" | "blurb" | "madeFor") => ({
    value: values[path],
    onChange: (value: string) => change(path, value),
    error: fieldError(path),
  });
  // Each Subject row's key: rows have no id until saved, and one can be removed from the middle.
  const lastRow = useRef(0);
  const [rows, setRows] = useState([0]);
  const setSubjects = (subjects: typeof values.subjects) => change("subjects", subjects);
  const addRow = () => {
    lastRow.current += 1;
    setRows([...rows, lastRow.current]);
    setSubjects([...values.subjects, blankSubject()]);
  };
  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
    setSubjects(values.subjects.filter((_, i) => i !== index));
  };
  const code = values.code.trim().toLowerCase();

  return (
    <form aria-label="New exam" className="flex flex-col gap-3.5" {...form.formProps}>
      <p className={NOTE}>
        It goes last in every list, with every section of its page shown. It stays off the website
        until one of its Products is on the website.
      </p>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <TextField label="EXAM CODE" placeholder="e.g. CHE" {...field("code")} />
          <p className="font-mono text-[11px] text-muted-foreground">
            2–6 letters · {examPageAddress(code || "code")}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <TextField label="BOARD ACRONYM" placeholder="e.g. CHELE" {...field("board")} />
          <p className="font-mono text-[11px] text-muted-foreground">2–10 letters</p>
        </div>
      </div>
      <p className={NOTE}>The code and board acronym can’t be changed once the Exam is added.</p>
      <TextField label="EXAM NAME" placeholder="e.g. Chemical Engineering" {...field("name")} />
      <TextField label="LONG NAME" {...field("longName")} />
      <TextField label="TEXT" multiline inputClassName="min-h-22" {...field("blurb")} />
      <TextField label="MADE FOR" {...field("madeFor")} />
      <fieldset className="flex flex-col gap-3 border-t-[1.5px] pt-3">
        <legend className={LABEL}>SUBJECTS</legend>
        {fieldError("subjects") ? (
          <p className="font-mono text-[11px] font-medium text-destructive">
            {fieldError("subjects")}
          </p>
        ) : null}
        {values.subjects.map((subject, index) => (
          <div
            key={rows[index] ?? index}
            className="grid items-start gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
          >
            <TextField
              label={`${listNumber(index)} · CODE`}
              placeholder="e.g. PCHEM"
              value={subject.code}
              onChange={(next) =>
                setSubjects(values.subjects.map((s, i) => (i === index ? { ...s, code: next } : s)))
              }
              error={fieldError(`subjects.${index}.code`)}
            />
            <TextField
              label={`${listNumber(index)} · NAME`}
              value={subject.name}
              onChange={(next) =>
                setSubjects(values.subjects.map((s, i) => (i === index ? { ...s, name: next } : s)))
              }
              error={fieldError(`subjects.${index}.name`)}
            />
            {values.subjects.length > 1 ? (
              <button
                type="button"
                aria-label={`Remove Subject ${listNumber(index)}`}
                onClick={() => removeRow(index)}
                className="min-h-6 cursor-pointer self-end pb-2.5 text-[13px] font-semibold text-destructive hover:underline"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={addRow} className={`${PLAIN_BUTTON} self-start`}>
          + Add another subject
        </button>
      </fieldset>
      <EditorSaveRow
        saveLabel="Add exam"
        savedMessage="✓ ADDED · NOT ON THE SITE UNTIL ONE OF ITS PRODUCTS IS"
        form={form}
        extra={
          <Link
            href={examPagesHref({})}
            scroll={false}
            className="text-[13px] font-semibold text-muted-foreground hover:underline"
          >
            Cancel
          </Link>
        }
      />
    </form>
  );
}

/** "+ Add subject" (story 80e): a Subject's code and name, added last. */
export function AddSubjectForm({
  opened,
  action,
}: {
  opened: AdminExamPage;
  action: AdminAction<AdminExamPage>;
}) {
  const router = useRouter();
  const exam = opened.exam.code;
  const blank = () => ({ exam, ...blankSubject() });
  const form = useAdminForm({
    action,
    initialValues: blank(),
    savedAt: NEVER_SAVED,
    valuesFrom: blank,
    onSaved: () => router.refresh(),
    title: `A new ${exam} Subject`,
    invalidMessage: INVALID,
  });
  const { values, change, fieldError } = form;
  return (
    <form
      aria-label="Add subject"
      className="flex flex-col gap-3 border-t-[1.5px] pt-3.5"
      {...form.formProps}
    >
      <h3 className={LABEL}>+ ADD SUBJECT</h3>
      <div className="grid items-start gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <TextField
          label="CODE"
          placeholder="e.g. THERMO"
          value={values.code}
          onChange={(code) => change("code", code)}
          error={fieldError("code")}
        />
        <TextField
          label="NAME"
          value={values.name}
          onChange={(name) => change("name", name)}
          error={fieldError("name")}
        />
      </div>
      <p className={NOTE}>It goes last. Its code can’t be changed once it’s added.</p>
      <EditorSaveRow saveLabel="Add subject" savedMessage="✓ SUBJECT ADDED" form={form} />
    </form>
  );
}

/** Pure: what a refused or failed delete says, in the dialog. */
function deleteError(state: AdminActionState<unknown>): string | undefined {
  if (state.status === "failed") return "COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return undefined;
  const { error } = state;
  if (error.kind === "invalid" && error.formError) return error.formError;
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "not-found") return "IT’S ALREADY GONE · RELOAD THE PAGE";
  return "NOT DELETED · RELOAD THE PAGE AND TRY AGAIN";
}

interface ConfirmDeleteProps {
  /** The button that opens the confirmation, e.g. "Delete exam". */
  label: string;
  /** The button's accessible name, when it needs more than its label. */
  ariaLabel?: string;
  buttonClassName: string;
  tag: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Sends the delete; gives its answer. */
  send: () => Promise<AdminActionState<unknown>>;
  onDeleted: () => void;
}

/** A delete button and its in-page confirmation (the Admin's dialog, never the browser's). */
function ConfirmDelete({
  label,
  ariaLabel,
  buttonClassName,
  tag,
  title,
  description,
  confirmLabel,
  send,
  onDeleted,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await send();
      if (state.status === "saved") {
        setOpen(false);
        onDeleted();
      } else {
        setError(deleteError(state));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className={buttonClassName}
      >
        {label}
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        tag={tag}
        tone="danger"
        title={title}
        description={description}
      >
        {error ? (
          <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AdminDialogButtons>
          <AdminDialogButton onClick={() => setOpen(false)}>Cancel</AdminDialogButton>
          <AdminDialogButton
            variant="danger"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {confirmLabel}
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </>
  );
}

const REMOVE_BUTTON =
  "min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline";

/** A Subject's remove button, or why it can't be removed. */
export function RemoveSubject({
  opened,
  subject,
  action,
}: {
  opened: AdminExamPage;
  subject: string;
  action: AdminAction<AdminExamPage>;
}) {
  const router = useRouter();
  const exam = opened.exam.code;
  const reason = subjectDeleteBlocker({
    exam,
    subject,
    products: opened.subjectProducts[subject] ?? 0,
    subjects: opened.exam.subjects.length,
  });
  if (reason) return <p className="text-xs leading-[1.45] text-muted-foreground">{reason}</p>;
  return (
    <ConfirmDelete
      label="Remove"
      ariaLabel={`Remove ${subject}`}
      buttonClassName={`${REMOVE_BUTTON} self-start`}
      tag="REMOVE SUBJECT"
      title={`Remove ${subject} from ${exam}?`}
      description={`It’s no longer listed on the ${exam} page, and Products can’t be tagged with it. This can’t be undone.`}
      confirmLabel="Remove subject"
      send={() => callAdminAction(action, { input: { exam, code: subject } })}
      onDeleted={() => {
        toast(`✓ REMOVED · ${subject} IS NO LONGER A ${exam} SUBJECT`);
        router.refresh();
      }}
    />
  );
}

/** "Delete exam", at the foot of the Header editor, or why it can't be deleted. */
export function DeleteExam({
  opened,
  action,
}: {
  opened: AdminExamPage;
  action: AdminAction<Exam>;
}) {
  const router = useRouter();
  const { code, name, subjects } = opened.exam;
  const reason = examDeleteBlocker(code, opened.products.length);
  const count = `${subjects.length} ${subjects.length === 1 ? "Subject" : "Subjects"}`;
  return (
    <section
      aria-label="Delete exam"
      className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5"
    >
      {reason ? (
        <p className="text-[13px] leading-[1.45] text-muted-foreground">{reason}</p>
      ) : (
        <ConfirmDelete
          label="Delete exam"
          buttonClassName={REMOVE_BUTTON}
          tag="DELETE EXAM"
          title={`Delete ${code}?`}
          description={`${name}, its ${count} and its page settings are deleted. No Product belongs to it. This can’t be undone.`}
          confirmLabel="Delete exam"
          send={() => callAdminAction(action, { input: { code } })}
          onDeleted={() => {
            toast(`✓ DELETED · ${code} IS NO LONGER AN EXAM`);
            router.replace(examPagesHref({}), { scroll: false });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

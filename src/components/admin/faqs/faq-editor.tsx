"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminSwitch } from "@/components/admin/admin-switch";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import {
  PanelSection,
  SelectField,
  TextField,
  ToggleRow,
} from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import { faqFormValues, faqSlugFor, newFaqForm } from "@/lib/admin/faq-form";
import { faqAddress, faqGroupTitle } from "@/lib/admin/faq-list";
import { cn } from "@/lib/utils";
import { FAQ_CHIP_LABEL_MAX, type FaqForm, faqAnswerLength } from "@/services/admin.schema";
import type { AdminFaq, DeletedFaq, FaqReviewOption } from "@/services/admin.types";
import { FAQ_ANSWER_MAX, FAQ_GROUPS } from "@/services/catalogue.schema";
import type { FaqGroup } from "@/services/catalogue.types";

import { QuotePicker } from "./quote-picker";

// ─────────────────────────────────────────────────────────────────────────────
// The FAQ editor (mockup 301–310; BUILD-MAP §3.4, FAQS tab). Every field,
// the toggles included, is saved together with the conflict check: they're
// the FAQ's own fields, not single toggles on a list. The deep link is set
// from the question when the FAQ is added and never changes afterwards.
// ─────────────────────────────────────────────────────────────────────────────

export interface FaqEditorActions {
  save: AdminAction<AdminFaq>;
  add: AdminAction<AdminFaq>;
  remove: AdminAction<DeletedFaq>;
}

const SAVED = "✓ SAVED · LIVE ON THE FAQ PAGE";
const INVALID = "FIX THE FIELDS MARKED IN RED";

/** A new FAQ has never been saved, so no save can be newer than the form. */
const NEVER_SAVED = new Date(0).toISOString();

const GROUP_OPTIONS = FAQ_GROUPS.map((group) => ({ value: group, label: faqGroupTitle(group) }));

/** What the shared fields need from the form. */
interface FieldsForm {
  values: FaqForm;
  change: (path: string, value: unknown) => void;
  fieldError: (path: string) => string | undefined;
}

interface EditFaqProps {
  opened: AdminFaq;
  reviews: FaqReviewOption[];
  /** The list to go back to once it's deleted, with its group and search. */
  listHref: string;
  actions: FaqEditorActions;
  /** Called with the FAQ after each save, e.g. to follow it to its new group. */
  onSaved: (saved: AdminFaq) => void;
  /** The FAQ as its "Add question" left it, when it was added just now. */
  savedOnOpen?: AdminFaq;
}

/** An existing FAQ's editor, with Save question and Delete. */
export function EditFaq({
  opened,
  reviews,
  listHref,
  actions,
  onSaved,
  savedOnOpen,
}: EditFaqProps) {
  const [stamp, setStamp] = useState(opened.stamp);
  const { faq } = opened;
  const id = faq.id;
  const form = useAdminForm({
    action: actions.save,
    initialValues: { id, ...faqFormValues(faq) },
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminFaq) => ({ id, ...faqFormValues(saved.faq) }),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      onSaved(saved);
    },
    savedOnOpen,
    title: "This question",
    invalidMessage: INVALID,
  });

  return (
    <form aria-label="Edit question" className="flex min-w-0 flex-col gap-3" {...form.formProps}>
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
        EDIT QUESTION
      </p>
      <FaqFields form={form} reviews={reviews} address={faqAddress(faq.slug)} />
      {form.conflict ? <ConflictNotice {...form.conflict} what="this question" /> : null}
      <EditorSaveRow
        saveLabel="Save question"
        savedMessage={SAVED}
        form={form}
        extra={
          <DeleteFaq id={id} question={faq.question} remove={actions.remove} listHref={listHref} />
        }
      />
    </form>
  );
}

interface NewFaqProps {
  group: FaqGroup;
  reviews: FaqReviewOption[];
  /** Every FAQ's deep-link slug, so the new one's can be shown before it's added. */
  slugs: string[];
  actions: FaqEditorActions;
  /** Called with the new FAQ once it's added. */
  onAdded: (added: AdminFaq) => void;
}

/** "+ Add question to {group}": a new FAQ's editor, in that group. */
export function NewFaq({ group, reviews, slugs, actions, onAdded }: NewFaqProps) {
  const form = useAdminForm({
    action: actions.add,
    initialValues: newFaqForm(group),
    savedAt: NEVER_SAVED,
    valuesFrom: (saved: AdminFaq) => faqFormValues(saved.faq),
    onSaved: onAdded,
    title: "New question",
    invalidMessage: INVALID,
  });
  const question = form.values.question.trim();

  return (
    <form aria-label="New question" className="flex min-w-0 flex-col gap-3" {...form.formProps}>
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
        NEW QUESTION · {faqGroupTitle(form.values.group).toUpperCase()}
      </p>
      <FaqFields
        form={form}
        reviews={reviews}
        address={question ? faqAddress(faqSlugFor(question, slugs)) : null}
      />
      <EditorSaveRow saveLabel="Add question" savedMessage={SAVED} form={form} />
    </form>
  );
}

interface FaqFieldsProps {
  form: FieldsForm;
  reviews: FaqReviewOption[];
  /** The deep link, or null for a new FAQ with no question yet. */
  address: string | null;
}

/** Every field, in the mockup's order, then the toggles. */
function FaqFields({ form, reviews, address }: FaqFieldsProps) {
  const { values, change, fieldError } = form;
  const answerCounter = useId();
  const answerLength = faqAnswerLength(values.answer);

  return (
    <>
      <TextField
        label="QUESTION"
        placeholder="Write it the way a reviewee would ask"
        value={values.question}
        onChange={(question) => change("question", question)}
        error={fieldError("question")}
      />
      <TextField
        label="ANSWER"
        multiline
        value={values.answer}
        onChange={(answer) => change("answer", answer)}
        error={fieldError("answer")}
        describedBy={answerCounter}
        inputClassName="min-h-32.5 leading-normal"
        aside={
          <span
            id={answerCounter}
            className={cn(
              "font-mono text-xs font-medium",
              answerLength > FAQ_ANSWER_MAX ? "text-destructive" : "text-ayc-success",
            )}
          >
            {answerLength} / {FAQ_ANSWER_MAX} CHARACTERS
          </span>
        }
      />
      <SelectField
        label="GROUP"
        value={values.group}
        options={GROUP_OPTIONS}
        onChange={(group) => change("group", group)}
        error={fieldError("group")}
      />
      <p className="font-mono text-[11px] break-all text-muted-foreground">
        DEEP LINK · {address ?? "SET FROM THE QUESTION WHEN YOU ADD IT"}
      </p>
      <QuotePicker
        reviews={reviews}
        reviewId={values.quoteReviewId}
        text={values.quoteText}
        onChange={(quote) => {
          change("quoteReviewId", quote.reviewId);
          change("quoteText", quote.text);
        }}
        errors={{ reviewId: fieldError("quoteReviewId"), text: fieldError("quoteText") }}
      />
      <PanelSection title="VISIBILITY">
        <FlagRow
          form={form}
          flag="showOnFaqPage"
          label="Show on FAQ page"
          hint="Off keeps it saved but hidden"
        />
        <FlagRow
          form={form}
          flag="popular"
          label="Popular question"
          hint="Adds a chip at the top of the FAQ page"
        />
        {values.popular ? <ChipLabelField form={form} /> : null}
        <FlagRow
          form={form}
          flag="requiresMemberApp"
          label="Only while the Member App is live"
          hint="Hidden from the FAQ page until the app is on"
        />
        <FlagRow
          form={form}
          flag="showCoverageTable"
          label="Show the Subjects table"
          hint="Each Exam’s Subjects, under the answer"
        />
      </PanelSection>
    </>
  );
}

type Flag = "showOnFaqPage" | "popular" | "requiresMemberApp" | "showCoverageTable";

/** One toggle, a field of the form, with the last save's message under it. */
function FlagRow({
  form,
  flag,
  label,
  hint,
}: {
  form: FieldsForm;
  flag: Flag;
  label: string;
  hint: string;
}) {
  const error = form.fieldError(flag);
  const errorId = `${useId()}-error`;
  return (
    <div className="flex flex-col gap-1">
      <ToggleRow label={label} hint={hint}>
        {(ids) => (
          <AdminSwitch
            checked={form.values[flag]}
            onCheckedChange={(on) => form.change(flag, on)}
            aria-labelledby={ids["aria-labelledby"]}
            aria-describedby={
              error ? `${ids["aria-describedby"]} ${errorId}` : ids["aria-describedby"]
            }
            aria-invalid={error ? true : undefined}
          />
        )}
      </ToggleRow>
      {error ? (
        <p id={errorId} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** CHIP LABEL, at most 40 characters, counted as typed (mockup has none; spec, Phase 2 → FAQ). */
function ChipLabelField({ form }: { form: FieldsForm }) {
  const counter = useId();
  const length = form.values.popularLabel.trim().length;
  return (
    <TextField
      label="CHIP LABEL"
      placeholder="Like “Shipping time?”"
      value={form.values.popularLabel}
      onChange={(label) => form.change("popularLabel", label)}
      error={form.fieldError("popularLabel")}
      describedBy={counter}
      aside={
        <span
          id={counter}
          className={cn(
            "font-mono text-xs font-medium",
            length > FAQ_CHIP_LABEL_MAX ? "text-destructive" : "text-ayc-success",
          )}
        >
          {length} / {FAQ_CHIP_LABEL_MAX}
          <span className="sr-only"> characters</span>
        </span>
      }
    />
  );
}

const ALREADY_DELETED = "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE";

interface DeleteFaqProps {
  id: string;
  question: string;
  remove: AdminAction<DeletedFaq>;
  listHref: string;
}

/**
 * Delete, and its plain confirmation (mockup 1575; BUILD-MAP §2, deleteFaq),
 * which suggests turning "Show on FAQ page" off instead.
 */
function DeleteFaq({ id, question, remove, listHref }: DeleteFaqProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(remove, { input: { id } });
      if (state.status === "saved") {
        setOpen(false);
        toast("✓ DELETED · THE QUESTION IS OFF THE FAQ PAGE");
        router.replace(listHref, { scroll: false });
      } else if (state.status === "failed") {
        setError("COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN");
      } else if (state.status === "refused") {
        setError(
          state.error.kind === "not-found"
            ? ALREADY_DELETED
            : "NOT DELETED · RELOAD THE PAGE AND TRY AGAIN",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className="min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
      >
        Delete
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        tag="DELETE QUESTION"
        tone="danger"
        title={`Delete “${question}”?`}
        description="It’s removed from the FAQ page and from what search engines and AI assistants can quote. To keep it for later, turn off “Show on FAQ page” instead."
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
            Delete question
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminTextField } from "@/components/admin/admin-text-field";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { SelectField, TextField } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import {
  bundleFormValues,
  dateFormValues,
  headerFormValues,
  subjectFormValues,
} from "@/lib/admin/exam-page-form";
import { examDateWarning } from "@/lib/admin/exam-pages-view";
import type { FormValues } from "@/lib/admin/form-values";
import { productListHref } from "@/lib/admin/product-list";
import { reviewListHref } from "@/lib/admin/review-list";
import { listNumber } from "@/lib/text";
import type { AdminExamPage, BundleProductOption, ExamPagePart } from "@/services/admin.types";

import { RemoveSubject } from "./exam-manage";

// ─────────────────────────────────────────────────────────────────────────────
// Pages & promo's column 3 for an Exam page (mockup 103–145; BUILD-MAP §3.2): each
// section's editor. Every part saves on its own, with the conflict check
// against the stamp it opened with, and is live on its Save. The section
// headings, the compare table, "Try a card" and the store band are fixed in
// code (spec, Phase 2 → Exam pages & promo), so they have no fields here.
// ─────────────────────────────────────────────────────────────────────────────

export const SAVED = "✓ SAVED · LIVE ON THE SITE";
export const INVALID = "FIX THE FIELDS MARKED IN RED";

/**
 * One part's form: its values with the Exam's code, its own stamp, and the
 * page read again after each save, so columns 1 and 2 show it.
 */
export function useExamPartForm<Values extends FormValues>(
  opened: AdminExamPage,
  part: ExamPagePart,
  {
    action,
    valuesOf,
    title,
    blocker,
  }: {
    action: AdminAction<AdminExamPage>;
    valuesOf: (page: AdminExamPage) => Values;
    title: string;
    blocker?: (values: Values & { code: string }) => string | null;
  },
) {
  const router = useRouter();
  const code = opened.exam.code;
  const [stamp, setStamp] = useState(opened.stamps[part]);
  return useAdminForm({
    action,
    initialValues: { code, ...valuesOf(opened) },
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminExamPage) => ({ code, ...valuesOf(saved) }),
    onSaved: (saved) => {
      setStamp(saved.stamps[part]);
      router.refresh();
    },
    title,
    invalidMessage: INVALID,
    blocker,
  });
}

/** A note in the editor, with a link to where it's edited (mockup 133). */
export function InfoNote({
  children,
  link,
}: {
  children: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center gap-2.5 border border-dashed border-ayc-rule p-3 text-[13px] leading-[1.45]">
      <span aria-hidden="true" className="font-mono text-xs font-bold text-ayc-blue">
        i
      </span>
      <span className="flex-1">{children}</span>
      {link ? (
        <Link
          href={link.href}
          className="font-bold whitespace-nowrap text-ayc-blue hover:underline"
        >
          {link.label} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

interface EditorProps {
  opened: AdminExamPage;
  action: AdminAction<AdminExamPage>;
}

/** Header (mockup 983): EXAM NAME, LONG NAME, TEXT, MADE FOR, and where the photos come from. */
export function HeaderEditor({ opened, action }: EditorProps) {
  const form = useExamPartForm(opened, "header", {
    action,
    valuesOf: ({ exam }) => headerFormValues(exam),
    title: `The ${opened.exam.code} header`,
  });
  const { values, change, fieldError } = form;
  return (
    <form aria-label="Header" className="flex flex-col gap-3.5" {...form.formProps}>
      <TextField
        label="EXAM NAME"
        value={values.name}
        onChange={(name) => change("name", name)}
        error={fieldError("name")}
      />
      <TextField
        label="LONG NAME"
        value={values.longName}
        onChange={(longName) => change("longName", longName)}
        error={fieldError("longName")}
      />
      <TextField
        label="TEXT"
        multiline
        value={values.blurb}
        onChange={(blurb) => change("blurb", blurb)}
        error={fieldError("blurb")}
        inputClassName="min-h-22"
      />
      <TextField
        label="MADE FOR"
        value={values.madeFor}
        onChange={(madeFor) => change("madeFor", madeFor)}
        error={fieldError("madeFor")}
      />
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-medium text-muted-foreground">HEADER IMAGE</span>
        <InfoNote>From the top-selling {opened.exam.code} product</InfoNote>
      </div>
      {form.conflict ? <ConflictNotice {...form.conflict} what="this header" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

/**
 * Subjects covered (mockup 984): each Subject's name; its code is fixed. For
 * an Owner, each Subject has its remove button, or why it can't be removed.
 */
export function SubjectsEditor({
  opened,
  action,
  removeSubject,
}: EditorProps & { removeSubject?: AdminAction<AdminExamPage> }) {
  const form = useExamPartForm(opened, "subjects", {
    action,
    valuesOf: ({ exam }) => subjectFormValues(exam),
    title: `The ${opened.exam.code} Subjects`,
  });
  const { values, change, fieldError } = form;
  return (
    <form aria-label="Subjects covered" className="flex flex-col gap-3.5" {...form.formProps}>
      <p className="text-[13px] leading-[1.45] text-muted-foreground">
        Each name shows on this page and its Products’ pages, and in the website’s search. The codes
        are fixed.
      </p>
      {values.subjects.map((subject, index) => (
        <div key={subject.code} className="flex flex-col gap-1">
          <TextField
            label={`${listNumber(index)} · ${subject.code}`}
            value={subject.name}
            onChange={(name) =>
              change(
                `subjects`,
                values.subjects.map((s, i) => (i === index ? { ...s, name } : s)),
              )
            }
            error={fieldError(`subjects.${index}.name`)}
          />
          {removeSubject ? (
            <RemoveSubject opened={opened} subject={subject.code} action={removeSubject} />
          ) : null}
        </div>
      ))}
      {form.conflict ? <ConflictNotice {...form.conflict} what="these Subjects" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

/** Reviewers (mockup 985): always on, listed from the Products. */
export function ReviewersNote({ opened }: { opened: AdminExamPage }) {
  const exam = opened.exam.code;
  return (
    <InfoNote
      link={{ href: productListHref({ q: null, exam, missing: false }), label: "Products" }}
    >
      Products are listed automatically, best selling first.
    </InfoNote>
  );
}

/** Reviews (mockup 988): the Reviews of the Exam's Products, shown or hidden. */
export function ReviewsNote({ opened }: { opened: AdminExamPage }) {
  const exam = opened.exam.code;
  return (
    <InfoNote
      link={{
        href: reviewListHref({ q: null, exam, stars: null, pinned: false }),
        label: "Reviews",
      }}
    >
      Shows reviews attached to {exam} products.
    </InfoNote>
  );
}

/** Pure: a bundle Product's option, saying when the Website won't show its offer yet. */
function productOption({ id, shortName, state, showOnWebsite }: BundleProductOption) {
  const notes = [state === "coming-soon" ? "COMING SOON" : null, showOnWebsite ? null : "HIDDEN"];
  const note = notes.filter(Boolean).join(", ");
  return { value: id, label: note ? `${shortName} · ${note}` : shortName };
}

/** Bundle offer (mockup 986): one of the Exam's Products, a headline, text and button label. */
export function BundleEditor({ opened, action }: EditorProps) {
  const form = useExamPartForm(opened, "bundleOffer", {
    action,
    valuesOf: ({ page }) => bundleFormValues(page),
    title: `The ${opened.exam.code} bundle offer`,
  });
  const { values, change, fieldError } = form;
  const offering = values.productId !== "";
  return (
    <form aria-label="Bundle offer" className="flex flex-col gap-3.5" {...form.formProps}>
      <SelectField
        label="PRODUCT"
        value={values.productId}
        options={[{ value: "", label: "No offer" }, ...opened.products.map(productOption)]}
        onChange={(productId) => change("productId", productId)}
        error={fieldError("productId")}
      />
      {offering ? (
        <>
          <TextField
            label="HEADLINE"
            value={values.headline}
            onChange={(headline) => change("headline", headline)}
            error={fieldError("headline")}
          />
          <TextField
            label="TEXT"
            multiline
            value={values.text}
            onChange={(text) => change("text", text)}
            error={fieldError("text")}
          />
          <TextField
            label="BUTTON LABEL"
            value={values.buttonLabel}
            onChange={(buttonLabel) => change("buttonLabel", buttonLabel)}
            error={fieldError("buttonLabel")}
          />
        </>
      ) : null}
      <InfoNote>
        It shows only while its Product is Live and on the website. The price, and the saving after
        the headline, come from the Product.
      </InfoNote>
      {form.conflict ? <ConflictNotice {...form.conflict} what="this bundle offer" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

/** OFFICIAL EXAM DATE (spec, story 77): optional; a past date is warned about but saves. */
export function DateEditor({ opened, action, today }: EditorProps & { today: string }) {
  const form = useExamPartForm(opened, "officialExamDate", {
    action,
    valuesOf: ({ page }) => dateFormValues(page),
    title: `The ${opened.exam.code} Official Exam Date`,
  });
  const warning = examDateWarning(form.values.officialExamDate, today);
  return (
    <form aria-label="Official Exam Date" className="flex flex-col gap-3.5" {...form.formProps}>
      <AdminTextField
        label="OFFICIAL EXAM DATE"
        type="date"
        {...form.text("officialExamDate")}
        error={form.fieldError("officialExamDate")}
      />
      {warning ? (
        <p className="font-mono text-[11px] font-medium text-ayc-warning">{warning}</p>
      ) : null}
      <InfoNote>
        From the PRC schedule. The Member App’s countdown will start from it; the website doesn’t
        show it yet. Leave it blank until PRC announces the date.
      </InfoNote>
      {form.conflict ? <ConflictNotice {...form.conflict} what="this date" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { SelectField, ToggleRow } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import {
  accessPeriodLabel,
  newPlanFormValues,
  perMonthText,
  periodLabel,
  type PlanFormValues,
  planFormValues,
  planPreviewTag,
  plansHref,
  previewPrice,
} from "@/lib/admin/plan-view";
import { formatPeso } from "@/lib/money";
import { defaultPlanName, isPlanDays, PLAN_DAYS } from "@/lib/plans/plan-rules";
import { cn } from "@/lib/utils";
import type { AdminPlan, AdminPlans, Plan } from "@/services/admin.types";

// The Plans & prices editor (Phase 4, ticket 01; BUILD-MAP §3.8, mockup
// 620–645): a Plan's name, Exam, access period and price, Best value and On
// sale, with a live preview of the Plan as the Member Plans page shows it. A
// Plan always unlocks all of its Exam's content (ADR 0010), so there are no
// "Unlocks" to tick, and Courses aren't sold until Phase 5.

export interface PlanEditorActions {
  add: AdminAction<AdminPlan>;
  save: AdminAction<AdminPlan>;
  remove: AdminAction<Plan>;
}

type Exams = AdminPlans["exams"];

const INVALID = "FIX THE FIELDS MARKED IN RED";
const PRICE_NOTE =
  "Price changes apply to new purchases only. Members who already paid keep what they bought.";
/** What every Plan unlocks: all of its Exam's study content (ADR 0010). */
const UNLOCKS = ["Flashcards", "Practice quizzes", "Reviewer PDFs"];

/** Pure: a saved Plan's form, with its id, which Save sends with the fields. */
const savedFormValues = (plan: Plan): PlanFormValues & { id: string } => ({
  id: plan.id,
  ...planFormValues(plan),
});

/** Pure: the save-state line after a save: live on the Plans page, or not on sale. */
const savedMessage = (onSale: boolean) =>
  onSale ? "✓ SAVED · LIVE ON THE PLANS PAGE" : "✓ SAVED · NOT ON SALE";

/** The form's fields and its preview, shared by a new Plan's editor and an existing one's. */
function PlanFields({
  form,
  exams,
  isNew,
}: {
  form: ReturnType<typeof useAdminForm<PlanFormValues, AdminPlan>>;
  exams: Exams;
  isNew: boolean;
}) {
  const { values, change } = form;

  function changeExam(examCode: string) {
    // A new Plan still named after its Exam follows the Exam picked.
    if (isNew && values.name === defaultPlanName(values.examCode)) {
      change("name", defaultPlanName(examCode));
    }
    change("examCode", examCode);
  }

  return (
    <>
      <AdminTextField
        label="PLAN NAME"
        {...form.text("name")}
        error={form.fieldError("name")}
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-2.5">
        <SelectField
          label="EXAM"
          value={values.examCode}
          options={exams.map(({ code, name }) => ({ value: code, label: `${code} · ${name}` }))}
          onChange={changeExam}
          error={form.fieldError("examCode")}
        />
        <SelectField
          label="ACCESS PERIOD"
          value={values.days}
          options={PLAN_DAYS.map((days) => ({
            value: String(days),
            label: accessPeriodLabel(days),
          }))}
          onChange={(days) => change("days", days)}
          error={form.fieldError("days")}
        />
      </div>
      <AdminTextField
        label="PRICE · WHOLE PESOS"
        {...form.text("price")}
        error={form.fieldError("price")}
        inputMode="numeric"
        autoComplete="off"
        placeholder="1,299"
      />
      <ToggleRow label="Mark as best value" hint="Clears it from this Exam’s other Plans.">
        {(ids) => (
          <AdminSwitch
            checked={values.bestValue}
            onCheckedChange={(on) => change("bestValue", on)}
            {...ids}
          />
        )}
      </ToggleRow>
      <ToggleRow label="On sale" hint="Off hides it from Plans. Current buyers keep access.">
        {(ids) => (
          <AdminSwitch
            checked={values.onSale}
            onCheckedChange={(on) => change("onSale", on)}
            {...ids}
          />
        )}
      </ToggleRow>
      <PlanPreview values={values} />
      <p className="text-xs leading-[1.45] text-muted-foreground">{PRICE_NOTE}</p>
    </>
  );
}

/** The Plan as the Member Plans page will show it, from the form as it's typed (mockup 637–643). */
function PlanPreview({ values }: { values: PlanFormValues }) {
  const headingId = useId();
  const days = Number(values.days);
  const period = isPlanDays(days) ? days : null;
  const price = previewPrice(values.price);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t-[1.5px] pt-3">
      <h3
        id={headingId}
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        PREVIEW · MEMBER PLANS PAGE
      </h3>
      <div
        className={cn(
          "relative flex flex-col gap-2 border-[1.5px] bg-white p-4",
          "shadow-hard-md",
          values.bestValue && "shadow-ayc-orange",
        )}
      >
        {values.bestValue ? (
          <span className="absolute -top-2.75 right-3 border-[1.5px] bg-ayc-orange px-1.75 py-1.25 font-mono text-[10px] leading-none font-bold text-ayc-navy">
            BEST VALUE
          </span>
        ) : null}
        {period ? (
          <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            {planPreviewTag(values.examCode, period)}
          </span>
        ) : null}
        <span className="text-lg font-extrabold break-words">
          {values.name.trim() || "Plan name"}
        </span>
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-black tracking-[-0.02em]">
            {price === null ? "₱—" : formatPeso(price)}
          </span>
          {period ? (
            <span className="text-[13px] text-muted-foreground">{perMonthText(price, period)}</span>
          ) : null}
        </span>
        <ul className="flex flex-col gap-1 text-[13px]">
          {UNLOCKS.map((unlock) => (
            <li key={unlock} className="flex gap-2">
              <span aria-hidden="true" className="font-bold text-ayc-success">
                ✓
              </span>
              {unlock}
            </li>
          ))}
        </ul>
        <span className="font-mono text-[11px] text-muted-foreground">
          DOESN’T RENEW AUTOMATICALLY · PAID THROUGH PAYMONGO
        </span>
      </div>
    </section>
  );
}

const editorLabel = "font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue";

interface NewPlanProps {
  exams: Exams;
  /** The Exam the new Plan starts on: the chip picked, or the first Exam. */
  examCode: string;
  actions: PlanEditorActions;
  onAdded: (plan: AdminPlan) => void;
}

/** "+ New plan": a new Plan's editor. Once added, it opens in its own editor. */
export function NewPlan({ exams, examCode, actions, onAdded }: NewPlanProps) {
  const form = useAdminForm<PlanFormValues, AdminPlan>({
    action: actions.add,
    initialValues: newPlanFormValues(examCode),
    // A new Plan has no stamp: the seam runs no conflict check on it.
    savedAt: new Date(0).toISOString(),
    valuesFrom: planFormValues,
    onSaved: onAdded,
    title: "The new plan",
    invalidMessage: INVALID,
  });
  return (
    <form {...form.formProps} aria-label="New plan" className="flex flex-col gap-3">
      <span className={editorLabel}>NEW PLAN</span>
      <PlanFields form={form} exams={exams} isNew />
      <EditorSaveRow
        saveLabel="Add plan"
        savedMessage={savedMessage(form.values.onSale)}
        form={form}
      />
    </form>
  );
}

interface EditPlanProps {
  opened: AdminPlan;
  exams: Exams;
  /** The Exam chip the list shows, so Delete goes back to it. */
  examChip: string | null;
  actions: PlanEditorActions;
  /** What adding it saved, so a Plan just added opens saying "✓ SAVED". */
  savedOnOpen?: AdminPlan;
}

/** A Plan's editor, with Delete. Each save runs the conflict check against its stamp. */
export function EditPlan({ opened, exams, examChip, actions, savedOnOpen }: EditPlanProps) {
  const router = useRouter();
  const form = useAdminForm<PlanFormValues, AdminPlan>({
    action: actions.save,
    initialValues: savedFormValues(opened),
    savedAt: opened.stamp.savedAt,
    valuesFrom: savedFormValues,
    // The list beside it, and the other Plans a Best value cleared, read again.
    onSaved: () => router.refresh(),
    savedOnOpen,
    title: opened.name,
    invalidMessage: INVALID,
  });
  const title = `${opened.name} · ${periodLabel(opened.days)}`;
  return (
    <form {...form.formProps} aria-label="Edit plan" className="flex flex-col gap-3">
      <span className={editorLabel}>EDIT PLAN</span>
      {form.conflict ? <ConflictNotice {...form.conflict} what="this Plan" /> : null}
      <PlanFields form={form} exams={exams} isNew={false} />
      <EditorSaveRow
        saveLabel="Save"
        savedMessage={savedMessage(form.values.onSale)}
        form={form}
        extra={
          <ConfirmDelete
            label="Delete plan"
            buttonClassName="min-h-10.5 cursor-pointer border-[1.5px] border-destructive px-3.5 text-sm font-bold text-destructive hover:bg-destructive/10"
            tag="DELETE PLAN"
            title={`Delete “${title}”?`}
            description="Members stop seeing it. A Plan that has had an Order can’t be deleted: switch it off instead."
            confirmLabel="Delete plan"
            send={() => callAdminAction(actions.remove, { input: { id: opened.id } })}
            onDeleted={() =>
              router.replace(plansHref({ exam: examChip, plan: null }), { scroll: false })
            }
          />
        }
      />
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { type ComponentProps, type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminDialog,
  AdminDialogButton,
  AdminDialogButtons,
} from "@/components/admin/admin-dialog";
import { AdminSwitch } from "@/components/admin/admin-switch";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import {
  PanelSection,
  SelectField,
  TextField,
  ToggleRow,
} from "@/components/admin/products/product-fields";
import { SaveState } from "@/components/admin/save-state";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { ReviewCard } from "@/components/website/review-card";
import { MARKETPLACES } from "@/content/website";
import type { AdminAction } from "@/lib/admin/action";
import { reviewDeleteCopy } from "@/lib/admin/review-delete";
import {
  newReviewForm,
  productOptionLabel,
  reviewFormValues,
  reviewPreview,
  variationChoices,
} from "@/lib/admin/review-form";
import { pinnedOnHomeLine } from "@/lib/admin/review-list";
import { cn } from "@/lib/utils";
import type { NewReviewForm, ReviewForm } from "@/services/admin.schema";
import type {
  AdminReview,
  DeletedReview,
  ReviewDeletePreview,
  ReviewProductOption,
} from "@/services/admin.types";
import type { Review } from "@/services/catalogue.types";

import { ReviewPinSwitch } from "./review-pin-switch";

// ─────────────────────────────────────────────────────────────────────────────
// The Review editor (mockup 261–276; BUILD-MAP §3.4, Editor). Every field is
// saved together with the conflict check, except "Pin on Home" on an existing
// Review: that's a single toggle, which saves at once (spec, Phase 2 →
// Conflict check). PREVIEW is the Website's own Review card, so it shows the
// Review as the Website will.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewEditorActions {
  save: AdminAction<AdminReview>;
  add: AdminAction<AdminReview>;
  remove: AdminAction<DeletedReview>;
  /** What deleting a Review takes with it, read as the dialog opens. */
  countDelete: AdminAction<ReviewDeletePreview>;
  setPin: AdminAction<AdminReview>;
}

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const INVALID = "FIX THE FIELDS MARKED IN RED";

/** A new Review has never been saved, so no save can be newer than the form. */
const NEVER_SAVED = new Date(0).toISOString();

const MARKETPLACE_OPTIONS = MARKETPLACES.map(({ id, name }) => ({ value: id, label: name }));

/** What the shared fields need from the form. */
interface FieldsForm {
  values: ReviewForm;
  change: (path: string, value: unknown) => void;
  fieldError: (path: string) => string | undefined;
}

interface EditReviewProps {
  opened: AdminReview;
  products: ReviewProductOption[];
  deletePreview: ReviewDeletePreview;
  /** How many Reviews are pinned on Home, for "N OF 9 PINNED ON HOME". */
  pinnedCount: number;
  /** The list to go back to once it's deleted, with its filters. */
  listHref: string;
  actions: ReviewEditorActions;
  /** The Review as its "Add review" left it, when it was added just now. */
  savedOnOpen?: AdminReview;
}

/** An existing Review's editor, with Save review and Delete. */
export function EditReview({
  opened,
  products,
  deletePreview,
  pinnedCount,
  listHref,
  actions,
  savedOnOpen,
}: EditReviewProps) {
  const router = useRouter();
  const [stamp, setStamp] = useState(opened.stamp);
  const { review } = opened;
  const id = review.id;
  const form = useAdminForm({
    action: actions.save,
    initialValues: { id, ...reviewFormValues(review) },
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminReview) => ({ id, ...reviewFormValues(saved.review) }),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      // The list beside the editor shows the new stars, text and meta.
      router.refresh();
    },
    savedOnOpen,
    title: "This review",
    invalidMessage: INVALID,
  });

  return (
    <form aria-label="Edit review" className="flex min-w-0 flex-col gap-3" {...form.formProps}>
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">EDIT REVIEW</p>
      <ReviewFields
        form={form}
        products={products}
        saved={review}
        pin={
          <PinRow pinnedCount={pinnedCount}>
            {(ids) => (
              <ReviewPinSwitch
                reviewId={id}
                pinned={review.homePin !== null}
                action={actions.setPin}
                {...ids}
              />
            )}
          </PinRow>
        }
      />
      {form.conflict ? <ConflictNotice {...form.conflict} what="this Review" /> : null}
      <SaveRow
        saveLabel="Save review"
        form={form}
        extra={
          <DeleteReview id={id} preview={deletePreview} actions={actions} listHref={listHref} />
        }
      />
    </form>
  );
}

interface NewReviewProps {
  products: ReviewProductOption[];
  pinnedCount: number;
  actions: ReviewEditorActions;
  /** Called with the new Review once it's added. */
  onAdded: (added: AdminReview) => void;
}

/** "+ Add": a new Review's editor, for the first Live Product. */
export function NewReview({ products, pinnedCount, actions, onAdded }: NewReviewProps) {
  const form = useAdminForm({
    action: actions.add,
    initialValues: newReviewForm(products[0]?.id ?? ""),
    savedAt: NEVER_SAVED,
    valuesFrom: (saved: AdminReview): NewReviewForm => ({
      ...reviewFormValues(saved.review),
      pinned: saved.review.homePin !== null,
    }),
    onSaved: onAdded,
    title: "New review",
    invalidMessage: INVALID,
  });
  const { values } = form;

  return (
    <form aria-label="New review" className="flex min-w-0 flex-col gap-3" {...form.formProps}>
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">NEW REVIEW</p>
      <ReviewFields
        form={form}
        products={products}
        saved={null}
        pin={
          <PinRow pinnedCount={pinnedCount}>
            {(ids) => (
              <AdminSwitch
                checked={values.pinned}
                onCheckedChange={(on) => form.change("pinned", on)}
                {...ids}
              />
            )}
          </PinRow>
        }
      />
      <SaveRow saveLabel="Add review" form={form} />
    </form>
  );
}

/** "Pin on Home", with the counter under it, red above 9 (mockup 1165). */
function PinRow({
  pinnedCount,
  children,
}: {
  pinnedCount: number;
  children: ComponentProps<typeof ToggleRow>["children"];
}) {
  const line = pinnedOnHomeLine(pinnedCount);
  return (
    <ToggleRow
      label="Pin on Home"
      hint={line.text}
      hintClassName={line.over ? "text-destructive" : undefined}
    >
      {children}
    </ToggleRow>
  );
}

interface ReviewFieldsProps {
  form: FieldsForm;
  products: ReviewProductOption[];
  /** The Review as saved, for the variation it was copied with; null for a new one. */
  saved: Pick<Review, "productId" | "variation"> | null;
  /** The "Pin on Home" row. */
  pin: ReactNode;
}

/** Every field, in the mockup's order, then PREVIEW. */
function ReviewFields({ form, products, saved, pin }: ReviewFieldsProps) {
  const { values, change, fieldError } = form;
  const product = products.find((p) => p.id === values.productId);
  const choices = variationChoices(product, saved);
  const preview = reviewPreview(values, product);

  return (
    <>
      <StarsField
        stars={values.stars}
        onChange={(stars) => change("stars", stars)}
        error={fieldError("stars")}
      />
      <TextField
        label="REVIEW TEXT · COPY WORD FOR WORD"
        multiline
        placeholder="Paste the review exactly as written on the store"
        value={values.text}
        onChange={(text) => change("text", text)}
        error={fieldError("text")}
        inputClassName="min-h-27.5 leading-normal"
      />
      <SelectField
        label="PRODUCT"
        value={values.productId}
        options={products.map((p) => ({ value: p.id, label: productOptionLabel(p) }))}
        onChange={(productId) => {
          change("productId", productId);
          // A variation the new Product doesn't have goes back to Not specified.
          const next = variationChoices(
            products.find((p) => p.id === productId),
            saved,
          );
          if (values.variation && !next.includes(values.variation)) change("variation", "");
        }}
        error={fieldError("productId")}
      />
      <SelectField
        label="VARIATION BOUGHT · OPTIONAL"
        value={values.variation}
        options={[
          { value: "", label: "Not specified" },
          ...choices.map((choice) => ({ value: choice, label: choice })),
        ]}
        onChange={(variation) => change("variation", variation)}
        error={fieldError("variation")}
      />
      <div className="grid grid-cols-2 items-end gap-2.5">
        <SelectField
          label="STORE"
          value={values.marketplace}
          options={MARKETPLACE_OPTIONS}
          onChange={(marketplace) => change("marketplace", marketplace)}
          error={fieldError("marketplace")}
        />
        <TextField
          label="HELPFUL VOTES"
          inputMode="numeric"
          placeholder="0"
          value={values.helpful}
          onChange={(helpful) => change("helpful", helpful)}
          error={fieldError("helpful")}
        />
      </div>
      {pin}
      <PanelSection title="PREVIEW">
        {preview ? (
          <div className="px-1.5 pt-2.5 pb-1">
            <ReviewCard review={preview} tilt={-0.6} />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            The card preview appears once you paste the review.
          </p>
        )}
      </PanelSection>
    </>
  );
}

interface StarsFieldProps {
  stars: number;
  onChange: (stars: number) => void;
  error?: string;
}

/** STARS: five stars to click, 1 to 5 (mockup 263). They're radios, so arrow keys move between them. */
function StarsField({ stars, onChange, error }: StarsFieldProps) {
  const errorId = `${useId()}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-mono text-xs font-medium text-muted-foreground">STARS</legend>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={cn(
              "flex min-h-7.5 cursor-pointer items-center px-0.5 text-[26px] leading-none has-focus-visible:outline-2 has-focus-visible:outline-ayc-blue has-focus-visible:outline-solid",
              n <= stars ? "text-ayc-star" : "text-ayc-rule",
            )}
          >
            <input
              type="radio"
              name="stars"
              value={n}
              checked={n === stars}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{n === 1 ? "1 star" : `${n} stars`}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

interface SaveRowProps {
  saveLabel: string;
  form: Pick<ReturnType<typeof useAdminForm>, "status" | "errorMessage" | "canSave">;
  extra?: ReactNode;
}

/** Save, the save-state line, and Delete (mockup 274). */
function SaveRow({ saveLabel, form, extra }: SaveRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5">
      <button
        type="submit"
        disabled={!form.canSave}
        className="min-h-10.5 cursor-pointer border-[1.5px] bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-wait"
      >
        {saveLabel}
      </button>
      <div className="min-w-0 flex-1">
        <SaveState status={form.status} savedMessage={SAVED} errorMessage={form.errorMessage} />
      </div>
      {extra}
    </div>
  );
}

const ALREADY_DELETED = "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE";

interface DeleteReviewProps {
  id: string;
  /** The count as the page read it, until the dialog reads it again. */
  preview: ReviewDeletePreview;
  actions: Pick<ReviewEditorActions, "remove" | "countDelete">;
  listHref: string;
}

/**
 * Delete, and its confirmation (mockup 1574; BUILD-MAP §2, deleteReview),
 * which says how many FAQ quotes go with the Review. It isn't a typed-DELETE
 * dialog: the mockup asks only for a confirmation.
 */
function DeleteReview({ id, preview, actions, listHref }: DeleteReviewProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [counts, setCounts] = useState(preview);
  const [pending, startTransition] = useTransition();
  const copy = reviewDeleteCopy(counts);

  /** Reads the count again, so an FAQ that quoted the Review since the page loaded is counted. */
  function openDialog() {
    setError(undefined);
    setOpen(true);
    startTransition(async () => {
      const state = await callAdminAction(actions.countDelete, { input: { id } });
      if (state.status === "saved") setCounts(state.value);
      else if (state.status === "refused" && state.error.kind === "not-found") {
        setError(ALREADY_DELETED);
      }
    });
  }

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(actions.remove, { input: { id } });
      if (state.status === "saved") {
        setOpen(false);
        toast("✓ DELETED · THE REVIEW IS OFF THE SITE");
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
        onClick={openDialog}
        className="min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
      >
        Delete
      </button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        tag="DELETE REVIEW"
        tone="danger"
        title={copy.title}
        description={copy.body}
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
            Delete review
          </AdminDialogButton>
        </AdminDialogButtons>
      </AdminDialog>
    </>
  );
}

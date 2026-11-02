"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { SaveState } from "@/components/admin/save-state";
import { TypedDeleteDialog } from "@/components/admin/typed-delete-dialog";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { ProductImage } from "@/components/website/product-image";
import type { AdminAction } from "@/lib/admin/action";
import { productDeleteCopy } from "@/lib/admin/product-delete";
import {
  generatedProductCopy,
  newProductForm,
  productFormValues,
  renameVariation,
  subjectsOnExam,
} from "@/lib/admin/product-form";
import { productListHref } from "@/lib/admin/product-list";
import { formatAsOfDate } from "@/lib/admin/time";
import { productFormatLabel } from "@/lib/catalogue/format";
import { variationLabel } from "@/lib/catalogue/price";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import {
  type NewProductForm,
  PHOTO_TO_GO_LIVE,
  type ProductForm,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
} from "@/services/admin.schema";
import type {
  AdminProduct,
  AdminProductList,
  AdminProductRow,
  DeletedProduct,
  ProductDeletePreview,
} from "@/services/admin.types";
import { PRODUCT_FORMATS } from "@/services/catalogue.schema";
import type { Exam, Marketplace, ProductPhoto } from "@/services/catalogue.types";

import { ProductFlagSwitch } from "./product-flag-switch";
import { ChipsField, PanelSection, SelectField, TextField, ToggleRow } from "./product-fields";

// ─────────────────────────────────────────────────────────────────────────────
// The Product editor (mockup 177–228; BUILD-MAP §3.3, Editor panel). Every
// field is saved together with the conflict check, except "Show on website"
// and "Available in app" on an existing Product: those are single toggles,
// which save at once (spec, Phase 2 → Conflict check). Coming Soon hides the
// sale fields, which a Coming Soon Product doesn't have. Blank text fields
// show the text the Website generates in their place. Photos are shown here
// and edited in ticket 06.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductEditorActions {
  save: AdminAction<AdminProduct>;
  add: AdminAction<AdminProduct>;
  remove: AdminAction<DeletedProduct>;
  /** What deleting a Product takes with it, read as the dialog opens. */
  countDelete: AdminAction<ProductDeletePreview>;
  setFlag: AdminAction<AdminProductRow>;
}

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const INVALID = "FIX THE FIELDS MARKED IN RED";

const FORMAT_OPTIONS = PRODUCT_FORMATS.map((format) => ({
  value: format,
  label: productFormatLabel(format),
}));

/** VISIBILITY's single-toggle rows (mockup 220–221). */
const FLAG_ROWS = [
  {
    flag: "availableInApp",
    label: "Available in app",
    hint: "Shows the IN APP tag and “See plans” on the site",
  },
  {
    flag: "showOnWebsite",
    label: "Show on website",
    hint: "Off hides it from Products, exam pages, and Home",
  },
] as const;

/** A new Product has never been saved, so no save can be newer than the form. */
const NEVER_SAVED = new Date(0).toISOString();

/** The form's fields that hold text, as opposed to lists, flags and groups. */
type TextPath = {
  [K in keyof ProductForm]: ProductForm[K] extends string ? K : never;
}[keyof ProductForm];

const STORES: { marketplace: Marketplace; label: string; placeholder: string }[] = [
  { marketplace: "shopee", label: "SHOPEE", placeholder: "Paste Shopee product link" },
  { marketplace: "lazada", label: "LAZADA", placeholder: "Paste Lazada product link (optional)" },
  {
    marketplace: "tiktok",
    label: "TIKTOK SHOP",
    placeholder: "Paste TikTok Shop product link (optional)",
  },
];

/** What the shared fields need from the form. */
interface FieldsForm {
  values: ProductForm;
  change: (path: string, value: unknown) => void;
  fieldError: (path: string) => string | undefined;
}

interface EditProductProps {
  opened: AdminProduct;
  exams: Exam[];
  deletePreview: ProductDeletePreview;
  listQuery: AdminProductList["query"];
  actions: ProductEditorActions;
  /** The Product as its "Add product" left it, when it was added just now. */
  savedOnOpen?: AdminProduct;
}

/** An existing Product's editor, with Save product and Delete. */
export function EditProduct({
  opened,
  exams,
  deletePreview,
  listQuery,
  actions,
  savedOnOpen,
}: EditProductProps) {
  const router = useRouter();
  const [stamp, setStamp] = useState(opened.stamp);
  const id = opened.product.id;
  const form = useAdminForm({
    action: actions.save,
    initialValues: { id, ...productFormValues(opened.product) },
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminProduct) => ({ id, ...productFormValues(saved.product) }),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      // The list beside the editor shows the new name, price and figures.
      router.refresh();
    },
    savedOnOpen,
    title: opened.product.shortName,
    invalidMessage: INVALID,
  });
  const { product } = opened;

  return (
    <form
      aria-label={`Edit ${product.shortName}`}
      className="flex min-w-0 flex-col gap-3"
      {...form.formProps}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
          EDIT · {form.values.shortName.trim().toUpperCase() || product.shortName.toUpperCase()}
        </p>
        {/* A hidden Product's page answers 404, so there's nothing to view. */}
        {product.showOnWebsite ? (
          <a
            href={paths.products.details(product.slug)}
            target="_blank"
            rel="noopener"
            className="text-xs font-semibold text-ayc-blue hover:underline"
          >
            View page ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
      <ProductFields
        form={form}
        exams={exams}
        photos={product.photos}
        slug={product.slug}
        figuresAsOf={product.shopee?.asOf ?? null}
        flags={
          <>
            {FLAG_ROWS.map(({ flag, label, hint }) => (
              <ToggleRow key={flag} label={label} hint={hint}>
                {() => (
                  <ProductFlagSwitch
                    productId={id}
                    flag={flag}
                    checked={product[flag]}
                    label={label}
                    title={product.shortName}
                    action={actions.setFlag}
                  />
                )}
              </ToggleRow>
            ))}
            <p className="text-xs text-muted-foreground">
              These two save as soon as you switch them.
            </p>
          </>
        }
      />
      {form.conflict ? <ConflictNotice {...form.conflict} what="this Product" /> : null}
      <SaveRow
        saveLabel="Save product"
        form={form}
        extra={
          <DeleteProduct
            id={id}
            shortName={product.shortName}
            examCode={product.examCode}
            preview={deletePreview}
            actions={actions}
            listHref={productListHref(listQuery)}
          />
        }
      />
    </form>
  );
}

interface NewProductProps {
  exams: Exam[];
  actions: ProductEditorActions;
  /** Called with the new Product once it's added. */
  onAdded: (added: AdminProduct) => void;
}

/** "+ Add product": a new Product's editor. */
export function NewProduct({ exams, actions, onAdded }: NewProductProps) {
  const form = useAdminForm({
    action: actions.add,
    initialValues: newProductForm(exams[0]?.code ?? ""),
    savedAt: NEVER_SAVED,
    valuesFrom: (saved: AdminProduct): NewProductForm => ({
      ...productFormValues(saved.product),
      showOnWebsite: saved.product.showOnWebsite,
      availableInApp: saved.product.availableInApp,
    }),
    onSaved: onAdded,
    title: "New product",
    invalidMessage: INVALID,
  });
  const { values } = form;

  return (
    <form aria-label="New product" className="flex min-w-0 flex-col gap-3" {...form.formProps}>
      <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">NEW PRODUCT</p>
      <ProductFields
        form={form}
        exams={exams}
        photos={[]}
        slug={null}
        figuresAsOf={null}
        flags={FLAG_ROWS.map(({ flag, label, hint }) => (
          <ToggleRow key={flag} label={label} hint={hint}>
            {(ids) => (
              <AdminSwitch
                checked={values[flag]}
                onCheckedChange={(on) => form.change(flag, on)}
                {...ids}
              />
            )}
          </ToggleRow>
        ))}
      />
      <SaveRow saveLabel="Add product" form={form} />
    </form>
  );
}

interface SaveRowProps {
  saveLabel: string;
  form: Pick<ReturnType<typeof useAdminForm>, "status" | "errorMessage" | "canSave">;
  extra?: ReactNode;
}

/** Save, the save-state line, and Delete (mockup 223–227). */
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

interface ProductFieldsProps {
  form: FieldsForm;
  exams: Exam[];
  photos: ProductPhoto[];
  /** The page address, fixed once the Product is added; null for a new one. */
  slug: string | null;
  figuresAsOf: string | null;
  /** VISIBILITY's "Available in app" and "Show on website" rows. */
  flags: ReactNode;
}

/** Every field but the flags' switches, in the mockup's order. */
function ProductFields({ form, exams, photos, slug, figuresAsOf, flags }: ProductFieldsProps) {
  const { values, change, fieldError } = form;
  const exam = exams.find((e) => e.code === values.examCode);
  const generated = generatedProductCopy(values, exam);
  const text = (path: TextPath) => ({
    value: values[path],
    onChange: (value: string) => change(path, value),
    error: fieldError(path),
  });

  return (
    <>
      <Photos photos={photos} />
      <TextField label="FULL NAME" {...text("title")} />
      <div className="grid grid-cols-2 items-end gap-2.5">
        <TextField label="SHORT NAME · FOR CARDS" {...text("shortName")} />
        <TextField label="EDITION" {...text("edition")} />
      </div>
      <div className="grid grid-cols-2 items-end gap-2.5">
        <SelectField
          label="EXAM"
          value={values.examCode}
          options={exams.map((e) => ({ value: e.code, label: `${e.code} · ${e.board}` }))}
          onChange={(code) => {
            change("examCode", code);
            // A Subject that isn't on the new Exam is dropped (the seam refuses one).
            change(
              "subjectCodes",
              subjectsOnExam(
                values.subjectCodes,
                exams.find((e) => e.code === code),
              ),
            );
          }}
          error={fieldError("examCode")}
        />
        <SelectField
          label="FORMAT"
          value={values.format}
          options={FORMAT_OPTIONS}
          onChange={(format) => change("format", format)}
          error={fieldError("format")}
        />
      </div>
      <TextField label="SIZE & PAPER" {...text("size")} />
      <ChipsField
        label="SUBJECTS COVERED"
        options={exam?.subjects.map((subject) => subject.code) ?? []}
        chosen={values.subjectCodes}
        onChange={(codes) => change("subjectCodes", codes)}
        error={fieldError("subjectCodes")}
      />

      {values.comingSoon ? null : (
        <PanelSection title="PRICE & VARIATIONS">
          <div className="grid grid-cols-2 items-end gap-2.5">
            <TextField label="PRICE FROM" inputMode="decimal" {...text("priceFrom")} />
            <TextField label="PRICE UP TO · OPTIONAL" inputMode="decimal" {...text("priceTo")} />
          </div>
          <Variations form={form} />
          <ShopeeFigures form={form} asOf={figuresAsOf} />
        </PanelSection>
      )}

      <PanelSection title="PRODUCT PAGE TEXT">
        <TextField
          label="WHAT’S INSIDE"
          multiline
          placeholder={generated?.whatsInside}
          {...text("whatsInside")}
        />
        <TextField
          label="MADE FOR · ONE PER LINE"
          multiline
          placeholder={generated?.madeFor.join("\n")}
          {...text("madeFor")}
        />
      </PanelSection>

      {values.comingSoon ? null : (
        <PanelSection title="STORE LINKS">
          {STORES.map(({ marketplace, label, placeholder }) => {
            const path = `listings.${marketplace}`;
            const link = values.listings[marketplace];
            const empty = link.trim() === "";
            return (
              <TextField
                key={marketplace}
                label={`${label} · ${empty ? "USING SHOP PAGE" : "PRODUCT LINK"}`}
                labelClassName={empty ? "text-ayc-warning" : undefined}
                inputClassName={cn(
                  "font-mono text-xs",
                  empty && "border-dashed border-ayc-warning",
                )}
                inputMode="url"
                placeholder={placeholder}
                value={link}
                onChange={(value) => change(path, value)}
                error={fieldError(path)}
              />
            );
          })}
          <p className="text-xs leading-[1.45] text-muted-foreground">
            Leave a link empty and the button opens that store’s shop page (set in Settings).
          </p>
        </PanelSection>
      )}

      <PanelSection title="SEARCH & AI VISIBILITY">
        <SeoField
          label="PAGE TITLE"
          max={SEO_TITLE_MAX}
          generated={generated?.seoTitle ?? ""}
          {...text("seoTitle")}
        />
        <SeoField
          label="META DESCRIPTION"
          max={SEO_DESCRIPTION_MAX}
          generated={generated?.seoDescription ?? ""}
          multiline
          {...text("seoDescription")}
        />
        {slug ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            PAGE ADDRESS · aceyourcourse.ph{paths.products.details(slug)}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            PAGE ADDRESS · SET FROM THE FULL NAME WHEN YOU ADD IT
          </p>
        )}
        <p className="text-xs leading-[1.45] text-muted-foreground">
          Product data, price, and rating for search engines are added automatically.
        </p>
      </PanelSection>

      <PanelSection title="VISIBILITY">
        <ToggleRow
          label="Coming Soon"
          hint="Announced, not out yet: no price, store buttons or Shopee figures"
        >
          {(ids) => (
            <AdminSwitch
              checked={values.comingSoon}
              onCheckedChange={(on) => change("comingSoon", on)}
              {...ids}
            />
          )}
        </ToggleRow>
        <ToggleRow label="Deal" hint="Shows “Shopee: any 2 enjoy 4% off” on the site">
          {(ids) => (
            <AdminSwitch
              checked={values.deal}
              onCheckedChange={(on) => change("deal", on)}
              {...ids}
            />
          )}
        </ToggleRow>
        {flags}
      </PanelSection>
    </>
  );
}

/** PHOTOS · FIRST IS THE COVER (mockup 179–183). Editing them is ticket 06. */
function Photos({ photos }: { photos: ProductPhoto[] }) {
  const note =
    photos.length === 0
      ? PHOTO_TO_GO_LIVE
      : `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-xs font-medium text-muted-foreground">
        PHOTOS · FIRST IS THE COVER
      </span>
      <div className="grid grid-cols-5 gap-1.5">
        {photos.slice(0, 4).map((photo, index) => (
          <span
            key={photo.src}
            className={cn(
              "relative aspect-square overflow-hidden bg-ayc-sand",
              index === 0 ? "border-2 border-ayc-blue" : "border",
            )}
          >
            <ProductImage photo={photo} sizes="64px" />
          </span>
        ))}
        <span
          aria-hidden="true"
          className="flex aspect-square items-center justify-center border-[1.5px] border-dashed text-lg font-bold text-muted-foreground"
        >
          +
        </span>
      </div>
      <p
        className={cn(
          "text-xs",
          photos.length === 0 ? "text-ayc-warning" : "text-muted-foreground",
        )}
      >
        {note}
      </p>
    </div>
  );
}

/** VARIATIONS: name and price rows with ×, and "+ Add variation" (mockup 193–197). */
function Variations({ form }: { form: FieldsForm }) {
  const { values, change, fieldError } = form;
  const rows = values.variations;
  // Each row's key, kept beside the values so a removed row takes its own
  // inputs with it. The values are what's saved, so they carry no keys.
  const nextKey = useRef(0);
  const newKey = () => nextKey.current++;
  const [keys, setKeys] = useState(() => rows.map(newKey));
  const rowKeys =
    keys.length === rows.length ? keys : rows.map((_, index) => keys[index] ?? -index - 1);

  function set(next: ProductForm["variations"], nextKeys: number[]) {
    setKeys(nextKeys);
    change("variations", next);
  }
  const edit = (index: number, edited: ProductForm["variations"][number]) =>
    set(
      rows.map((row, i) => (i === index ? edited : row)),
      rowKeys,
    );

  return (
    <div className="flex flex-col gap-1.5">
      {rows.length > 0 ? (
        <span className="font-mono text-xs font-medium text-muted-foreground">VARIATIONS</span>
      ) : null}
      {rows.map((variation, index) => {
        const label = variationLabel(variation.name);
        return (
          <div
            key={rowKeys[index]}
            className="grid grid-cols-[minmax(0,1fr)_96px_24px] items-start gap-1.5"
          >
            <TextField
              label={<span className="sr-only">Variation {index + 1} name</span>}
              value={label}
              onChange={(name) =>
                edit(index, { ...variation, name: renameVariation(variation.name, name) })
              }
              error={fieldError(`variations.${index}.name`)}
              className="gap-0"
              inputClassName="text-[13px]"
            />
            <TextField
              label={<span className="sr-only">Variation {index + 1} price</span>}
              inputMode="decimal"
              value={variation.price}
              onChange={(price) => edit(index, { ...variation, price })}
              error={fieldError(`variations.${index}.price`)}
              className="gap-0"
              inputClassName="text-[13px]"
            />
            <button
              type="button"
              aria-label={`Remove variation ${label || index + 1}`}
              onClick={() =>
                set(
                  rows.filter((_, i) => i !== index),
                  rowKeys.filter((_, i) => i !== index),
                )
              }
              className="min-h-10 cursor-pointer text-center font-bold text-destructive"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => set([...rows, { name: "", price: "" }], [...rowKeys, newKey()])}
        className="min-h-8.5 cursor-pointer self-start border-[1.5px] border-dashed px-3 text-[13px] font-semibold hover:bg-ayc-sand"
      >
        + Add variation
      </button>
    </div>
  );
}

/** RATING, NO. OF RATINGS and UNITS SOLD, all or none (mockup 199–201). */
function ShopeeFigures({ form, asOf }: { form: FieldsForm; asOf: string | null }) {
  const { values, change, fieldError } = form;
  const figure = (field: keyof ProductForm["shopee"]) => ({
    value: values.shopee[field],
    onChange: (value: string) => change(`shopee.${field}`, value),
    error: fieldError(`shopee.${field}`),
  });
  return (
    <>
      <div className="grid grid-cols-3 items-end gap-2.5">
        <TextField label="RATING" inputMode="decimal" {...figure("rating")} />
        <TextField label="NO. OF RATINGS" inputMode="numeric" {...figure("ratingCount")} />
        <TextField label="UNITS SOLD" inputMode="numeric" {...figure("unitsSold")} />
      </div>
      <p className="text-xs leading-[1.45] text-muted-foreground">
        Copy these from the Shopee listing. Best sellers on Home are ranked by units sold.
      </p>
      {asOf ? (
        <p className="font-mono text-[11px] text-muted-foreground">AS OF {formatAsOfDate(asOf)}</p>
      ) : null}
    </>
  );
}

interface SeoFieldProps {
  label: string;
  max: number;
  /** The text the Website uses while this is blank: the placeholder. */
  generated: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  multiline?: boolean;
}

/** A search field with its live counter (mockup 210–211): the typed text, or the generated text. */
function SeoField({ label, max, generated, value, onChange, error, multiline }: SeoFieldProps) {
  const counterId = useId();
  const length = (value.trim() || generated).length;
  const colour =
    length > max
      ? "text-destructive"
      : length < max * 0.4
        ? "text-ayc-warning"
        : "text-ayc-success";
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      multiline={multiline}
      placeholder={generated}
      describedBy={counterId}
      inputClassName={cn("text-[13px]", multiline && "min-h-14")}
      aside={
        <span id={counterId} className={cn("font-mono text-xs font-medium", colour)}>
          {length} / {max}
          <span className="sr-only"> characters</span>
        </span>
      }
    />
  );
}

interface DeleteProductProps {
  id: string;
  shortName: string;
  examCode: string;
  /** The counts as the page read them, until the dialog reads them again. */
  preview: ProductDeletePreview;
  actions: Pick<ProductEditorActions, "remove" | "countDelete">;
  /** The list to go back to, with its filters. */
  listHref: string;
}

/** Delete, and its typed-DELETE dialog with exact counts (mockup 1569; spec, Phase 2 → Deleting). */
const ALREADY_DELETED = "IT’S ALREADY BEEN DELETED · RELOAD THE PAGE";

function DeleteProduct({
  id,
  shortName,
  examCode,
  preview,
  actions,
  listHref,
}: DeleteProductProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [counts, setCounts] = useState(preview);
  const [pending, startTransition] = useTransition();
  const copy = productDeleteCopy(shortName, examCode, counts);

  /** Reads the counts again, so a Review added since the page loaded is counted. */
  function openDialog() {
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
        toast(`✓ DELETED · ${shortName.toUpperCase()}`);
        router.replace(listHref, { scroll: false });
      } else if (state.status === "failed") {
        setError("COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN");
      } else if (state.status === "refused") {
        setError(
          state.error.kind === "not-found"
            ? ALREADY_DELETED
            : state.error.kind === "forbidden"
              ? state.error.message
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
      <TypedDeleteDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(undefined);
        }}
        tag="DELETE PRODUCT"
        title={copy.title}
        description={copy.body}
        confirmLabel="Delete product"
        onConfirm={confirm}
        pending={pending}
        error={error}
      />
    </>
  );
}

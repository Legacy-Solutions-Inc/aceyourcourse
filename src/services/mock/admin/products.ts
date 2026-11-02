import { uniqueSlug } from "@/lib/admin/slug";
import { resolveStoreLink } from "@/lib/catalogue/store-links";
import { manilaDate } from "@/lib/manila-time";
import {
  type NewProductForm,
  newProductFormSchema,
  PHOTO_TO_GO_LIVE,
  type ProductFlags,
  productFlagsSchema,
  type ProductForm,
  productFormSchema,
  productIdInputSchema,
  type ProductInput,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminProduct,
  AdminProductList,
  AdminProductRow,
  AdminResult,
  DeletedProduct,
  ProductDeletePreview,
  ProductListQuery,
  RecordStamp,
  StaffActor,
  StoreLinkStatus,
} from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { Exam, Marketplace, Product, ShopeeFigures } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Products area: the Products list, with
// every Product, Coming Soon and hidden ones included, its inline "Show on
// website" and "Available in app" toggles, and the Product editor. Each
// Product is its own record, with its own stamp for the editor's conflict
// check. The two toggles are single toggles, which always save (spec, Phase 2
// → Conflict check), so they have a stamp of their own: a toggle never makes
// an open editor's save a conflict, and the editor's save never sends them.

/** A Product's record key, for the stamp its editor checks. */
const recordOf = (id: string) => `product:${id}`;

/** The record key of a Product's two single toggles. */
const flagsRecordOf = (id: string) => `product:${id}:flags`;

/** Pure: where each of the Product's store buttons goes, as the S/L/T badges show it. */
function storeLinksOf(
  product: Product,
  shopLinks: ShopLinks,
): Record<Marketplace, StoreLinkStatus> {
  const status = (marketplace: Marketplace): StoreLinkStatus => {
    const link = resolveStoreLink(product, marketplace, shopLinks);
    if (!link) return "none";
    return link.link === "listing" ? "product" : "shop";
  };
  return { shopee: status("shopee"), lazada: status("lazada"), tiktok: status("tiktok") };
}

type ShopLinks = CatalogueSeed["settings"]["shopLinks"];

function rowOf(product: Product, shopLinks: ShopLinks, stamp: RecordStamp): AdminProductRow {
  return structuredClone({
    id: product.id,
    slug: product.slug,
    title: product.title,
    shortName: product.shortName,
    examCode: product.examCode,
    format: product.format,
    state: product.state,
    priceFrom: product.priceFrom,
    priceTo: product.priceTo,
    unitsSold: product.shopee?.unitsSold ?? null,
    cover: product.photos[0] ?? null,
    storeLinks: storeLinksOf(product, shopLinks),
    showOnWebsite: product.showOnWebsite,
    availableInApp: product.availableInApp,
    stamp,
  });
}

/** Live first, by units sold and then title; then Coming Soon, by title. */
function compareRows(a: AdminProductRow, b: AdminProductRow): number {
  const comingSoon = (row: AdminProductRow) => (row.state === "coming-soon" ? 1 : 0);
  return (
    comingSoon(a) - comingSoon(b) ||
    (b.unitsSold ?? -1) - (a.unitsSold ?? -1) ||
    a.title.localeCompare(b.title, "en")
  );
}

/**
 * At least one Marketplace's button opens the shop page. Never a Coming Soon
 * Product, which has no store buttons at all.
 */
const isMissingLinks = (row: AdminProductRow) => Object.values(row.storeLinks).includes("shop");

export async function listProductsForAdmin(
  _actor: StaffActor,
  query: ProductListQuery,
): Promise<AdminProductList> {
  const store = getSampleStore();
  const { exams, products } = store.catalogue;

  const q = query.q?.trim() || null;
  const search = q?.toLowerCase();
  const exam = exams.find((e) => e.code === query.exam?.trim().toUpperCase())?.code ?? null;
  const missing = query.missing === true;

  const rows = products
    .map((product) =>
      rowOf(product, store.catalogue.settings.shopLinks, stampOf(store, recordOf(product.id))),
    )
    .filter(
      (row) =>
        (!exam || row.examCode === exam) &&
        (!search ||
          row.title.toLowerCase().includes(search) ||
          row.shortName.toLowerCase().includes(search)) &&
        (!missing || isMissingLinks(row)),
    )
    .sort(compareRows);

  return {
    rows,
    query: { q, exam, missing },
    examCodes: exams.map((e) => e.code),
    total: products.length,
  };
}

const flagsOf = (product: Product | undefined) =>
  product ? { showOnWebsite: product.showOnWebsite, availableInApp: product.availableInApp } : null;

export async function setProductFlags(
  actor: StaffActor,
  id: string,
  flags: ProductFlags,
): Promise<AdminResult<AdminProductRow>> {
  const find = (catalogue: CatalogueSeed) => catalogue.products.find((p) => p.id === id);
  // A single toggle always saves: no conflict check (spec, Phase 2 → Conflict check).
  return writeCatalogue(actor, flags, undefined, {
    role: "staff",
    schema: productFlagsSchema,
    record: flagsRecordOf(id),
    exists: (catalogue) => find(catalogue) !== undefined,
    activity: { entity: "product", entityId: id, action: "set-flags" },
    snapshot: (catalogue) => flagsOf(find(catalogue)),
    apply: (draft, update) => {
      const product = find(draft);
      if (!product) return;
      if (update.showOnWebsite !== undefined) product.showOnWebsite = update.showOnWebsite;
      if (update.availableInApp !== undefined) product.availableInApp = update.availableInApp;
    },
    result: (catalogue) => {
      const product = find(catalogue);
      if (!product) throw new Error(`Product ${id} vanished during its own save`);
      return rowOf(product, catalogue.settings.shopLinks, stampOf(getSampleStore(), recordOf(id)));
    },
    tags: [CATALOGUE_TAGS.products],
  });
}

// ── The Product editor ──────────────────────────────────────────────────────

const findProduct = (catalogue: CatalogueSeed, id: string) =>
  catalogue.products.find((p) => p.id === id);

const reviewsOf = (catalogue: CatalogueSeed, id: string) =>
  catalogue.reviews.filter((review) => review.productId === id);

/** The FAQs quoting one of these Reviews. */
const faqsQuoting = (catalogue: CatalogueSeed, reviewIds: ReadonlySet<string>) =>
  catalogue.faqs.filter((faq) => faq.reviewQuote && reviewIds.has(faq.reviewQuote.reviewId));

function adminProductOf(
  catalogue: CatalogueSeed,
  id: string,
  stamp: RecordStamp,
): AdminProduct | null {
  const product = findProduct(catalogue, id);
  if (!product) return null;
  return structuredClone({ product, stamp, reviewCount: reviewsOf(catalogue, id).length });
}

/** The saved value, read after the write committed. */
function savedProduct(catalogue: CatalogueSeed, id: string, stamp: RecordStamp): AdminProduct {
  const saved = adminProductOf(catalogue, id, stamp);
  if (!saved) throw new Error(`Product ${id} vanished during its own save`);
  return saved;
}

const pluralReviews = (count: number) => (count === 1 ? "1 Review" : `${count} Reviews`);

/**
 * The rules that need the catalogue: the Exam and its Subjects, then those of
 * the seed (catalogue.schema.ts), with the editor's messages. `existing` is
 * the Product being saved, or undefined for a new one.
 */
function productRules(
  catalogue: CatalogueSeed,
  input: ProductInput,
  existing: Product | undefined,
): AdminError | null {
  const exam = catalogue.exams.find((e) => e.code === input.examCode);
  if (!exam) return { kind: "invalid", fieldErrors: { examCode: ["CHOOSE AN EXAM"] } };
  const strays = input.subjectCodes.filter(
    (code) => !exam.subjects.some((subject) => subject.code === code),
  );
  if (strays.length > 0) {
    return {
      kind: "invalid",
      fieldErrors: {
        subjectCodes: strays.map((code) => `${code} ISN’T A SUBJECT OF ${exam.code}`),
      },
    };
  }

  const reviews = existing ? reviewsOf(catalogue, existing.id).length : 0;
  if (input.state === "coming-soon" && reviews > 0) {
    return {
      kind: "invalid",
      fieldErrors: {},
      formError: `Coming Soon Products can’t have Reviews. Delete or move its ${pluralReviews(reviews)} first.`,
    };
  }
  if (input.state === "live" && (existing?.photos.length ?? 0) === 0) {
    return { kind: "invalid", fieldErrors: {}, formError: PHOTO_TO_GO_LIVE };
  }
  return null;
}

const sameFigures = (a: ShopeeFigures | null, b: ProductInput["shopee"]) =>
  a !== null &&
  b !== null &&
  a.rating === b.rating &&
  a.ratingCount === b.ratingCount &&
  a.unitsSold === b.unitsSold;

/**
 * Pure: the Shopee figures as saved. Figures that changed were copied from
 * Shopee today, so they're dated today in Manila; unchanged ones keep their date.
 */
function figuresAsSaved(
  previous: ShopeeFigures | null,
  figures: ProductInput["shopee"],
  now: Date,
): ShopeeFigures | null {
  if (figures === null) return null;
  if (previous && sameFigures(previous, figures)) return previous;
  return { ...figures, asOf: manilaDate(now) };
}

/** Pure: the editor's fields applied to a Product, leaving its id, address, photos and toggles. */
function withFields(product: Product, input: ProductInput, now: Date): Product {
  return {
    ...product,
    ...input,
    shopee: figuresAsSaved(product.shopee, input.shopee, now),
  };
}

export async function listExamsForAdmin(_actor: StaffActor): Promise<Exam[]> {
  return structuredClone(getSampleStore().catalogue.exams);
}

export async function getProductForAdmin(
  _actor: StaffActor,
  id: string,
): Promise<AdminProduct | null> {
  const store = getSampleStore();
  return adminProductOf(store.catalogue, id, stampOf(store, recordOf(id)));
}

/** A new Product's id: unique, and like the seed's ("prd-…"). */
function newProductId(catalogue: CatalogueSeed): string {
  for (;;) {
    const id = `prd-${crypto.randomUUID().slice(0, 8)}`;
    if (!findProduct(catalogue, id)) return id;
  }
}

export async function createProduct(
  actor: StaffActor,
  input: NewProductForm,
): Promise<AdminResult<AdminProduct>> {
  const id = newProductId(getSampleStore().catalogue);
  return writeCatalogue(actor, input, undefined, {
    role: "staff",
    schema: newProductFormSchema,
    record: recordOf(id),
    check: (catalogue, fields) => productRules(catalogue, fields, undefined),
    activity: { entity: "product", entityId: id, action: "create" },
    snapshot: (catalogue) => findProduct(catalogue, id) ?? null,
    apply: (draft, fields, now) => {
      const blank: Product = {
        id,
        slug: uniqueSlug(
          fields.title,
          draft.products.map((p) => p.slug),
        ),
        photos: [],
        ...fields,
        shopee: null,
      };
      draft.products.push(withFields(blank, fields, now));
    },
    result: (catalogue, stamp) => savedProduct(catalogue, id, stamp),
    tags: [CATALOGUE_TAGS.products],
  });
}

export async function updateProduct(
  actor: StaffActor,
  id: string,
  input: ProductForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminProduct>> {
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    schema: productFormSchema,
    record: recordOf(id),
    exists: (catalogue) => findProduct(catalogue, id) !== undefined,
    check: (catalogue, fields) => productRules(catalogue, fields, findProduct(catalogue, id)),
    activity: { entity: "product", entityId: id, action: "update" },
    snapshot: (catalogue) => findProduct(catalogue, id) ?? null,
    apply: (draft, fields, now) => {
      draft.products = draft.products.map((product) =>
        product.id === id ? withFields(product, fields, now) : product,
      );
    },
    result: (catalogue, stamp) => savedProduct(catalogue, id, stamp),
    tags: [CATALOGUE_TAGS.products],
  });
}

/** Pure: a Product with what goes when it's deleted, or null when it isn't in the catalogue. */
function withCascade(catalogue: CatalogueSeed, id: string) {
  const product = findProduct(catalogue, id);
  if (!product) return null;
  const reviews = reviewsOf(catalogue, id);
  const faqQuotes = faqsQuoting(catalogue, new Set(reviews.map((review) => review.id)));
  return { product, reviews, faqQuotes };
}

function previewOf(catalogue: CatalogueSeed, id: string): ProductDeletePreview | null {
  const cascade = withCascade(catalogue, id);
  if (!cascade) return null;
  return {
    reviews: cascade.reviews.length,
    photos: cascade.product.photos.length,
    faqQuotes: cascade.faqQuotes.length,
  };
}

export async function previewProductDelete(
  _actor: StaffActor,
  id: string,
): Promise<ProductDeletePreview | null> {
  return previewOf(getSampleStore().catalogue, id);
}

export async function deleteProduct(
  actor: StaffActor,
  id: string,
): Promise<AdminResult<DeletedProduct>> {
  const { catalogue } = getSampleStore();
  const preview = previewOf(catalogue, id);
  const slug = findProduct(catalogue, id)?.slug ?? "";
  return writeCatalogue(actor, { id }, undefined, {
    role: "staff",
    schema: productIdInputSchema,
    record: recordOf(id),
    exists: (current) => findProduct(current, id) !== undefined,
    activity: { entity: "product", entityId: id, action: "delete" },
    // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
    snapshot: (current) => withCascade(current, id),
    apply: (draft) => {
      const reviewIds = new Set(reviewsOf(draft, id).map((review) => review.id));
      draft.products = draft.products.filter((product) => product.id !== id);
      draft.reviews = draft.reviews.filter((review) => review.productId !== id);
      draft.faqs = draft.faqs.map((faq) =>
        faq.reviewQuote && reviewIds.has(faq.reviewQuote.reviewId)
          ? { ...faq, reviewQuote: null }
          : faq,
      );
    },
    result: () => ({ id, slug, reviews: 0, photos: 0, faqQuotes: 0, ...preview }),
    tags: [CATALOGUE_TAGS.products, CATALOGUE_TAGS.reviews, CATALOGUE_TAGS.faqs],
  });
}

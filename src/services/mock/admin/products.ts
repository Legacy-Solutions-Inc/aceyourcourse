import { resolveStoreLink } from "@/lib/catalogue/store-links";
import { type ProductFlags, productFlagsSchema } from "@/services/admin.schema";
import type {
  AdminProductList,
  AdminProductRow,
  AdminResult,
  ProductListQuery,
  RecordStamp,
  StaffActor,
  StoreLinkStatus,
} from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { Marketplace, Product } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's Products area: the Products list, with
// every Product, Coming Soon and hidden ones included, and its inline "Show on
// website" and "Available in app" toggles. Each Product is its own record, with
// its own stamp.

/** A Product's record key, for its stamp. */
const recordOf = (id: string) => `product:${id}`;

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

export async function getProductRowForAdmin(
  _actor: StaffActor,
  id: string,
): Promise<AdminProductRow | null> {
  const store = getSampleStore();
  const product = store.catalogue.products.find((p) => p.id === id);
  if (!product) return null;
  return rowOf(product, store.catalogue.settings.shopLinks, stampOf(store, recordOf(id)));
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
    record: recordOf(id),
    exists: (catalogue) => find(catalogue) !== undefined,
    activity: { entity: "product", entityId: id, action: "set-flags" },
    snapshot: (catalogue) => flagsOf(find(catalogue)),
    apply: (draft, update) => {
      const product = find(draft);
      if (!product) return;
      if (update.showOnWebsite !== undefined) product.showOnWebsite = update.showOnWebsite;
      if (update.availableInApp !== undefined) product.availableInApp = update.availableInApp;
    },
    result: (catalogue, stamp) => {
      const product = find(catalogue);
      if (!product) throw new Error(`Product ${id} vanished during its own save`);
      return rowOf(product, catalogue.settings.shopLinks, stamp);
    },
    tags: [CATALOGUE_TAGS.products],
  });
}

import { productFormatLabel } from "@/lib/catalogue/format";
import { MAX_QUERY_LENGTH } from "@/lib/catalogue/product-filters";
import { formatPeso } from "@/lib/money";
import { paths } from "@/paths";
import type {
  AdminProductList,
  AdminProductRow,
  ProductListQuery,
  StoreLinkStatus,
} from "@/services/admin.types";
import type { Marketplace } from "@/services/catalogue.types";

// The Products list's URL and its row labels (BUILD-MAP §3.3, List). The
// filters live in the URL, so a reload keeps them: ?q=poster&exam=ce&missing=1,
// and the selected Product as ?product=<id> or ?product=new (CONVENTIONS §2).
// The seam checks the Exam against the catalogue.

type SearchParams = Record<string, string | string[] | undefined>;

/** Pure: the Products list's filters and selected Product in its URL's search params. */
export function parseProductListParams(params: SearchParams): {
  query: ProductListQuery;
  product: string | null;
} {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  };
  const query: ProductListQuery = {};
  const q = value("q");
  if (q) query.q = q.slice(0, MAX_QUERY_LENGTH);
  const exam = value("exam");
  if (exam) query.exam = exam;
  if (value("missing") === "1") query.missing = true;
  return { query, product: value("product")?.slice(0, MAX_QUERY_LENGTH) ?? null };
}

/** Pure: the Products list's URL for these filters and selected Product. */
export function productListHref(
  { q, exam, missing }: AdminProductList["query"],
  product: string | null = null,
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (exam) params.set("exam", exam.toLowerCase());
  if (missing) params.set("missing", "1");
  if (product) params.set("product", product);
  const search = params.toString();
  return search ? `${paths.admin.products}?${search}` : paths.admin.products;
}

/** Pure: the PRICE column: "₱1,200", "₱400+" for a price range, "COMING SOON" with no price. */
export function adminPriceLabel({ state, priceFrom, priceTo }: AdminProductRow): string {
  if (state === "coming-soon" || priceFrom === null) return "COMING SOON";
  const from = formatPeso(priceFrom);
  return priceTo !== null && priceTo !== priceFrom ? `${from}+` : from;
}

/** Pure: "FLASH CARDS · 764 SOLD", or the format alone when there are no units sold. */
export function formatAndSold({ format, unitsSold }: AdminProductRow): string {
  const label = productFormatLabel(format).toUpperCase();
  return unitsSold === null ? label : `${label} · ${unitsSold.toLocaleString("en-PH")} SOLD`;
}

/** Pure: how many Marketplaces have the Product's own Listing, for "n/3". */
export function productLinkCount(storeLinks: Record<Marketplace, StoreLinkStatus>): number {
  return Object.values(storeLinks).filter((status) => status === "product").length;
}

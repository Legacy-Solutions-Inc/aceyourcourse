import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductImage } from "@/components/website/product-image";
import { MARKETPLACES } from "@/content/website";
import type { AdminAction } from "@/lib/admin/action";
import {
  adminPriceLabel,
  formatAndSold,
  productLinkCount,
  productListHref,
} from "@/lib/admin/product-list";
import { cn } from "@/lib/utils";
import type { AdminProductList, AdminProductRow, StoreLinkStatus } from "@/services/admin.types";

import { ProductFlagSwitch } from "./product-flag-switch";
import { ProductSearch } from "./product-search";

interface ProductListProps {
  list: AdminProductList;
  /** The selected Product's id, "new", or null. */
  selected: string | null;
  setFlag: AdminAction<AdminProductRow>;
}

const NO_FILTERS = { q: null, exam: null, missing: false };

const chip =
  "flex min-h-9 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold hover:bg-ayc-sand";
const chipOn = "bg-primary text-primary-foreground hover:bg-primary";
const head = "h-auto px-0 py-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";

/**
 * The Products list (mockup 149–175; BUILD-MAP §3.3, List): search, Exam chips
 * and "Missing product links", all in the URL, then every Product the seam
 * matched, already sorted. There are no bulk actions and no column sorting.
 */
export function ProductList({ list, selected, setFlag }: ProductListProps) {
  const { rows, query, examCodes, total } = list;
  return (
    <section aria-label="Products" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ProductSearch query={query} selected={selected} />
        <div role="group" aria-label="Exam" className="flex flex-wrap gap-1.5">
          {[null, ...examCodes].map((exam) => (
            <Link
              key={exam ?? "all"}
              href={productListHref({ ...query, exam }, selected)}
              aria-current={query.exam === exam ? "true" : undefined}
              className={cn(chip, query.exam === exam ? chipOn : "bg-ayc-paper")}
            >
              {exam ?? "ALL"}
            </Link>
          ))}
        </div>
        <Link
          href={productListHref({ ...query, missing: !query.missing }, selected)}
          aria-current={query.missing ? "true" : undefined}
          className={cn(
            "ml-auto flex min-h-9 items-center border-[1.5px] px-2.5 text-[13px] font-semibold",
            query.missing
              ? "border-ayc-warning bg-ayc-orange/15"
              : "border-ayc-rule hover:bg-ayc-sand",
          )}
        >
          Missing product links
        </Link>
      </div>

      <div className="border-[1.5px] bg-ayc-paper">
        <Table className="table-fixed wide:min-w-130">
          <TableHeader>
            <TableRow className="border-b-[1.5px] hover:bg-transparent">
              <TableHead className={cn(head, "pl-3.5")}>PRODUCT · {rows.length}</TableHead>
              <TableHead className={cn(head, "hidden w-14 wide:table-cell")}>EXAM</TableHead>
              <TableHead className={cn(head, "hidden w-20 wide:table-cell")}>PRICE</TableHead>
              <TableHead className={cn(head, "w-27")}>STORE LINKS</TableHead>
              <TableHead className={cn(head, "w-24 pr-3.5")}>APP · SITE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ProductListRow
                key={row.id}
                row={row}
                href={productListHref(query, row.id)}
                selected={row.id === selected}
                setFlag={setFlag}
              />
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3.5 py-7 text-center text-sm text-muted-foreground">
            {total === 0 ? (
              <p>No products yet. Add the first one with + Add product.</p>
            ) : (
              <>
                <p>No products match.</p>
                <Link
                  href={productListHref(NO_FILTERS, selected)}
                  className="font-semibold text-ayc-blue underline underline-offset-4"
                >
                  Clear filters
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        S · L · T = SHOPEE · LAZADA · TIKTOK SHOP · GREEN = PRODUCT LINK · AMBER = OPENS THE SHOP
        PAGE
      </p>
    </section>
  );
}

interface ProductListRowProps {
  row: AdminProductRow;
  href: string;
  selected: boolean;
  setFlag: AdminAction<AdminProductRow>;
}

/** One Product (mockup 159–169). A row hidden from the Website is dimmed. */
function ProductListRow({ row, href, selected, setFlag }: ProductListRowProps) {
  const hidden = !row.showOnWebsite;
  const links = productLinkCount(row.storeLinks);
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(
        "border-ayc-ruled hover:bg-ayc-sand/40 data-[state=selected]:bg-ayc-orange/15",
        // Dimmed with colour, not the mockup's opacity, so the text keeps its contrast.
        hidden && "bg-ayc-sand/70 text-muted-foreground",
      )}
    >
      <TableCell className="py-2.25 pr-2.5 pl-3.5">
        <Link
          href={href}
          scroll={false}
          aria-current={selected ? "true" : undefined}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span
            className={cn(
              "relative size-9 flex-none overflow-hidden border border-ayc-navy bg-ayc-sand",
              hidden && "opacity-55",
            )}
          >
            <ProductImage photo={row.cover} alt="" sizes="36px" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{row.shortName}</span>
            <span className="truncate font-mono text-[10px] text-ayc-slate">
              {formatAndSold(row)}
            </span>
            {/* On a phone the EXAM and PRICE columns fold in here. */}
            <span className="font-mono text-[10px] font-bold wide:hidden">
              <span className="text-ayc-blue">{row.examCode}</span> · {adminPriceLabel(row)}
            </span>
            {hidden ? <span className="sr-only">Hidden from the website</span> : null}
          </span>
        </Link>
      </TableCell>
      <TableCell className="hidden px-0 font-mono text-xs font-bold text-ayc-blue wide:table-cell">
        {row.examCode}
      </TableCell>
      <TableCell className="hidden px-0 text-[13px] font-bold wide:table-cell">
        {row.state === "coming-soon" ? (
          <span className="font-mono text-[10px] text-ayc-slate">{adminPriceLabel(row)}</span>
        ) : (
          adminPriceLabel(row)
        )}
      </TableCell>
      <TableCell className="px-0">
        <span className="flex items-center gap-1">
          {MARKETPLACES.map(({ id, name }) => (
            <StoreLinkBadge key={id} marketplace={name} status={row.storeLinks[id]} />
          ))}
          <span
            className={cn(
              "font-mono text-[10px] font-bold",
              linkCountColour(links, row.storeLinks),
            )}
          >
            {links}/{MARKETPLACES.length}
          </span>
        </span>
      </TableCell>
      <TableCell className="pr-3.5 pl-0">
        <span className="flex gap-1">
          <ProductFlagSwitch
            productId={row.id}
            flag="availableInApp"
            checked={row.availableInApp}
            label={`${row.shortName} available in app`}
            title={row.shortName}
            action={setFlag}
          />
          <ProductFlagSwitch
            productId={row.id}
            flag="showOnWebsite"
            checked={row.showOnWebsite}
            label={`Show ${row.shortName} on the website`}
            title={row.shortName}
            action={setFlag}
          />
        </span>
      </TableCell>
    </TableRow>
  );
}

/**
 * Pure: "n/3" is green when every Marketplace has a product link, amber when a
 * button opens a shop page, and muted when the rest have no button at all, as
 * on a Coming Soon Product.
 */
function linkCountColour(links: number, storeLinks: AdminProductRow["storeLinks"]): string {
  if (links === MARKETPLACES.length) return "text-ayc-success";
  return Object.values(storeLinks).includes("shop") ? "text-ayc-warning" : "text-ayc-slate";
}

const BADGES: Record<StoreLinkStatus, { className: string; says: string }> = {
  product: { className: "border-ayc-success text-ayc-success", says: "product link" },
  shop: { className: "border-ayc-warning text-ayc-warning", says: "opens the shop page" },
  none: { className: "border-dashed border-ayc-rule text-ayc-slate", says: "no button" },
};

/** One S/L/T badge: green for a product link, amber for the shop page, a muted dash for none. */
function StoreLinkBadge({ marketplace, status }: { marketplace: string; status: StoreLinkStatus }) {
  const { className, says } = BADGES[status];
  return (
    <span
      title={`${marketplace}: ${says}`}
      className={cn(
        "flex h-4.5 w-4.5 items-center justify-center border-[1.5px] font-mono text-[9px] leading-none font-bold",
        className,
      )}
    >
      <span aria-hidden="true">{status === "none" ? "–" : marketplace.charAt(0)}</span>
      <span className="sr-only">
        {marketplace}: {says}
      </span>
    </span>
  );
}

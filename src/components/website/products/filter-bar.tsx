"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useId, useOptimistic } from "react";

import { FilterChip, FilterChipGroup } from "@/components/website/filter-chips";
import { productsPageCopy } from "@/content/products-page";
import { useSettledValue } from "@/hooks/use-settled-value";
import { productFormatLabel } from "@/lib/catalogue/format";
import {
  DEFAULT_SORT,
  type FacetCounts,
  MAX_QUERY_LENGTH,
  type PriceBounds,
  PRICE_STEP,
  PRODUCT_FORMATS,
  PRODUCT_SORTS,
  type ProductsQuery,
  productsHref,
} from "@/lib/catalogue/product-filters";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const copy = productsPageCopy.all;

const mono = "font-mono text-[11px] font-medium tracking-[0.04em] text-ayc-slate uppercase";
const control = "flex min-h-11.5 items-center border-[1.5px] border-ayc-navy bg-ayc-cream";

const trim = (text: string) => text.trim();
const asIs = <T,>(value: T) => value;

interface FilterBarProps {
  /** The filters in the URL. */
  query: ProductsQuery;
  /** Every Exam on the Website, in order, as a chip. */
  examCodes: string[];
  counts: FacetCounts;
  /** The price slider's range in whole pesos. Its top means "Any". */
  priceBounds: PriceBounds;
  memberAppLive: boolean;
}

/**
 * The Products page's filters: search, sort, Exam and format chips, the
 * max-price slider, "Also in app" (only while the Member App switch is on)
 * and Clear filters. Each change replaces the URL without scrolling, and the
 * page re-reads it on the server. Search and the slider wait for a pause.
 * Picking a pressed chip again clears it. The bar is sticky on wide screens
 * only: on a phone it would cover most of the grid.
 */
export function FilterBar({
  query,
  examCodes,
  counts,
  priceBounds,
  memberAppLive,
}: FilterBarProps) {
  const router = useRouter();
  // The new filters show at once, before the page has re-rendered with them.
  const [current, setCurrent] = useOptimistic(query);
  const ids = useId();

  const navigate = useCallback(
    (next: ProductsQuery) => {
      if (productsHref(next) === productsHref(current)) return;
      startTransition(() => {
        setCurrent(next);
        router.replace(productsHref(next), { scroll: false });
      });
    },
    [current, router, setCurrent],
  );
  const applyFilters = (change: ProductsQuery) => navigate({ ...current, ...change });

  const sendSearch = useCallback((q: string) => navigate({ ...current, q }), [current, navigate]);
  const [search, setSearch, resetSearch] = useSettledValue(query.q ?? "", sendSearch, trim);

  const sendMax = useCallback(
    (max: number | undefined) => navigate({ ...current, max }),
    [current, navigate],
  );
  const [max, setMax, resetMax] = useSettledValue(query.max, sendMax, asIs);
  const maxLabel = max === undefined ? copy.anyPrice : formatPeso(max * 100);

  const clear = () => {
    resetSearch("");
    resetMax(undefined);
    navigate({});
  };

  const selectedExam = current.exam;
  const inSelectedExam = selectedExam ? (counts.exams[selectedExam] ?? 0) : counts.all;
  const filtered = productsHref(current) !== paths.products.list;

  return (
    <div className="z-10 flex flex-col gap-3 border-[1.5px] border-ayc-navy bg-ayc-paper p-4 shadow-hard wide:sticky wide:top-21">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* The input drops its own outline, so the box shows the focus ring instead. */}
        <div
          className={cn(
            control,
            "flex-[1_1_240px] gap-2.5 px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ayc-blue",
          )}
        >
          <span aria-hidden="true" className="text-base">
            ⌕
          </span>
          <label htmlFor={`${ids}-search`} className="sr-only">
            {copy.searchLabel}
          </label>
          <input
            id={`${ids}-search`}
            type="search"
            value={search}
            maxLength={MAX_QUERY_LENGTH}
            enterKeyHint="search"
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-ayc-slate"
          />
        </div>

        <div className={cn(control, "gap-2 px-3")}>
          <label htmlFor={`${ids}-sort`} className={mono}>
            {copy.sortLabel}
          </label>
          <select
            id={`${ids}-sort`}
            value={current.sort ?? DEFAULT_SORT}
            onChange={(event) => {
              const sort = PRODUCT_SORTS.find((value) => value === event.target.value);
              applyFilters({ sort });
            }}
            className="cursor-pointer bg-transparent text-sm font-bold"
          >
            {PRODUCT_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {copy.sorts[sort]}
              </option>
            ))}
          </select>
        </div>

        {memberAppLive ? (
          <button
            type="button"
            aria-pressed={current.app === true}
            onClick={() => applyFilters({ app: !current.app })}
            className={cn(
              control,
              "group cursor-pointer gap-2.5 px-3.5 text-sm font-bold transition-colors aria-pressed:bg-ayc-blue aria-pressed:text-ayc-cream",
            )}
          >
            <span
              aria-hidden="true"
              className="relative h-5 w-8.5 rounded-full border-[1.5px] border-current"
            >
              <span className="absolute top-0.5 left-0.5 size-3.25 rounded-full bg-current transition-[left] group-aria-pressed:left-4 motion-reduce:transition-none" />
            </span>
            {copy.alsoInApp}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
        <FilterChipGroup label={copy.examLabel}>
          <FilterChip
            noun={copy.reviewerNoun}
            pressed={!selectedExam}
            count={counts.all}
            onClick={() => applyFilters({ exam: undefined })}
            className="font-mono"
          >
            {copy.allChip}
          </FilterChip>
          {examCodes.map((code) => (
            <FilterChip
              key={code}
              noun={copy.reviewerNoun}
              pressed={selectedExam === code}
              count={counts.exams[code] ?? 0}
              onClick={() => applyFilters({ exam: selectedExam === code ? undefined : code })}
              className="font-mono"
            >
              {code}
            </FilterChip>
          ))}
        </FilterChipGroup>

        <FilterChipGroup label={copy.formatLabel}>
          <FilterChip
            noun={copy.reviewerNoun}
            pressed={!current.format}
            count={inSelectedExam}
            onClick={() => applyFilters({ format: undefined })}
          >
            {copy.allChip}
          </FilterChip>
          {PRODUCT_FORMATS.map((format) => (
            <FilterChip
              key={format}
              noun={copy.reviewerNoun}
              pressed={current.format === format}
              count={counts.formats[format]}
              onClick={() =>
                applyFilters({ format: current.format === format ? undefined : format })
              }
            >
              {productFormatLabel(format)}
            </FilterChip>
          ))}
        </FilterChipGroup>

        <div className="flex flex-[1_1_220px] items-center gap-2.5">
          <label htmlFor={`${ids}-max`} className={mono}>
            {copy.maxPriceLabel}
          </label>
          <input
            id={`${ids}-max`}
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={PRICE_STEP}
            value={max ?? priceBounds.max}
            aria-valuetext={max === undefined ? `${copy.anyPrice} price` : maxLabel}
            disabled={priceBounds.min >= priceBounds.max}
            onChange={(event) => {
              const pesos = Number(event.target.value);
              setMax(pesos >= priceBounds.max ? undefined : pesos);
            }}
            className="min-w-20 flex-1 cursor-pointer accent-ayc-blue"
          />
          <span aria-hidden="true" className="min-w-16 text-right text-[15px] font-extrabold">
            {maxLabel}
          </span>
        </div>

        {filtered ? (
          <button
            type="button"
            onClick={clear}
            className="cursor-pointer border-b-2 border-ayc-blue text-[13px] font-bold text-ayc-blue"
          >
            {copy.clearFilters}
          </button>
        ) : null}
      </div>
    </div>
  );
}

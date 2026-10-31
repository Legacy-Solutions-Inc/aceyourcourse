"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useId, useOptimistic } from "react";

import { FilterChip, FilterChipGroup } from "@/components/website/filter-chips";
import { reviewsPageCopy } from "@/content/reviews-page";
import { useSettledValue } from "@/hooks/use-settled-value";
import {
  DEFAULT_REVIEW_SORT,
  MAX_REVIEW_QUERY_LENGTH,
  REVIEW_SORTS,
  type ReviewFacetCounts,
  type ReviewsQuery,
  reviewsHref,
  STAR_BUCKETS,
} from "@/lib/catalogue/review-filters";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const copy = reviewsPageCopy.wall;

const mono = "font-mono text-[11px] font-medium tracking-[0.04em] text-ayc-slate uppercase";
const control = "flex min-h-11.5 items-center border-[1.5px] border-ayc-navy bg-ayc-cream";

const trim = (text: string) => text.trim();

interface ReviewWallFiltersProps {
  /** The filters in the URL. */
  filters: ReviewsQuery;
  /** Every Exam a Review can be from, in order, as a chip. */
  examCodes: string[];
  counts: ReviewFacetCounts;
  /** The short name of the Product the wall is filtered to, or null. */
  productName: string | null;
}

/**
 * The review wall's filters: search, sort, Exam and star chips, the Product
 * chip (set from "Ratings by reviewer") and Clear filters. Each change
 * replaces the URL without scrolling, and the page re-reads it on the server.
 * Search waits for a pause. Picking a pressed chip again clears it. An Exam
 * chip drops the Product filter, as a Product belongs to one Exam; the star
 * chips and the search keep it. Sticky on wide screens only: on a phone it
 * would cover most of the wall.
 */
export function ReviewWallFilters({
  filters,
  examCodes,
  counts,
  productName,
}: ReviewWallFiltersProps) {
  const router = useRouter();
  // The new filters show at once, before the page has re-rendered with them.
  const [current, setCurrent] = useOptimistic(filters);
  const ids = useId();

  const navigate = useCallback(
    (next: ReviewsQuery) => {
      if (reviewsHref(next) === reviewsHref(current)) return;
      startTransition(() => {
        setCurrent(next);
        router.replace(reviewsHref(next), { scroll: false });
      });
    },
    [current, router, setCurrent],
  );
  const applyFilters = (change: ReviewsQuery) => navigate({ ...current, ...change });

  const sendSearch = useCallback(
    (query: string) => navigate({ ...current, query }),
    [current, navigate],
  );
  const [search, setSearch, resetSearch] = useSettledValue(filters.query ?? "", sendSearch, trim);

  const clear = () => {
    resetSearch("");
    navigate({});
  };

  const filtered = reviewsHref(current) !== paths.reviews;

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
            maxLength={MAX_REVIEW_QUERY_LENGTH}
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
            value={current.sort ?? DEFAULT_REVIEW_SORT}
            onChange={(event) => {
              const sort = REVIEW_SORTS.find((value) => value === event.target.value);
              applyFilters({ sort });
            }}
            className="cursor-pointer bg-transparent text-sm font-bold"
          >
            {REVIEW_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {copy.sorts[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
        <FilterChipGroup label={copy.examLabel}>
          <FilterChip
            noun={copy.reviewNoun}
            className="font-mono"
            pressed={!current.examCode}
            count={counts.all}
            onClick={() => applyFilters({ examCode: undefined, productSlug: undefined })}
          >
            {copy.allChip}
          </FilterChip>
          {examCodes.map((code) => (
            <FilterChip
              key={code}
              noun={copy.reviewNoun}
              className="font-mono"
              pressed={current.examCode === code}
              count={counts.exams[code] ?? 0}
              onClick={() =>
                applyFilters({
                  examCode: current.examCode === code ? undefined : code,
                  productSlug: undefined,
                })
              }
            >
              {code}
            </FilterChip>
          ))}
        </FilterChipGroup>

        <FilterChipGroup label={copy.starsLabel}>
          <FilterChip
            noun={copy.reviewNoun}
            className="font-mono"
            pressed={!current.stars}
            count={counts.all}
            onClick={() => applyFilters({ stars: undefined })}
          >
            {copy.allChip}
          </FilterChip>
          {STAR_BUCKETS.map((bucket) => (
            <FilterChip
              key={bucket}
              noun={copy.reviewNoun}
              className="font-mono"
              pressed={current.stars === bucket}
              count={counts.stars[bucket]}
              onClick={() => applyFilters({ stars: current.stars === bucket ? undefined : bucket })}
            >
              <span aria-hidden="true">{copy.starChips[bucket].label}</span>
              <span className="sr-only">{copy.starChips[bucket].spoken}</span>
            </FilterChip>
          ))}
        </FilterChipGroup>

        {productName && current.productSlug ? (
          <button
            type="button"
            aria-label={`${productName}${copy.removeFilter}`}
            onClick={() => applyFilters({ productSlug: undefined })}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-ayc-navy bg-ayc-blue px-3 text-[13px] font-bold text-ayc-cream transition-colors hover:bg-ayc-blue-dark motion-reduce:transition-none"
          >
            {productName}
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}

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

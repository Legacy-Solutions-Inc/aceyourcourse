"use client";

import { useUrlSearch } from "@/components/admin/use-url-search";
import { reviewListHref } from "@/lib/admin/review-list";
import type { AdminReviewList } from "@/services/admin.types";

interface ReviewSearchProps {
  query: AdminReviewList["query"];
  selected: string | null;
}

/**
 * "Search review text" (mockup 239): the search lives in the URL, with the
 * other filters and the selected Review (useUrlSearch).
 */
export function ReviewSearch({ query, selected }: ReviewSearchProps) {
  const search = useUrlSearch(query.q, (q) => reviewListHref({ ...query, q }, selected));
  return (
    <input
      type="search"
      aria-label="Search review text"
      placeholder="Search review text"
      {...search}
      className="min-h-10 w-full min-w-0 basis-full border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium placeholder:text-muted-foreground"
    />
  );
}

"use client";

import { useUrlSearch } from "@/components/admin/use-url-search";
import { faqListHref } from "@/lib/admin/faq-list";
import type { AdminFaqList } from "@/services/admin.types";

interface FaqSearchProps {
  query: AdminFaqList["query"];
  selected: string | null;
}

/**
 * "Search questions in all groups" (mockup 289): the search lives in the URL,
 * with the group and the selected FAQ (useUrlSearch).
 */
export function FaqSearch({ query, selected }: FaqSearchProps) {
  const search = useUrlSearch(query.q, (q) => faqListHref({ ...query, q }, selected));
  return (
    <input
      type="search"
      aria-label="Search questions in all groups"
      placeholder="Search questions in all groups"
      {...search}
      className="min-h-10 w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium placeholder:text-muted-foreground"
    />
  );
}

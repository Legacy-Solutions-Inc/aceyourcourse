"use client";

import { useUrlSearch } from "@/components/admin/use-url-search";
import { userListHref } from "@/lib/admin/users-list";
import type { UserListQuery } from "@/services/admin.types";

/**
 * "Search by name or email" (mockup 650): the search lives in the URL with
 * the filter (useUrlSearch). A new search starts again at the first page.
 */
export function UserSearch({ query }: { query: UserListQuery }) {
  const search = useUrlSearch(query.q, (q) => userListHref({ ...query, q, page: 1 }));
  return (
    <input
      type="search"
      aria-label="Search by name or email"
      placeholder="Search by name or email"
      {...search}
      className="min-h-10 w-full min-w-0 flex-[0_1_320px] border-[1.5px] bg-white px-3 py-2 text-sm font-medium placeholder:text-muted-foreground"
    />
  );
}

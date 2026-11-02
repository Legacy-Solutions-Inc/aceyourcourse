"use client";

import { useUrlSearch } from "@/components/admin/use-url-search";
import { productListHref } from "@/lib/admin/product-list";
import type { AdminProductList } from "@/services/admin.types";

interface ProductSearchProps {
  query: AdminProductList["query"];
  selected: string | null;
}

/**
 * "Search products" (mockup 154): the search lives in the URL, with the other
 * filters and the selected Product (useUrlSearch).
 */
export function ProductSearch({ query, selected }: ProductSearchProps) {
  const search = useUrlSearch(query.q, (q) => productListHref({ ...query, q }, selected));
  return (
    <input
      type="search"
      aria-label="Search products"
      placeholder="Search products"
      {...search}
      className="min-h-10 w-full min-w-0 basis-full border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium placeholder:text-muted-foreground"
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { productListHref } from "@/lib/admin/product-list";
import type { AdminProductList } from "@/services/admin.types";

interface ProductSearchProps {
  query: AdminProductList["query"];
  selected: string | null;
}

/**
 * "Search products" (mockup 154): each keystroke writes the search into the
 * URL, keeping the other filters and the selected Product, so the server
 * filters the list and a reload keeps it. When something else changes the
 * URL's search, such as Clear filters or Back, the box follows it.
 */
export function ProductSearch({ query, selected }: ProductSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(query.q ?? "");
  const [shownQuery, setShownQuery] = useState(query.q);
  // The search this box last wrote, so its own URL changes aren't taken as someone else's.
  const [written, setWritten] = useState(query.q);
  const [pending, startTransition] = useTransition();

  // While its own URL changes are on their way, an older search can arrive
  // first; only a settled URL that this box didn't write replaces the text.
  if (query.q !== shownQuery && !pending) {
    setShownQuery(query.q);
    if (query.q !== written) {
      setWritten(query.q);
      setValue(query.q ?? "");
    }
  }

  return (
    <input
      type="search"
      aria-label="Search products"
      placeholder="Search products"
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        const q = next.trim() || null;
        setValue(next);
        setWritten(q);
        const href = productListHref({ ...query, q }, selected);
        startTransition(() => router.replace(href, { scroll: false }));
      }}
      className="min-h-10 w-full min-w-0 basis-full border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium placeholder:text-muted-foreground"
    />
  );
}

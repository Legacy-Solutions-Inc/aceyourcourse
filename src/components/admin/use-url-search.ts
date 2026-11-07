"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * A list's search box whose text lives in the URL (BUILD-MAP §3.3, §3.4):
 * each keystroke replaces the URL with `hrefFor(search)`, so the server
 * filters the list and a reload keeps it. When something else changes the
 * URL's search, such as Clear filters or Back, the box follows it. `q` is the
 * search as the server last applied it.
 */
export function useUrlSearch(q: string | null, hrefFor: (search: string | null) => string) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [shownQuery, setShownQuery] = useState(q);
  // The search this box last wrote, so its own URL changes aren't taken as someone else's.
  const [written, setWritten] = useState(q);
  const [pending, startTransition] = useTransition();

  // While its own URL changes are on their way, an older search can arrive
  // first; only a settled URL that this box didn't write replaces the text.
  if (q !== shownQuery && !pending) {
    setShownQuery(q);
    if (q !== written) {
      setWritten(q);
      setValue(q ?? "");
    }
  }

  return {
    value,
    onChange(event: React.ChangeEvent<HTMLInputElement>) {
      const next = event.target.value;
      const search = next.trim() || null;
      setValue(next);
      setWritten(search);
      const href = hrefFor(search);
      startTransition(() => router.replace(href, { scroll: false }));
    },
  };
}

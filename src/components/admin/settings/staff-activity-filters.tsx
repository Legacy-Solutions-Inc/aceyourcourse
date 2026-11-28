"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { activityHref } from "@/lib/admin/staff-activity-view";
import type { StaffActivityQuery } from "@/services/admin.types";

const SELECT =
  "min-h-10 w-full min-w-0 border-[1.5px] bg-white px-2.5 py-2 text-sm font-medium wide:w-64 wide:flex-none";

export interface FilterOption {
  value: string;
  label: string;
}

interface StaffActivityFiltersProps {
  query: StaffActivityQuery;
  actors: FilterOption[];
  areas: FilterOption[];
}

/**
 * The Staff Activity list's filters, by Staff member and by area: each lives
 * in the URL, so the server filters the list and a reload or a shared link
 * keeps it. A change goes back to the newest page, and shows at once while
 * the server filters. A value from the URL that no record has stays shown.
 */
export function StaffActivityFilters({ query, actors, areas }: StaffActivityFiltersProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(query);
  const go = (next: StaffActivityQuery) =>
    startTransition(() => {
      setShown(next);
      router.replace(activityHref(next), { scroll: false });
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Staff member"
        value={shown.actor ?? ""}
        onChange={(event) => go({ ...shown, actor: event.target.value || null, before: null })}
        className={SELECT}
      >
        <option value="">All Staff</option>
        {withValue(actors, shown.actor).map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Area"
        value={shown.area ?? ""}
        onChange={(event) => go({ ...shown, area: event.target.value || null, before: null })}
        className={SELECT}
      >
        <option value="">All areas</option>
        {withValue(areas, shown.area).map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The options, with the chosen value added when no option has it, so the select shows it. */
function withValue(options: FilterOption[], value: string | null): FilterOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label: value }];
}

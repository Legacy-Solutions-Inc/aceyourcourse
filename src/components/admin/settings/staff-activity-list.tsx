import Link from "next/link";

import {
  activityActorLabel,
  activityAreaOf,
  activityAreaOptions,
  activityChanges,
  activityHref,
} from "@/lib/admin/staff-activity-view";
import { formatDateTime } from "@/lib/manila-time";
import { paths } from "@/paths";
import type { StaffActivityEntry, StaffActivityList as List } from "@/services/admin.types";

import { StaffActivityFilters } from "./staff-activity-filters";

const pageLink =
  "flex min-h-10 items-center border-[1.5px] bg-ayc-paper px-3.5 text-sm font-bold hover:bg-ayc-sand";

/**
 * Staff Activity, for Owners (Phase 4, ticket 15; spec, Phase 4 → Orders
 * Admin): who changed what in the Admin, and when, PayMongo's own changes
 * included, newest first, 50 to a page. Filters by Staff member and area,
 * and "Older" and "Newest" by the cursor, all in the URL. Read-only: nothing
 * here edits or deletes a record.
 */
export function StaffActivityList({ list }: { list: List }) {
  const { query, entries, next, actors, entities } = list;
  const filtered = query.actor !== null || query.area !== null;
  const actorOptions = actors.map((actor) => {
    const { name, email } = activityActorLabel(actor);
    return { value: actor.email, label: email === null ? name : `${name} · ${email}` };
  });
  const areaOptions = activityAreaOptions(entities).map(({ key, label }) => ({
    value: key,
    label,
  }));

  return (
    <section aria-labelledby="staff-activity" className="flex max-w-250 min-w-0 flex-col gap-3">
      <Link
        href={paths.admin.settings}
        className="flex min-h-10 w-fit items-center text-sm font-semibold text-ayc-blue underline underline-offset-4"
      >
        ← Settings
      </Link>
      <h2
        id="staff-activity"
        className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
      >
        STAFF ACTIVITY
      </h2>
      <p className="text-sm leading-normal">
        Who changed what in the Admin, and when, including PayMongo’s automatic changes. Times are
        in Manila. Nothing here can be edited or deleted.
      </p>

      <StaffActivityFilters query={query} actors={actorOptions} areas={areaOptions} />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-[1.5px] bg-ayc-paper px-3.5 py-7 text-center text-sm text-muted-foreground">
          <p>No activity</p>
          {filtered ? (
            <Link
              href={paths.admin.staffActivity}
              className="font-semibold text-ayc-blue underline underline-offset-4"
            >
              Show all activity
            </Link>
          ) : null}
        </div>
      ) : (
        <ol aria-label="Staff Activity" className="flex flex-col border-[1.5px] bg-ayc-paper">
          {entries.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      {query.before !== null || next !== null ? (
        <nav aria-label="Staff Activity pages" className="flex flex-wrap gap-2">
          {query.before !== null ? (
            <Link href={activityHref({ ...query, before: null })} className={pageLink}>
              Newest
            </Link>
          ) : null}
          {next !== null ? (
            <Link href={activityHref({ ...query, before: next })} className={pageLink}>
              Older
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

/** One record: when, who, the area, the action and what it changed, then its values. */
function ActivityItem({ entry }: { entry: StaffActivityEntry }) {
  const who = activityActorLabel(entry.actor);
  const { added, removed, changed } = activityChanges(entry.before, entry.after);
  const changes = [
    { label: "Changed", fields: changed },
    { label: "Added", fields: added },
    { label: "Removed", fields: removed },
  ].filter(({ fields }) => fields.length > 0);

  return (
    <li className="flex min-w-0 flex-col gap-1.5 border-b border-ayc-ruled px-3.5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <time dateTime={entry.at} className="font-mono text-xs text-muted-foreground">
          {formatDateTime(entry.at)}
        </time>
        <span className="border-[1.5px] px-1.5 font-mono text-[10px] font-bold tracking-[0.06em]">
          {activityAreaOf(entry.entity).label}
        </span>
      </div>
      <p className="text-sm wrap-anywhere">
        <span className="font-bold">{who.name}</span>
        {who.email === null ? null : <span className="text-muted-foreground"> · {who.email}</span>}
      </p>
      <p className="font-mono text-xs wrap-anywhere">
        {entry.action} · {entry.entity} {entry.entityId}
      </p>
      {changes.length > 0 ? (
        <ul aria-label="What changed" className="flex flex-col gap-0.5 text-[13px]">
          {changes.map(({ label, fields }) => (
            <li key={label} className="wrap-anywhere">
              {label}: {fields.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
      <details className="text-[13px]">
        <summary className="flex min-h-10 w-fit cursor-pointer items-center font-semibold text-ayc-blue">
          Before and after
        </summary>
        <div className="mt-2 grid gap-2 wide:grid-cols-2">
          <Values label="BEFORE" value={entry.before} />
          <Values label="AFTER" value={entry.after} />
        </div>
      </details>
    </li>
  );
}

function Values({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate">
        {label}
      </span>
      <pre className="max-h-80 overflow-auto border bg-white p-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap">
        {value === null || value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

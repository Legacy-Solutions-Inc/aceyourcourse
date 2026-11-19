import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLoggedAt } from "@/lib/admin/time";
import { userListHref } from "@/lib/admin/users-list";
import { pageSummary, passEnd, roleLabel, USER_FILTER_LABELS } from "@/lib/admin/users-view";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import { type AdminUserList, type AdminUserRow, USER_FILTERS } from "@/services/admin.types";

import { UserSearch } from "./user-search";

interface UserListProps {
  list: AdminUserList;
  /** The time of this request, for which passes have ended. */
  now: Date;
}

const EVERYONE = { q: null, filter: "all", page: 1 } as const;

const chip =
  "flex min-h-9 items-center rounded-full border-[1.5px] px-3 text-[13px] font-semibold hover:bg-ayc-sand";
const head = "h-auto px-0 py-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";
const missingText = "text-[13px] text-muted-foreground";

/**
 * The Users list (mockup 649–657; BUILD-MAP §3.10; story 129): "Search by name
 * or email", the filter chips and the pages, all in the URL, then the Members
 * the seam matched, newest first. A Member's name opens their detail page.
 */
export function UserList({ list, now }: UserListProps) {
  const { query, rows, matching, total, pageCount } = list;
  return (
    <section aria-label="Users list" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <UserSearch query={query} />
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {USER_FILTERS.map((filter) => (
            <Link
              key={filter}
              href={userListHref({ ...query, filter, page: 1 })}
              aria-current={query.filter === filter ? "true" : undefined}
              className={cn(
                chip,
                query.filter === filter
                  ? "border-ayc-navy bg-ayc-orange hover:bg-ayc-orange"
                  : "border-ayc-rule",
              )}
            >
              {USER_FILTER_LABELS[filter]}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-[1.5px] bg-ayc-paper">
        <Table className="table-fixed wide:min-w-180">
          <TableHeader>
            <TableRow className="border-b-[1.5px] hover:bg-transparent">
              <TableHead className={cn(head, "pl-3.5")}>USER</TableHead>
              <TableHead className={cn(head, "hidden w-24 wide:table-cell")}>
                TARGET EXAMS
              </TableHead>
              <TableHead className={cn(head, "hidden w-44 wide:table-cell")}>
                ACCESS PASS ENDS
              </TableHead>
              <TableHead className={cn(head, "hidden w-48 wide:table-cell")}>
                ACTIVE DEVICE
              </TableHead>
              <TableHead className={cn(head, "w-26 pr-3.5")}>ROLE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <UserRow key={row.userId} row={row} now={now} />
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3.5 py-7 text-center text-sm text-muted-foreground">
            {total === 0 ? (
              <p>
                No Members yet. Members appear here after their first sign-in to the Member App.
              </p>
            ) : (
              <>
                <p>No users match. Clear the search or filter.</p>
                <Link
                  href={userListHref(EVERYONE)}
                  className="font-semibold text-ayc-blue underline underline-offset-4"
                >
                  Show every Member
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          {pageSummary({ query, rows: rows.length, matching })}
        </p>
        {pageCount > 1 ? (
          <nav aria-label="Pages" className="flex items-center gap-3 text-[13px] font-semibold">
            {query.page > 1 ? (
              <Link
                href={userListHref({ ...query, page: query.page - 1 })}
                className="flex min-h-10 items-center text-ayc-blue underline-offset-4 hover:underline"
              >
                ← Previous
              </Link>
            ) : null}
            <span className="font-mono text-[11px] text-muted-foreground">
              PAGE {query.page} OF {pageCount}
            </span>
            {query.page < pageCount ? (
              <Link
                href={userListHref({ ...query, page: query.page + 1 })}
                className="flex min-h-10 items-center text-ayc-blue underline-offset-4 hover:underline"
              >
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

/** One Member (mockup 653). On a phone, the middle columns fold into the first. */
function UserRow({ row, now }: { row: AdminUserRow; now: Date }) {
  const exams = <TargetExams codes={row.targetExams} />;
  const passes = <Passes row={row} now={now} />;
  const device = <Device row={row} />;
  return (
    <TableRow className="border-ayc-ruled align-top hover:bg-ayc-sand/40">
      <TableCell className="py-2.75 pr-2.5 pl-3.5 whitespace-normal">
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={paths.admin.user(row.userId)}
            className="w-fit font-bold wrap-anywhere text-ayc-navy underline-offset-2 hover:underline"
          >
            {row.name ?? row.email}
          </Link>
          {row.name ? (
            <span className="font-mono text-[11px] wrap-anywhere text-muted-foreground">
              {row.email}
            </span>
          ) : null}
          <span className="mt-1 flex flex-col gap-0.5 wide:hidden">
            {exams}
            {passes}
            {device}
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {exams}
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {passes}
      </TableCell>
      <TableCell className="hidden px-0 py-2.75 whitespace-normal wide:table-cell">
        {device}
      </TableCell>
      <TableCell className="py-2.75 pr-3.5 pl-0 whitespace-normal">
        <span className="flex flex-col gap-0.5 font-mono text-[11px] font-bold">
          <span className={row.role === "member" ? "text-ayc-slate" : "text-ayc-blue"}>
            {roleLabel(row.role)}
          </span>
          {row.betaTester ? <span className="text-ayc-warning">BETA TESTER</span> : null}
        </span>
      </TableCell>
    </TableRow>
  );
}

function TargetExams({ codes }: { codes: readonly string[] }) {
  if (codes.length === 0) return <span className={missingText}>No Target Exam</span>;
  return <span className="font-mono text-xs font-bold text-ayc-blue">{codes.join(" · ")}</span>;
}

/** Each pass's end, by its day in Manila; an ended one in red. */
function Passes({ row, now }: { row: AdminUserRow; now: Date }) {
  if (row.accessPasses.length === 0) return <span className={missingText}>No pass</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {row.accessPasses.map(({ examCode, endsAt }) => {
        const { date, expired } = passEnd(endsAt, now);
        return (
          <span
            key={examCode}
            className={cn(
              "font-mono text-xs font-medium",
              expired ? "text-destructive" : "text-foreground",
            )}
          >
            {expired ? `${examCode} · ENDED ${date}` : `${examCode} · ${date}`}
          </span>
        );
      })}
    </span>
  );
}

function Device({ row }: { row: AdminUserRow }) {
  if (!row.activeDevice) return <span className={missingText}>No Active Device</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[13px]">{row.activeDevice.deviceLabel}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        SINCE {formatLoggedAt(row.activeDevice.claimedAt)}
      </span>
    </span>
  );
}

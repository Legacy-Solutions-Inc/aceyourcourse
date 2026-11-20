import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/manila-time";
import type { PrivacyRequestType } from "@/lib/member-app/privacy-requests";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { AdminPrivacyRequest } from "@/services/admin.types";

interface PrivacyRequestsProps {
  /** Every Member's requests, soonest due first, as the seam orders them. */
  requests: readonly AdminPrivacyRequest[];
}

const TYPE_LABELS: Record<PrivacyRequestType, string> = {
  "data-copy": "DATA COPY",
  deletion: "DELETION",
};

const head = "h-auto px-0 py-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ayc-slate";
const cell = "py-2.75 whitespace-normal";
const mono = "font-mono text-xs font-medium";

/** Pure: a date or an instant as its day in Manila, "19 NOV 2026". */
const day = (iso: string) => formatDate(iso).toUpperCase();

/**
 * The Users screen's Privacy Requests (Phase 3, ticket 18; story 133): every
 * Member's request for a copy of their data or for their account to be
 * deleted, soonest due first, with when it was asked for, when it's due (7 or
 * 30 days, in Manila) and its status; one still open after its due date is
 * flagged OVERDUE, and one done says the day. Each request's type opens its
 * screen, where it's carried out (ticket 19); a Member's name opens their
 * detail page. Once their account is deleted, the request stays, saying only
 * that.
 */
export function PrivacyRequests({ requests }: PrivacyRequestsProps) {
  return (
    <section aria-label="Privacy Requests" className="flex min-w-0 flex-col gap-2.5">
      <div className="border-[1.5px] bg-ayc-paper">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="border-b-[1.5px] hover:bg-transparent">
              <TableHead className={cn(head, "w-24 pl-3.5")}>TYPE</TableHead>
              <TableHead className={head}>MEMBER</TableHead>
              <TableHead className={cn(head, "hidden w-32 wide:table-cell")}>REQUESTED</TableHead>
              <TableHead className={cn(head, "w-28")}>DUE</TableHead>
              <TableHead className={cn(head, "w-24 pr-3.5")}>STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </TableBody>
        </Table>
        {requests.length === 0 ? (
          <p className="px-3.5 py-7 text-center text-sm text-muted-foreground">
            No Privacy Requests. Members ask for a copy of their data, or for their account to be
            deleted, from Account in the Member App.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** One request. On a phone, the day it was asked for folds under the Member. */
function RequestRow({ request }: { request: AdminPrivacyRequest }) {
  const { id, type, status, requestedAt, dueOn, overdue, member, doneAt } = request;
  return (
    <TableRow className="border-ayc-ruled align-top hover:bg-ayc-sand/40">
      <TableCell className={cn(cell, "pr-2.5 pl-3.5 font-mono text-[11px] font-bold")}>
        <Link
          href={paths.admin.privacyRequest(id)}
          className={cn(
            "underline underline-offset-2 hover:no-underline",
            type === "deletion" ? "text-destructive" : "text-ayc-blue",
          )}
        >
          {TYPE_LABELS[type]}
          <span className="sr-only"> · {member?.email ?? "account deleted"}</span>
        </Link>
      </TableCell>
      <TableCell className={cn(cell, "pr-2.5")}>
        <span className="flex min-w-0 flex-col gap-0.5">
          {member ? (
            <Link
              href={paths.admin.user(member.userId)}
              className="w-fit font-bold wrap-anywhere text-ayc-navy underline-offset-2 hover:underline"
            >
              {member.name ?? member.email}
            </Link>
          ) : (
            <span className="text-[13px] text-muted-foreground">Account deleted</span>
          )}
          {member?.name ? (
            <span className="font-mono text-[11px] wrap-anywhere text-muted-foreground">
              {member.email}
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-muted-foreground wide:hidden">
            REQUESTED {day(requestedAt)}
          </span>
        </span>
      </TableCell>
      <TableCell className={cn(cell, mono, "hidden px-0 wide:table-cell")}>
        {day(requestedAt)}
      </TableCell>
      <TableCell className={cn(cell, mono, "px-0", overdue && "font-bold text-destructive")}>
        {day(dueOn)}
      </TableCell>
      <TableCell className={cn(cell, "pr-3.5 pl-0")}>
        <span className="flex flex-col gap-0.5 font-mono text-[11px] font-bold">
          <span className={status === "open" ? "text-foreground" : "text-ayc-slate"}>
            {status.toUpperCase()}
          </span>
          {doneAt ? (
            <span className="text-[10px] font-medium text-ayc-slate">{day(doneAt)}</span>
          ) : null}
          {overdue ? <span className="text-destructive">OVERDUE</span> : null}
        </span>
      </TableCell>
    </TableRow>
  );
}

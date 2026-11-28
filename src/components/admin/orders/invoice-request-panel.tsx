"use client";

import { useState } from "react";

import { useStaffAction } from "@/components/admin/settings/use-staff-action";
import type { AdminAction } from "@/lib/admin/action";
import { formatDateTime } from "@/lib/manila-time";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import { cn } from "@/lib/utils";

interface InvoiceRequestPanelProps {
  reference: string;
  request: InvoiceRequest;
  markSent: AdminAction<InvoiceRequest>;
}

const term = "font-mono text-xs font-medium text-muted-foreground";

/**
 * An Order's Invoice Request on its detail page (Phase 4, ticket 08; story
 * 151v): the name, address and TIN the Member asked to have on the official
 * invoice, and when. The Owner issues the invoice outside the app and emails
 * it from the support inbox, then marks it sent here: the line says when and
 * by whom from then on, and the Member sees "Invoice sent · check your email".
 * The app sends no email.
 */
export function InvoiceRequestPanel({ reference, request, markSent }: InvoiceRequestPanelProps) {
  const { pending, run } = useStaffAction();
  const [problem, setProblem] = useState<string | null>(null);

  function mark() {
    setProblem(null);
    run(markSent, { reference }, (state) => {
      if (state.status === "saved") return;
      if (state.status === "refused") {
        const { error } = state;
        setProblem(
          error.kind === "invalid"
            ? (error.formError ?? "NOTHING WAS MARKED")
            : error.kind === "forbidden"
              ? error.message
              : "THIS ORDER ISN’T THERE ANY MORE · RELOAD THE PAGE",
        );
      } else {
        setProblem("COULDN’T REACH THE SERVER · NOTHING CHANGED");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className={term}>NAME</dt>
        <dd className="font-semibold wrap-anywhere">{request.name}</dd>
        <dt className={term}>ADDRESS</dt>
        <dd className="wrap-anywhere whitespace-pre-line">{request.address}</dd>
        <dt className={term}>TIN</dt>
        <dd className="font-mono text-[13px]">{request.tin ?? "None given"}</dd>
        <dt className={term}>REQUESTED</dt>
        <dd>{formatDateTime(request.requestedAt)}</dd>
      </dl>
      {request.sentAt ? (
        <p className="font-mono text-[11px] font-bold text-ayc-success">
          ✓ SENT {formatDateTime(request.sentAt).toUpperCase()}
          {request.sentBy ? ` · ${request.sentBy.name.toUpperCase()}` : ""}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Issue the official invoice outside the app and email it from the support inbox, then
            mark it sent. The app doesn’t email the Member.
          </p>
          <button
            type="button"
            onClick={mark}
            disabled={pending}
            className={cn(
              "min-h-10.5 cursor-pointer border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground",
              pending && "cursor-wait opacity-70",
            )}
          >
            {pending ? "Marking…" : "Mark invoice sent"}
          </button>
        </>
      )}
      {problem ? (
        <p role="alert" className="font-mono text-[11px] font-medium text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

import Link from "next/link";

import { paths } from "@/paths";

import type { AcknowledgementView } from "./billing-view";
import { type InvoiceRequestAction, InvoiceRequestForm } from "./invoice-request-form";
import { PrintButton } from "./print-button";

const LABEL = "block font-mono text-[11px] font-bold tracking-[0.06em] text-muted-foreground";

interface PaymentAcknowledgementDocumentProps {
  view: AcknowledgementView;
  /** The Member's name, which the name on the official invoice starts as. */
  memberName: string;
  /** "Request official invoice"'s Server Action (ticket 08). */
  requestInvoice: InvoiceRequestAction;
}

/**
 * A Paid Order's Payment Acknowledgement (Phase 4, ticket 06; BUILD-MAP §3
 * "Receipt", L662–674; spec, Phase 4 → Payment Acknowledgement; stories 143,
 * 144): printable, labelled as not an official invoice. Printing leaves out
 * everything but the document. Under it, "Request official invoice" (ticket
 * 08; story 151j): the short form until the request is made, then "Invoice
 * requested", later "Invoice sent · check your email".
 */
export function PaymentAcknowledgementDocument({
  view,
  memberName,
  requestInvoice,
}: PaymentAcknowledgementDocumentProps) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-4 px-4 pt-6 pb-24 wide:px-10 wide:pt-10 wide:pb-10 print:p-0"
    >
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link
          href={paths.memberApp.billing}
          className="flex min-h-12 items-center border-[1.5px] px-4.5 text-[15px] font-bold"
        >
          ← Billing
        </Link>
        <PrintButton className="min-h-12 cursor-pointer border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground" />
      </div>
      <article
        aria-labelledby="acknowledgement-title acknowledgement-number"
        className="flex w-full max-w-155 flex-col gap-4.5 border-[1.5px] bg-white p-[clamp(20px,4vw,40px)] text-ayc-navy print:max-w-none print:border-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="acknowledgement-title" className="text-2xl font-extrabold tracking-[-0.02em]">
              Payment Acknowledgement
            </h1>
            <p className="text-sm font-semibold">This is not an official invoice</p>
          </div>
          <p className="flex flex-col items-end font-mono text-xs leading-normal">
            <span id="acknowledgement-number" className="font-bold">
              {view.number}
            </span>
            <span>{view.date}</span>
          </p>
        </header>
        {view.test ? (
          <p className="self-start bg-ayc-navy px-2 py-1 font-mono text-[11px] font-bold text-ayc-paper">
            TEST PAYMENT · NO REAL MONEY
          </p>
        ) : null}
        <div className="grid gap-3.5 text-sm leading-normal sm:grid-cols-2">
          <div>
            <span className={LABEL}>BILLED TO</span>
            {view.billedTo.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </div>
          <div>
            <span className={LABEL}>SELLER</span>
            {view.seller.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-2.5 border-y-[1.5px] py-3 text-[15px]">
          <span>
            <b>{view.item}</b>
            <span className="block text-[13px] text-muted-foreground">{view.period}</span>
          </span>
          <span className="font-bold">{view.amount}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold tracking-[0.06em]">TOTAL PAID</span>
          <span className="text-3xl font-black tracking-[-0.02em]">{view.amount}</span>
        </div>
        {view.vatLine ? <p className="text-sm">{view.vatLine}</p> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
          <dt>METHOD</dt>
          <dd>{view.method}</dd>
          <dt>PAYMONGO REF</dt>
          <dd className="break-all">{view.payMongoReference}</dd>
          <dt>STATUS</dt>
          <dd className="font-bold text-ayc-success">{view.status}</dd>
        </dl>
      </article>
      <section
        aria-labelledby="request-invoice"
        className="flex max-w-155 flex-col gap-2.5 border-[1.5px] border-dashed p-4 print:hidden"
      >
        <h2 id="request-invoice" className="font-mono text-[11px] font-bold tracking-[0.06em]">
          Request official invoice
        </h2>
        {view.invoice.line ? <p className="text-sm font-semibold">{view.invoice.line}</p> : null}
        {view.invoice.canRequest ? (
          <>
            <p className="text-sm leading-normal">
              Official invoices are issued outside the app and emailed to you. Tell us the name and
              address to put on it.
            </p>
            <InvoiceRequestForm
              reference={view.number}
              defaultName={memberName}
              action={requestInvoice}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

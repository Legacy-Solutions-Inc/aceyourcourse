"use client";

import Link from "next/link";

import type { RenewalBannerView } from "@/lib/member-app/renewal";

import { BetaAccessNote } from "./content-state";
import { useDismissible } from "./use-dismissible";

interface RenewalBannersProps {
  /** The banners to show, soonest end first, read on the server for this render. */
  banners: RenewalBannerView[];
  /** The Server Action that hides one Exam's banner for the signed-in Member until the next Manila day. */
  dismiss: (examCode: string) => Promise<{ ok: boolean }>;
}

const UNDISMISSED = "Couldn’t dismiss this. Try again.";

/**
 * The renewal banners (Phase 4, ticket 12; spec, Phase 4 planning decisions →
 * Renewal reminders; stories 141 and 142; mockup Dashboard "Ending-soon
 * block"): one per Exam whose Access Pass ends within 7 days, on Home and on
 * that Exam's study screens, each leading to that Exam's Plans, or saying to
 * ask AYC while it has none on sale. No email.
 *
 * "Dismiss" hides the banner at once and tells the server, which hides it
 * until the next Manila day on every device; should the server not answer,
 * the banner comes back with a message (useDismissible).
 */
export function RenewalBanners({ banners, dismiss }: RenewalBannersProps) {
  const { list, isDismissed, failed, onDismiss } = useDismissible(dismiss);

  const shown = banners.filter(({ examCode }) => !isDismissed(examCode));
  if (shown.length === 0) return null;

  return (
    <section aria-label="Access ending soon">
      <ul ref={list} className="flex flex-col gap-2">
        {shown.map((banner, index) => (
          <li
            key={banner.examCode}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-[1.5px] bg-ayc-paper py-2 pr-1.5 pl-3.5 shadow-hard-sm"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-destructive">
              ENDING SOON
            </span>
            <p className="min-w-0 flex-1 basis-60 text-sm font-semibold">
              {banner.text}
              {banner.renew.kind === "contact" ? (
                <span className="block font-normal">
                  <BetaAccessNote contactEmail={banner.renew.contactEmail} />
                </span>
              ) : null}
            </p>
            {banner.renew.kind === "plans" ? (
              <Link
                href={banner.renew.href}
                className="flex min-h-11 items-center border-[1.5px] border-ayc-navy bg-ayc-orange px-3.5 text-sm font-extrabold text-ayc-navy"
              >
                {banner.renew.label}
              </Link>
            ) : null}
            <button
              type="button"
              data-dismiss
              aria-label={`Dismiss: ${banner.text}`}
              onClick={() => onDismiss(banner.examCode, index)}
              className="min-h-11 cursor-pointer px-3 text-sm font-bold text-ayc-blue underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
            {failed === banner.examCode ? (
              <p role="alert" className="w-full pb-1 text-sm font-semibold text-destructive">
                {UNDISMISSED}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

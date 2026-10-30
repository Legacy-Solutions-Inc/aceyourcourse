import Link from "next/link";

import { websiteCopy } from "@/content/website";
import { paths } from "@/paths";
import type { Product } from "@/services/catalogue.types";

const copy = websiteCopy.product.app;

/**
 * Whether a Live Product is also in the Member App. It renders only while the
 * Member App switch is on: the All-Access band for a Product in the app,
 * otherwise a "Printed only" note.
 */
export function ProductAppBand({
  product,
  memberAppLive,
}: {
  product: Product;
  memberAppLive: boolean;
}) {
  if (!memberAppLive || product.state !== "live") return null;
  if (!product.availableInApp) {
    return (
      <p className="font-mono text-xs leading-normal text-ayc-slate uppercase">
        {copy.printedOnly}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 border-[1.5px] border-ayc-navy bg-ayc-blue p-4 text-ayc-cream">
      <div className="flex flex-[1_1_220px] flex-col gap-1.25">
        <p className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-orange uppercase">
          {copy.bandTitle}
        </p>
        <p className="text-[15px] leading-normal">
          {copy.band} Included in {product.examCode} All-Access.
        </p>
      </div>
      <Link
        href={paths.memberApp.plans}
        className="flex min-h-12 items-center border-[1.5px] border-ayc-navy bg-ayc-cream px-4.5 text-[15px] font-bold text-ayc-navy no-underline hover:text-ayc-navy"
      >
        {copy.seePlans}
      </Link>
    </div>
  );
}

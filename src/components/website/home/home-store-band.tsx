import Link from "next/link";
import { useId } from "react";

import { StoreButton } from "@/components/website/store-button";
import { homeCopy } from "@/content/home";
import { storeLinksFor } from "@/lib/catalogue/store-links";
import { paths } from "@/paths";
import type { WebsiteSettings } from "@/services/catalogue.types";

const copy = homeCopy.storeBand;

interface HomeStoreBandProps {
  shopLinks: WebsiteSettings["shopLinks"];
  memberAppLive: boolean;
}

/**
 * Home's closing store band: a button to each Marketplace's shop page (one
 * with no shop link has none), each recording a `marketplace_click`. "Digital
 * in the app" and "Open the app" show only while the Member App switch is on.
 */
export function HomeStoreBand({ shopLinks, memberAppLive }: HomeStoreBandProps) {
  const headingId = useId();
  const shops = storeLinksFor(null, shopLinks);

  return (
    <section aria-labelledby={headingId} className="border-y-[1.5px] border-ayc-navy bg-ayc-orange">
      <div className="mx-auto flex max-w-324 flex-wrap items-center justify-between gap-x-10 gap-y-6 px-[clamp(20px,5vw,72px)] py-[clamp(40px,5vw,64px)]">
        <h2
          id={headingId}
          className="max-w-[20ch] text-[clamp(28px,3.4vw,44px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-ayc-navy"
        >
          {memberAppLive ? copy.headingApp : copy.heading}
        </h2>
        {shops.length > 0 || memberAppLive ? (
          <div className="flex flex-wrap gap-2.5">
            {shops.map(({ marketplace, storeLink }) => (
              <StoreButton
                key={marketplace}
                marketplace={marketplace}
                storeLink={storeLink}
                // Shopee's own orange would vanish on the orange band.
                className={
                  marketplace === "shopee"
                    ? "bg-ayc-navy text-ayc-cream shadow-ayc-cream hover:text-ayc-cream"
                    : undefined
                }
              />
            ))}
            {memberAppLive ? (
              <Link
                href={paths.memberApp.home}
                className="flex min-h-13.5 items-center gap-1.5 border-[1.5px] border-ayc-navy bg-ayc-blue px-4 text-base font-extrabold text-ayc-cream no-underline shadow-hard transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-cream hover:shadow-hard-md motion-reduce:transition-none"
              >
                {copy.openApp} <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

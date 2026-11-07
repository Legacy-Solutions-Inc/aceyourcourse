import { useId } from "react";

import { StoreButton } from "@/components/website/store-button";
import { examPageCopy } from "@/content/exam-pages";
import { storeLinksFor } from "@/lib/catalogue/store-links";
import type { WebsiteSettings } from "@/services/catalogue.types";

interface StoreBandProps {
  examCode: string;
  shopLinks: WebsiteSettings["shopLinks"];
}

/**
 * "Get your {code} reviewer from our official stores." with a button to each
 * Marketplace's shop page. A Marketplace with no shop link has no button.
 */
export function StoreBand({ examCode, shopLinks }: StoreBandProps) {
  const headingId = useId();
  const shops = storeLinksFor(null, shopLinks);

  return (
    <section aria-labelledby={headingId} className="border-y-[1.5px] border-ayc-navy bg-ayc-orange">
      <div className="mx-auto flex max-w-324 flex-wrap items-center justify-between gap-x-10 gap-y-6 px-[clamp(20px,5vw,72px)] py-[clamp(40px,5vw,64px)]">
        <h2
          id={headingId}
          className="max-w-[20ch] text-[clamp(28px,3.4vw,44px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-ayc-navy"
        >
          {examPageCopy.storeBand.heading(examCode)}
        </h2>
        {shops.length > 0 ? (
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
          </div>
        ) : null}
      </div>
    </section>
  );
}

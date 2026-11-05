import { useId } from "react";

import { StoreButton } from "@/components/website/store-button";
import { aboutCopy } from "@/content/about";
import type { AboutCopy } from "@/lib/catalogue/about-content";
import { storeLinksFor } from "@/lib/catalogue/store-links";
import type { WebsiteSettings } from "@/services/catalogue.types";

const labels = aboutCopy.roots;
const labelCaption = "text-[11px] text-ayc-slate uppercase";

interface IloiloRootsProps {
  /** The heading, the text and the label's "To" line: Staff's, or today's. */
  copy: AboutCopy["roots"];
  shopLinks: WebsiteSettings["shopLinks"];
}

/**
 * "Iloilo City roots": where orders ship from, a button to each Marketplace's
 * shop page (one with no shop link has none), each recording a
 * `marketplace_click`, and the mock shipping label.
 */
export function IloiloRoots({ copy, shopLinks }: IloiloRootsProps) {
  const headingId = useId();
  const labelId = useId();
  const shops = storeLinksFor(null, shopLinks);

  return (
    <section
      aria-labelledby={headingId}
      className="border-y-[1.5px] border-ayc-navy bg-ayc-blue text-ayc-cream"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center gap-[clamp(36px,6vw,96px)] px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,112px)]">
        <div className="flex min-w-0 flex-[1.2_1_320px] flex-col gap-5">
          {/* Cream, not the mockup's orange: orange on blue is under 3:1. */}
          <p className="font-mono text-xs font-bold tracking-[0.08em] uppercase">
            {labels.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(34px,4.4vw,60px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
          >
            {copy.heading}
          </h2>
          <p className="max-w-[34em] text-[17px] leading-normal text-ayc-on-navy-soft">
            {copy.body}
          </p>
          {shops.length > 0 ? (
            <ul aria-label={labels.storesLabel} className="flex flex-wrap gap-2.5">
              {shops.map(({ marketplace, storeLink }) => (
                <li key={marketplace}>
                  <StoreButton
                    marketplace={marketplace}
                    storeLink={storeLink}
                    // The default blue focus ring would vanish on this blue band.
                    className={
                      marketplace === "shopee"
                        ? "bg-ayc-cream hover:bg-ayc-orange focus-visible:outline-ayc-cream"
                        : "border-ayc-cream bg-transparent text-ayc-cream hover:bg-ayc-cream/12 hover:text-ayc-cream focus-visible:outline-ayc-cream"
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] justify-center">
          <figure
            aria-labelledby={labelId}
            className="w-full max-w-100 -rotate-2 border-[1.5px] border-ayc-navy bg-ayc-paper font-mono text-ayc-navy shadow-hard-lg transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 motion-reduce:transition-none"
          >
            <p className="flex items-center justify-between border-b-[1.5px] border-ayc-navy bg-ayc-orange px-4 py-3 text-xs font-bold tracking-[0.08em] uppercase">
              <span id={labelId}>{labels.label.title}</span> <span>{labels.label.via}</span>
            </p>
            <p className="flex flex-col gap-1 border-b-[1.5px] border-dashed border-ayc-navy p-4">
              <span className={labelCaption}>{labels.label.from}</span>{" "}
              <span className="text-base font-bold">{labels.label.sender}</span>{" "}
              <span className="text-sm">{labels.label.senderCity}</span>
            </p>
            <p className="flex flex-col gap-1 p-4">
              <span className={labelCaption}>{labels.label.to}</span>{" "}
              <span className="font-sans text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">
                {copy.recipient}
              </span>
            </p>
            <div
              aria-hidden="true"
              className="mx-4 mb-4 h-9 bg-[repeating-linear-gradient(90deg,var(--ayc-navy)_0_3px,transparent_3px_5px,var(--ayc-navy)_5px_6px,transparent_6px_9px,var(--ayc-navy)_9px_13px,transparent_13px_15px)]"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

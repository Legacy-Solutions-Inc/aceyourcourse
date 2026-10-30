import Link from "next/link";

import { productsPageCopy } from "@/content/products-page";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const copy = productsPageCopy.physicalOrApp;

const column = "flex flex-col gap-4 border-[1.5px] p-[clamp(22px,3vw,32px)] shadow-hard-md";
const tag = "font-mono text-[11px] font-bold tracking-[0.04em] uppercase";

/**
 * "Physical or app?": the printed copies next to the Member App. It renders
 * only while the Member App switch is on.
 */
export function PhysicalOrApp({ memberAppLive }: { memberAppLive: boolean }) {
  if (!memberAppLive) return null;
  return (
    <section
      aria-labelledby="physical-or-app-heading"
      className="border-y-[1.5px] border-ayc-navy bg-ayc-blue text-ayc-cream"
    >
      <div className="mx-auto flex max-w-324 flex-col gap-[clamp(28px,3.5vw,44px)] px-[clamp(20px,5vw,72px)] py-[clamp(56px,7vw,104px)]">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-orange uppercase">
              {copy.eyebrow}
            </p>
            <h2
              id="physical-or-app-heading"
              className="max-w-[16ch] text-[clamp(34px,4.4vw,60px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
            >
              {copy.heading}
            </h2>
          </div>
          <p className="max-w-[26em] text-[17px] leading-normal text-ayc-on-navy-soft">
            {copy.intro}
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5.5">
          <div className={cn(column, "border-ayc-navy bg-ayc-cream text-ayc-navy")}>
            <div className="flex items-baseline justify-between gap-2.5">
              <h3 className="text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-0.02em]">
                {copy.physical.title}
              </h3>
              <p className={cn(tag, "text-ayc-blue")}>{copy.physical.tag}</p>
            </div>
            <Points points={copy.physical.points} markClassName="text-ayc-blue" />
          </div>

          <div
            className={cn(column, "border-ayc-cream bg-ayc-navy text-ayc-cream shadow-ayc-orange")}
          >
            <div className="flex items-baseline justify-between gap-2.5">
              <h3 className="text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-0.02em]">
                {copy.app.title}
              </h3>
              <p className={cn(tag, "text-ayc-orange")}>{copy.app.tag}</p>
            </div>
            <Points points={copy.app.points} markClassName="text-ayc-orange" />
            <Link
              href={paths.memberApp.plans}
              className="mt-auto flex min-h-12 items-center gap-1.5 self-start border-[1.5px] border-ayc-cream bg-ayc-orange px-4.5 text-[15px] font-extrabold text-ayc-navy no-underline hover:bg-ayc-cream hover:text-ayc-navy focus-visible:outline-ayc-cream"
            >
              {copy.app.cta}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Points({ points, markClassName }: { points: readonly string[]; markClassName: string }) {
  return (
    <ul className="flex flex-col gap-2.5 text-base leading-snug">
      {points.map((point) => (
        <li key={point} className="flex gap-2.5">
          <span aria-hidden="true" className={cn("font-extrabold", markClassName)}>
            +
          </span>
          {point}
        </li>
      ))}
    </ul>
  );
}

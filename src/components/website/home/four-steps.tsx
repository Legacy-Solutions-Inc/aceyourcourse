import Link from "next/link";
import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { homeCopy, homeSteps, type HomeStepTarget } from "@/content/home";
import { listNumber } from "@/lib/text";
import { cn } from "@/lib/utils";

const copy = homeCopy.steps;

/** Each step's number badge, in order (L318–321). */
const BADGES = [
  "bg-ayc-orange text-ayc-navy",
  "bg-ayc-blue text-ayc-cream",
  "bg-ayc-navy text-ayc-cream",
  "bg-ayc-cream text-ayc-navy",
];

const hrefOf = (target: HomeStepTarget) =>
  "section" in target ? `#${HOME_SECTION_IDS[target.section]}` : target.path;

/**
 * "Four steps to your reviewer". While the Member App switch is off, the
 * app-free variant of each step shows, so no step mentions or links to the app.
 */
export function FourSteps({ memberAppLive }: { memberAppLive: boolean }) {
  const headingId = useId();
  const steps = homeSteps.map((step) => (memberAppLive ? step.appOn : step.appOff));

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 flex-col gap-[clamp(32px,4vw,56px)] px-[clamp(20px,5vw,72px)] pt-[clamp(64px,8vw,120px)] pb-[clamp(40px,5vw,72px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <h2
          id={headingId}
          className="max-w-[14ch] text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
        >
          {copy.heading}
        </h2>
        <p className="max-w-[28em] text-[17px] leading-normal text-ayc-slate">{copy.intro}</p>
      </div>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-8.5 h-0.5 bg-[repeating-linear-gradient(90deg,var(--ayc-navy)_0_8px,transparent_8px_14px)]"
        />
        <ol className="relative grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-17 items-center justify-center rounded-full border-[1.5px] border-ayc-navy font-mono text-[22px] font-bold",
                  BADGES[index % BADGES.length],
                )}
              >
                {listNumber(index)}
              </span>
              <h3 className="text-[clamp(22px,2.2vw,28px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="max-w-[30ch] text-base leading-normal text-pretty text-ayc-slate">
                {step.description}
              </p>
              <Link
                href={hrefOf(step.target)}
                className="self-start border-b-2 border-ayc-blue pb-px text-sm font-bold text-ayc-blue no-underline hover:border-ayc-blue-dark hover:text-ayc-blue-dark"
              >
                {step.cta}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

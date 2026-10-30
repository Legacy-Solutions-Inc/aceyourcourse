import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { homeCopy } from "@/content/home";
import { listNumber } from "@/lib/text";

const copy = homeCopy.authenticity;

/**
 * "Copies are going around." `#authenticity`, the footer's "Spot a fake copy":
 * the IPOPHIL stamp, why copies aren't ours, and three steps to buying the
 * real one. Orange text on this blue is under 3:1, so the stamp's name sits on
 * an orange block and the step numbers are cream.
 */
export function Authenticity() {
  const headingId = useId();
  return (
    <section
      id={HOME_SECTION_IDS.authenticity}
      aria-labelledby={headingId}
      className="scroll-mt-24 border-t-[1.5px] border-ayc-navy bg-ayc-blue text-ayc-cream"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center gap-[clamp(36px,6vw,96px)] px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,112px)]">
        <div className="flex min-w-0 flex-[1_1_260px] justify-center">
          <p className="flex -rotate-7 flex-col items-center gap-2 border-3 border-ayc-cream px-7 py-6 text-center font-mono outline-[1.5px] outline-offset-6 outline-ayc-cream outline-solid">
            <span className="text-xs font-bold tracking-[0.2em] uppercase">{copy.stamp.top}</span>
            <span className="bg-ayc-orange px-2 py-1 text-[clamp(42px,5.2vw,68px)] leading-none font-bold tracking-[0.04em] text-ayc-navy">
              {copy.stamp.name}
            </span>
            <span className="text-[11px] font-medium tracking-[0.14em] uppercase">
              {copy.stamp.bottom}
            </span>
          </p>
        </div>
        <div className="flex min-w-0 flex-[1.6_1_340px] flex-col gap-5.5">
          <h2
            id={headingId}
            className="text-[clamp(34px,4.4vw,60px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
          >
            {copy.heading}
          </h2>
          <p className="max-w-[36em] text-[17px] leading-relaxed text-ayc-on-navy-soft">
            {copy.body}
          </p>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
            {copy.steps.map((step, index) => (
              <li
                key={step.text}
                className="flex flex-col gap-2.5 border-[1.5px] border-ayc-cream/50 p-4"
              >
                <span aria-hidden="true" className="font-mono text-sm font-bold">
                  {listNumber(index)}
                </span>
                <span className="text-[15px] leading-snug">
                  {step.text}
                  {"highlight" in step ? (
                    <>
                      {" "}
                      <span className="bg-ayc-cream/15 box-decoration-clone px-1.25 py-px font-mono text-[13px]">
                        {step.highlight}
                      </span>
                      .
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

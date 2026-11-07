import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { homeCopy, promoVideo } from "@/content/home";

const copy = homeCopy.video;

/**
 * "See what's inside before you order." `#video`: the hero's promo video in a
 * player with controls. preload="none" keeps every video byte off the network
 * until the Visitor presses play; only the poster loads.
 */
export function VideoSection() {
  const headingId = useId();
  return (
    <section
      id={HOME_SECTION_IDS.video}
      aria-labelledby={headingId}
      className="scroll-mt-24 border-y-[1.5px] border-ayc-navy bg-ayc-sand"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center gap-[clamp(28px,4vw,64px)] px-[clamp(20px,5vw,72px)] py-[clamp(56px,7vw,104px)]">
        <div className="flex max-w-105 flex-[1_1_280px] flex-col gap-4">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(34px,4.2vw,56px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
          >
            {copy.heading}
          </h2>
          <p className="text-[17px] leading-relaxed text-ayc-slate">{copy.intro}</p>
        </div>
        <div className="relative min-w-0 flex-[2_1_360px] pr-3.5 pb-3.5">
          <div
            aria-hidden="true"
            className="absolute inset-[14px_0_0_14px] border-[1.5px] border-ayc-navy bg-ayc-orange"
          />
          <video
            src={promoVideo.src}
            poster={promoVideo.poster}
            controls
            playsInline
            preload="none"
            aria-label={copy.playerLabel}
            className="relative block aspect-video w-full border-[1.5px] border-ayc-navy bg-ayc-navy"
          />
        </div>
      </div>
    </section>
  );
}

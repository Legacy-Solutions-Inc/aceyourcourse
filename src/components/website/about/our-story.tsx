import Image from "next/image";
import { useId } from "react";

import { ABOUT_SECTION_IDS } from "@/components/website/about/section-ids";
import { aboutCopy, storyPhotos } from "@/content/about";
import { cn } from "@/lib/utils";

const copy = aboutCopy.story;

const eyebrow = "font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase";
const panelLabel = "font-mono text-[11px] font-bold tracking-[0.08em] uppercase";
const panelTitle = "text-[clamp(22px,2.4vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]";

// The timeline's dots, and the photos' tilts and shadows, as in the mockup.
const STEP_DOTS = ["bg-ayc-cream", "bg-ayc-orange", "bg-ayc-blue"] as const;
const PHOTO_FRAMES = [
  "-rotate-1 shadow-[6px_6px_0_var(--ayc-navy)]",
  "rotate-[0.8deg] shadow-[6px_6px_0_var(--ayc-orange)]",
  "-rotate-[0.6deg] shadow-[6px_6px_0_var(--ayc-blue)]",
] as const;

interface OurStoryProps {
  /** The names of every Exam on the Website, in order, for the timeline's "Now". */
  examNames: string[];
}

/**
 * "Our story" (#story): why AYC exists, the before and after, the "How it
 * grew" timeline with the catalogue's Exams on its "Now" line, and three
 * photos.
 */
export function OurStory({ examNames }: OurStoryProps) {
  const headingId = useId();
  const timelineId = useId();
  const steps = [
    { label: copy.first.label, title: copy.first.title, body: null },
    { label: copy.now.label, title: null, body: copy.now.body(examNames) },
    { label: copy.today.label, title: null, body: copy.today.body },
  ];

  return (
    <section
      id={ABOUT_SECTION_IDS.story}
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-[clamp(40px,5vw,64px)] px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,120px)]"
    >
      <div className="flex flex-wrap gap-[clamp(28px,5vw,80px)]">
        <div className="flex flex-[1_1_300px] flex-col gap-3.5">
          <p className={eyebrow}>{copy.eyebrow}</p>
          <h2
            id={headingId}
            className="max-w-[12ch] text-[clamp(34px,4.4vw,60px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
        </div>
        <div className="flex min-w-0 flex-[1.6_1_360px] flex-col gap-4.5 text-lg leading-relaxed text-ayc-slate">
          {copy.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-pretty">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] border-[1.5px] border-ayc-navy shadow-hard-lg">
        <div className="-mr-[1.5px] flex flex-col gap-3.5 border-r-[1.5px] border-ayc-navy bg-ayc-sand p-[clamp(22px,3vw,36px)]">
          <p className={cn(panelLabel, "text-ayc-slate")}>{copy.before.label}</p>
          <p
            className={cn(
              panelTitle,
              "line-through decoration-ayc-star decoration-3 [text-decoration-skip-ink:none]",
            )}
          >
            {copy.before.title}
          </p>
          <p className="text-base leading-normal text-ayc-slate">{copy.before.body}</p>
        </div>
        <div className="flex flex-col gap-3.5 bg-ayc-paper p-[clamp(22px,3vw,36px)]">
          <p className={cn(panelLabel, "text-ayc-blue")}>{copy.after.label}</p>
          <p className={panelTitle}>{copy.after.title}</p>
          <ul className="flex flex-wrap gap-1.5">
            {copy.after.specs.map((spec) => (
              <li
                key={spec}
                className="border-[1.5px] border-ayc-navy bg-ayc-cream px-2.25 py-1.75 font-mono text-xs leading-none font-bold uppercase"
              >
                {spec}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4.5">
        <h3 id={timelineId} className={eyebrow}>
          {copy.timelineHeading}
        </h3>
        <ol
          aria-labelledby={timelineId}
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4.5"
        >
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="relative flex flex-col gap-2.5 border-t-[3px] border-ayc-navy pt-5.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -top-2.25 left-0 size-3.75 rounded-full border-2 border-ayc-navy",
                  STEP_DOTS[index],
                )}
              />
              <span className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-slate uppercase">
                {step.label}
              </span>{" "}
              {step.title ? (
                <span className="text-[clamp(20px,2vw,24px)] leading-[1.15] font-extrabold tracking-[-0.02em]">
                  {step.title}
                </span>
              ) : null}
              {step.body ? (
                <span className="text-[17px] leading-relaxed text-pretty text-ayc-slate">
                  {step.body}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-[clamp(22px,2.4vw,30px)] leading-tight font-extrabold tracking-[-0.02em]">
          {copy.beginning}
        </p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
          {storyPhotos.map((photo, index) => (
            <div
              key={photo.src}
              className={cn(
                "relative aspect-4/3 overflow-hidden border-[1.5px] border-ayc-navy bg-ayc-sand",
                PHOTO_FRAMES[index],
              )}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 81rem) 390px, (min-width: 47.5rem) 33vw, 100vw"
                className={cn("object-cover", index === 2 && "object-[center_30%]")}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

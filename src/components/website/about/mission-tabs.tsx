import { useId } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aboutCopy } from "@/content/about";
import type { AboutCopy } from "@/lib/catalogue/about-content";
import { listNumber } from "@/lib/text";

const { eyebrow } = aboutCopy.mission;

interface MissionTabsProps {
  /** The heading, the intro and the four tabs: Staff's, or today's. */
  copy: AboutCopy["mission"];
}

/**
 * "The mission": the four principles as tabs down the side, operable with the
 * arrow keys, and the chosen one's copy beside them. The first is chosen at
 * first. On a phone the panel sits under the tabs. Always four, numbered here.
 */
export function MissionTabs({ copy }: MissionTabsProps) {
  const headingId = useId();
  const eyebrowId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="border-t-[1.5px] border-ayc-navy bg-ayc-cream bg-[linear-gradient(color-mix(in_srgb,var(--ayc-blue)_9%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--ayc-blue)_9%,transparent)_1px,transparent_1px)] bg-size-[24px_24px]"
    >
      <div className="mx-auto flex max-w-324 flex-col gap-[clamp(28px,4vw,48px)] px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,112px)]">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <div className="flex flex-col gap-3">
            <p
              id={eyebrowId}
              className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase"
            >
              {eyebrow}
            </p>
            <h2
              id={headingId}
              className="text-[clamp(34px,4.4vw,60px)] leading-none font-extrabold tracking-[-0.035em]"
            >
              {copy.heading}
            </h2>
          </div>
          <p className="max-w-[30em] text-[17px] leading-normal text-ayc-slate">{copy.intro}</p>
        </div>

        <Tabs
          defaultValue="0"
          orientation="vertical"
          className="grid gap-0 border-[1.5px] border-ayc-navy bg-ayc-paper shadow-hard-lg wide:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        >
          <TabsList
            aria-labelledby={eyebrowId}
            className="flex h-auto w-auto flex-col items-stretch rounded-none border-b-[1.5px] border-ayc-navy bg-transparent p-0 text-ayc-navy group-data-[orientation=vertical]/tabs:h-auto wide:border-r-[1.5px] wide:border-b-0"
          >
            {copy.tabs.map((tab, index) => (
              <TabsTrigger
                key={index}
                value={String(index)}
                className="group/tab h-auto min-h-19 flex-1 justify-start gap-4.5 rounded-none border-0 border-b-[1.5px] border-ayc-navy px-[clamp(18px,2.4vw,28px)] py-4 text-left whitespace-normal text-ayc-navy transition-colors last:border-b-0 hover:bg-ayc-sand hover:text-ayc-navy focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ayc-blue data-[state=active]:bg-ayc-navy data-[state=active]:text-ayc-cream data-[state=active]:shadow-none data-[state=active]:focus-visible:outline-ayc-orange motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-[clamp(20px,2vw,26px)] leading-none font-bold text-ayc-slate group-data-[state=active]/tab:text-ayc-orange"
                >
                  {listNumber(index)}
                </span>
                <span className="flex-1 text-[clamp(18px,1.8vw,22px)] leading-[1.15] font-extrabold tracking-[-0.015em]">
                  {tab.title}
                </span>
                <span
                  aria-hidden="true"
                  className="text-lg font-extrabold opacity-0 transition-opacity group-data-[state=active]/tab:opacity-100 motion-reduce:transition-none"
                >
                  →
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {copy.tabs.map((tab, index) => (
            <TabsContent
              key={index}
              value={String(index)}
              className="flex animate-in flex-col justify-center gap-4.5 p-[clamp(24px,3.4vw,48px)] duration-300 fade-in slide-in-from-right-4 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ayc-blue focus-visible:outline-solid motion-reduce:animate-none"
            >
              {/* Blue, not the mockup's orange: orange on paper is under 3:1. */}
              <span
                aria-hidden="true"
                className="text-[clamp(72px,10vw,140px)] leading-[0.85] font-black tracking-[-0.05em] text-ayc-blue"
              >
                {listNumber(index)}
              </span>
              <h3 className="text-[clamp(26px,3vw,40px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
                {tab.title}
              </h3>
              <p className="max-w-[34em] text-lg leading-relaxed text-pretty text-ayc-slate">
                {tab.body}
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

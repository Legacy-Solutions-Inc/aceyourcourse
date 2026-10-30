"use client";

import { useId, useState } from "react";

import { EXAM_SECTION_IDS } from "@/components/website/exam/section-ids";
import { examPageCopy } from "@/content/exam-pages";
import { productFormatLabel } from "@/lib/catalogue/format";
import { cn } from "@/lib/utils";
import type { ProductFormat } from "@/services/catalogue.types";

const copy = examPageCopy.products;

/** A Product in the list, with its card rendered on the server. */
export interface ExamProductItem {
  id: string;
  format: ProductFormat;
  live: boolean;
  card: React.ReactNode;
}

interface ExamProductsProps {
  examCode: string;
  /** Live Products best selling first, then Coming Soon. */
  items: ExamProductItem[];
}

/**
 * "Every {code} reviewer". When the Live Products come in more than one
 * format, chips filter the list in place; each counts Live Products only, and
 * Coming Soon Products of the chosen format stay in the list.
 */
export function ExamProducts({ examCode, items }: ExamProductsProps) {
  const [chosen, setChosen] = useState<ProductFormat | null>(null);
  const headingId = useId();

  const live = items.filter((item) => item.live);
  const formats = [...new Set(live.map((item) => item.format))];
  const chips =
    formats.length > 1
      ? [
          { format: null, label: copy.all, count: live.length },
          ...formats.map((format) => ({
            format,
            label: productFormatLabel(format),
            count: live.filter((item) => item.format === format).length,
          })),
        ]
      : [];
  const shown = chips.length > 0 && chosen ? items.filter((item) => item.format === chosen) : items;

  return (
    <section
      id={EXAM_SECTION_IDS.products}
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-5.5 px-[clamp(20px,5vw,72px)] pt-[clamp(40px,5vw,64px)] pb-[clamp(64px,8vw,112px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading(examCode)}
          </h2>
        </div>
        {chips.length > 0 ? (
          <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const pressed = chip.format === chosen;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setChosen(chip.format)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-ayc-navy px-3.5 text-sm font-semibold transition-colors motion-reduce:transition-none",
                    pressed ? "bg-ayc-navy text-ayc-cream" : "text-ayc-navy hover:bg-ayc-sand",
                  )}
                >
                  {chip.label}
                  <span className="font-mono text-[11px] font-bold opacity-80">
                    {chip.count}
                    <span className="sr-only">{copy.chipCount(chip.count)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <ul
        aria-labelledby={headingId}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-x-6.5 gap-y-8 pt-2"
      >
        {shown.map((item) => (
          <li key={item.id} className="flex">
            {item.card}
          </li>
        ))}
      </ul>
    </section>
  );
}

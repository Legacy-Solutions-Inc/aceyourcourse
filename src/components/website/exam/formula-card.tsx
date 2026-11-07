"use client";

import { useId, useState } from "react";

import { examPageCopy, type SampleCard } from "@/content/exam-pages";
import { cn } from "@/lib/utils";

const copy = examPageCopy.tryCard;

const face =
  "absolute inset-0 flex flex-col justify-between gap-3 border-[1.5px] border-ayc-navy p-[clamp(18px,2vw,26px)] text-ayc-navy backface-hidden";
const faceLabel =
  "flex justify-between gap-2.5 font-mono text-[11px] leading-none font-bold tracking-[0.06em] uppercase";
const subjectChip = "bg-ayc-navy px-1.75 py-1.25 text-ayc-cream";
const stepButton =
  "cursor-pointer text-sm font-bold text-ayc-cream focus-visible:outline-ayc-cream";

interface FormulaCardProps {
  examCode: string;
  cards: SampleCard[];
}

/**
 * One sample formula card at a time. Clicking it, or Enter or Space on it,
 * turns it over to the formula; Previous and Next step through the cards, each
 * front side up. The face turned away is hidden from screen readers, and the
 * flip button is described by the face showing. Renders nothing without cards.
 */
export function FormulaCard({ examCode, cards }: FormulaCardProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const id = useId();
  const card = cards[index];
  if (!card) return null;

  const step = (by: number) => {
    setIndex((index + by + cards.length) % cards.length);
    setFlipped(false);
  };
  const subject = `${examCode} · ${card.subject}`;
  const promptId = `${id}-prompt`;
  const formulaId = `${id}-formula`;
  const noteId = `${id}-note`;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-3/2 perspective-[1400px]">
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-x-3.5 translate-y-2.5 rotate-4 border-[1.5px] border-ayc-cream bg-ayc-navy"
        />
        {/* Keyed by card, so a new card shows its front at once instead of turning over. */}
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div aria-hidden={flipped} className={cn(face, "bg-ayc-paper")}>
            <p className={faceLabel}>
              <span className={subjectChip}>{subject}</span>
              <span className="text-ayc-slate">
                {index + 1} / {cards.length}
              </span>
            </p>
            <p
              id={promptId}
              className="text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance"
            >
              {card.front}
            </p>
            <p className="font-mono text-xs font-medium text-ayc-slate">
              {copy.tapToFlip} <span aria-hidden="true">↻</span>
            </p>
          </div>
          <div aria-hidden={!flipped} className={cn(face, "rotate-y-180 bg-ayc-orange")}>
            <p className={faceLabel}>
              <span className={subjectChip}>{subject}</span>
              <span>{copy.back}</span>
            </p>
            <p
              id={formulaId}
              className="text-center font-mono text-[clamp(20px,2.4vw,30px)] leading-tight font-bold"
            >
              {card.back}
            </p>
            <p id={noteId} className="text-[13px] leading-snug">
              {card.note}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={copy.flip}
          aria-pressed={flipped}
          aria-describedby={flipped ? `${formulaId} ${noteId}` : promptId}
          onClick={() => setFlipped(!flipped)}
          className="absolute inset-0 cursor-pointer focus-visible:outline-ayc-cream"
        />
      </div>

      <div className="flex items-center justify-between gap-2.5 pt-1.5">
        <button type="button" onClick={() => step(-1)} className={stepButton}>
          <span aria-hidden="true">←</span> {copy.previous}
        </button>
        <div aria-hidden="true" className="flex gap-1.5">
          {cards.map((sample, position) => (
            <span
              key={sample.front}
              className={cn(
                "h-1.5 transition-[width] motion-reduce:transition-none",
                position === index ? "w-7 bg-ayc-orange" : "w-2.5 bg-ayc-cream/45",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          className={cn(stepButton, "border-b-2 border-ayc-orange pb-0.5")}
        >
          {copy.next} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

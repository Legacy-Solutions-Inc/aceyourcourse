"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";

import { homeCopy, type TryCard } from "@/content/home";
import { REDUCED_MOTION, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const copy = homeCopy.tryCard;
/** How long each face shows before the card turns by itself. */
const AUTO_FLIP_MS = 3200;

const face =
  "absolute inset-0 flex flex-col border-[1.5px] border-ayc-navy text-ayc-navy backface-hidden";
const faceLabel =
  "flex justify-between gap-2.5 font-mono text-[11px] leading-none font-bold tracking-[0.06em] uppercase";
const subjectChip = "bg-ayc-navy px-1.75 py-1.25 text-ayc-cream";

/**
 * "Try a card · tap to flip": one sample card at a time, its topic on the
 * front and the real card on the back. Clicking it, or Enter or Space on it,
 * turns it over; the Exam dots and "Next card" choose a card, front side up.
 * It turns over by itself every 3.2 s, then moves on, until the Visitor first
 * presses or touches it or moves keyboard focus into it, and never under
 * reduced motion.
 * The face turned away is hidden from screen readers, and the flip button is
 * described by the face showing. Renders nothing without cards.
 */
export function TryACard({ cards }: { cards: TryCard[] }) {
  const [shown, setShown] = useState({ index: 0, flipped: false });
  const [touched, setTouched] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const id = useId();

  useEffect(() => {
    // Null until the browser is known: wait rather than move.
    if (touched || reducedMotion !== false || cards.length === 0) return;
    const timer = setInterval(() => {
      setShown(({ index, flipped }) =>
        flipped ? { index: (index + 1) % cards.length, flipped: false } : { index, flipped: true },
      );
    }, AUTO_FLIP_MS);
    return () => clearInterval(timer);
  }, [touched, reducedMotion, cards.length]);

  const card = cards[shown.index];
  if (!card) return null;

  const { index, flipped } = shown;
  const stop = () => setTouched(true);
  const show = (next: number) => setShown({ index: next, flipped: false });
  const subject = `${card.examCode} · ${card.subjectCode}`;
  const headingId = `${id}-heading`;
  const topicId = `${id}-topic`;
  const imageId = `${id}-image`;

  return (
    <section
      aria-labelledby={headingId}
      // Pointer events cover mouse, touch and pen; focus covers the keyboard.
      onPointerDownCapture={stop}
      onFocusCapture={stop}
      className="mx-auto flex w-full max-w-115 min-w-0 flex-[1_1_320px] flex-col gap-4.5"
    >
      <h2
        id={headingId}
        className="font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-orange uppercase"
      >
        {copy.heading}
      </h2>
      <div className="relative aspect-3/2 perspective-[1400px]">
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-x-4 translate-y-2.5 rotate-5 border-[1.5px] border-ayc-cream bg-ayc-blue"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 -translate-x-2 translate-y-1.5 -rotate-3 border-[1.5px] border-ayc-navy bg-ayc-orange"
        />
        {/* Keyed by card, so a new card shows its front at once instead of turning over. */}
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] transform-3d motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div
            aria-hidden={flipped}
            className={cn(face, "justify-between bg-ayc-paper p-[clamp(18px,2vw,26px)]")}
          >
            <p className={faceLabel}>
              <span className={subjectChip}>{subject}</span>
              <span className="text-ayc-slate">{copy.front}</span>
            </p>
            <p className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue uppercase">
                {copy.topic}
              </span>
              <span
                id={topicId}
                className="text-[clamp(24px,2.6vw,34px)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance"
              >
                {card.topic}
              </span>
            </p>
            <p className="font-mono text-xs font-medium text-ayc-slate">
              {copy.tapToSee} <span aria-hidden="true">↻</span>
            </p>
          </div>
          <div
            aria-hidden={!flipped}
            className={cn(face, "rotate-y-180 gap-2 bg-white p-[clamp(14px,1.6vw,20px)]")}
          >
            <p className={faceLabel}>
              <span className={subjectChip}>{subject}</span>
              <span className="text-ayc-slate">{copy.back}</span>
            </p>
            <div className="relative min-h-0 flex-1">
              <Image
                id={imageId}
                src={card.image}
                alt={card.alt}
                fill
                sizes="(min-width: 47.5rem) 420px, 90vw"
                className="object-contain"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={copy.flip}
          aria-pressed={flipped}
          aria-describedby={flipped ? imageId : topicId}
          onClick={() => setShown({ index, flipped: !flipped })}
          className="absolute inset-0 cursor-pointer focus-visible:outline-ayc-cream"
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div role="group" aria-label={copy.chooseCard} className="flex gap-1.5">
          {cards.map((sample, position) => (
            <button
              key={sample.examCode}
              type="button"
              aria-label={copy.showCard(sample.examCode)}
              aria-pressed={position === index}
              onClick={() => show(position)}
              className="flex h-7.5 min-w-9.5 cursor-pointer items-center justify-center border-[1.5px] border-ayc-cream font-mono text-[11px] font-bold text-ayc-cream transition-colors hover:bg-ayc-cream/15 focus-visible:outline-ayc-cream aria-pressed:bg-ayc-cream aria-pressed:text-ayc-navy motion-reduce:transition-none"
            >
              {sample.examCode}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => show((index + 1) % cards.length)}
          className="cursor-pointer border-b-2 border-ayc-orange pb-0.5 text-sm font-bold text-ayc-cream focus-visible:outline-ayc-cream"
        >
          {copy.next} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

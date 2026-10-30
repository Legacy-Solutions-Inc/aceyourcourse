"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Subject } from "@/services/catalogue.types";

interface SubjectChipsProps {
  subjects: Subject[];
  /** The id of the label that names the list. */
  labelledBy: string;
}

/**
 * An Exam's Subjects as chips. Each shows its code, and its name includes the
 * full Subject name for screen readers. Hovering or focusing a chip shows the
 * full name above it (WCAG 1.4.13): the pointer can move onto it, Escape hides
 * it, and it stays inside the list so it never runs off a phone screen. The
 * tooltip is visual only, since screen readers already hear the full name.
 */
export function SubjectChips({ subjects, labelledBy }: SubjectChipsProps) {
  const [open, setOpen] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const tooltip = useRef<HTMLSpanElement>(null);
  const close = () => setOpen(null);

  // Sit on top of the chip's row, as far left as the chip but inside the list.
  useLayoutEffect(() => {
    const chip = open === null ? null : chips.current[open];
    const element = list.current;
    const tip = tooltip.current;
    if (!chip || !element || !tip) return;
    const left = Math.min(chip.offsetLeft, element.clientWidth - tip.offsetWidth);
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.bottom = `${element.clientHeight - chip.offsetTop}px`;
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <ul
      ref={list}
      aria-labelledby={labelledBy}
      onMouseLeave={close}
      className="relative flex flex-wrap gap-1.5"
    >
      {subjects.map((subject, index) => (
        <li key={subject.code}>
          <button
            ref={(element) => {
              chips.current[index] = element;
            }}
            type="button"
            onMouseEnter={() => setOpen(index)}
            onFocus={() => setOpen(index)}
            onBlur={close}
            className="inline-flex cursor-default border-[1.5px] border-ayc-navy bg-ayc-cream px-2.25 py-1.75 font-mono text-xs leading-none font-bold text-ayc-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ayc-blue"
          >
            {subject.code}
            <span className="sr-only"> · {subject.name}</span>
          </button>
          {open === index ? (
            <span
              ref={tooltip}
              data-subject-tooltip
              aria-hidden="true"
              className="absolute z-10 w-max max-w-full bg-ayc-navy px-2 py-1.5 text-xs leading-snug font-semibold text-ayc-cream"
            >
              {subject.name}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

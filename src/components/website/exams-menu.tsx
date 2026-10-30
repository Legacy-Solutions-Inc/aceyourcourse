"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { isCurrentPath } from "@/components/website/site-links";
import { websiteCopy } from "@/content/website";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Exam } from "@/services/catalogue.types";

interface ExamsMenuProps {
  exams: ReadonlyArray<Pick<Exam, "code" | "name" | "board">>;
}

/**
 * The desktop nav's Exams menu: a disclosure button with a full-width panel
 * (the WAI-ARIA disclosure navigation pattern, not role="menu"). It opens by
 * click, Enter or Space, and closes on Escape, an outside click or a chosen
 * link. The panel is positioned against the sticky site header, so nothing
 * between them may be `position: relative`.
 */
export function ExamsMenu({ exams }: ExamsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname() ?? "";
  const onAnExamPage = exams.some((exam) =>
    isCurrentPath(pathname, paths.exams.details(exam.code)),
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold transition-colors hover:bg-ayc-sand",
          (open || onAnExamPage) && "bg-ayc-sand",
        )}
      >
        Exams
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-60 border-y-[1.5px] bg-ayc-paper shadow-panel"
      >
        <div className="mx-auto flex max-w-360 flex-col gap-3 px-[clamp(20px,5vw,72px)] pt-6 pb-7">
          <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {websiteCopy.nav.examsMenuLabel}
          </p>
          <ul className="grid grid-cols-5 gap-2.5">
            {exams.map((exam) => (
              <li key={exam.code} className="flex">
                <Link
                  href={paths.exams.details(exam.code)}
                  onClick={() => setOpen(false)}
                  className="flex flex-1 flex-col gap-2 border-[1.5px] bg-background p-4 transition-[transform,box-shadow,background-color] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-ayc-paper hover:shadow-hard hover:shadow-ayc-orange motion-reduce:transition-none motion-reduce:hover:translate-none"
                >
                  <span className="font-mono text-2xl leading-none font-bold tracking-tight">
                    {exam.code}
                  </span>
                  <span className="text-sm leading-tight font-semibold">{exam.name}</span>
                  <span className="mt-auto font-mono text-[11px] font-medium text-muted-foreground">
                    {exam.board}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={paths.products.list}
            onClick={() => setOpen(false)}
            className="self-end text-[15px] font-extrabold text-ayc-blue hover:text-ayc-blue-dark"
          >
            {websiteCopy.nav.browseAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

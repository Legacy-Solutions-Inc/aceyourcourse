import Link from "next/link";

import { examPageCopy } from "@/content/exam-pages";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Exam } from "@/services/catalogue.types";

interface ExamSwitcherProps {
  exams: ReadonlyArray<Pick<Exam, "code">>;
  current: string;
}

/**
 * A link to every Exam page, so switching Exam changes the URL (the mockup's
 * switcher only changed state, Exam_v2.dc.html L245). The current one is
 * marked with aria-current.
 */
export function ExamSwitcher({ exams, current }: ExamSwitcherProps) {
  return (
    <nav aria-label={examPageCopy.switcherLabel}>
      <ul className="flex flex-wrap gap-1.5">
        {exams.map((exam) => {
          const isCurrent = exam.code === current;
          return (
            <li key={exam.code}>
              <Link
                href={paths.exams.details(exam.code)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex h-8.5 min-w-11 items-center justify-center border-[1.5px] border-ayc-cream px-2.5 font-mono text-xs font-bold no-underline transition-colors focus-visible:outline-ayc-cream motion-reduce:transition-none",
                  isCurrent
                    ? "bg-ayc-cream text-ayc-navy hover:text-ayc-navy"
                    : "text-ayc-cream hover:bg-ayc-cream/15 hover:text-ayc-cream",
                )}
              >
                {exam.code}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

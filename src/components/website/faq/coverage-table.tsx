import Link from "next/link";

import { paths } from "@/paths";
import type { Exam } from "@/services/catalogue.types";

/**
 * The FAQ's coverage answer: each Exam with its Subject codes, from the
 * catalogue, each row linking to the Exam page.
 */
export function CoverageTable({ exams }: { exams: Exam[] }) {
  if (exams.length === 0) return null;
  return (
    <ul
      aria-label="Subjects per exam"
      className="flex flex-col border-[1.5px] border-ayc-navy bg-ayc-cream"
    >
      {exams.map((exam) => (
        <li key={exam.code} className="border-b border-ayc-ruled last:border-b-0">
          <Link
            href={paths.exams.details(exam.code)}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3 text-ayc-navy no-underline hover:bg-ayc-sand hover:text-ayc-navy"
          >
            <span className="flex min-w-48 flex-none items-center gap-2">
              <span className="bg-ayc-blue px-1.75 py-1.5 font-mono text-xs leading-none font-bold text-ayc-cream">
                {exam.code}
              </span>
              <span className="text-sm font-semibold">{exam.name}</span>
            </span>
            <span className="flex flex-[1_1_220px] flex-wrap gap-1.25">
              {exam.subjects.map((subject) => (
                <span
                  key={subject.code}
                  className="border-[1.5px] border-ayc-navy px-1.5 py-1.25 font-mono text-[11px] leading-none font-bold"
                >
                  {subject.code}
                </span>
              ))}
            </span>
            <span aria-hidden="true" className="text-sm font-extrabold text-ayc-blue">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

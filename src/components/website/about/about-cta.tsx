import Link from "next/link";
import { useId } from "react";

import { aboutCopy } from "@/content/about";
import { paths } from "@/paths";
import type { Exam } from "@/services/catalogue.types";

const labels = aboutCopy.cta;

const tile =
  "flex h-full flex-col gap-2 border-[1.5px] border-ayc-navy bg-ayc-paper p-4.5 text-ayc-navy no-underline shadow-hard transition-[transform,box-shadow] hover:-translate-x-0.75 hover:-translate-y-0.75 hover:text-ayc-navy hover:shadow-[7px_7px_0_var(--ayc-orange)] motion-reduce:transition-none";

interface AboutCtaProps {
  /** Staff's heading, or today's. */
  heading: string;
  /** Every Exam on the Website, in order: listExams(). */
  exams: Pick<Exam, "code" | "name">[];
}

/**
 * "Your turn. Find the reviewer for your board.": a tile per Exam going to its
 * Exam page (the mockup left out CPA), then "All reviewers" going to Products.
 */
export function AboutCta({ heading, exams }: AboutCtaProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 flex-col gap-6 px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,112px)]"
    >
      <h2
        id={headingId}
        className="max-w-[16ch] text-[clamp(36px,5vw,68px)] leading-none font-extrabold tracking-[-0.04em] text-balance"
      >
        {heading}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3">
        {exams.map((exam) => (
          <li key={exam.code}>
            <Link href={paths.exams.details(exam.code)} className={tile}>
              <span className="font-mono text-[26px] leading-none font-bold tracking-[-0.02em]">
                {exam.code}
              </span>{" "}
              <span className="text-sm leading-snug text-ayc-slate">{exam.name}</span>{" "}
              <span className="mt-auto text-[15px] font-extrabold text-ayc-blue">
                {labels.examCta} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={paths.products.list} className={tile}>
            <span
              aria-hidden="true"
              className="font-mono text-[26px] leading-none font-bold tracking-[-0.02em]"
            >
              +
            </span>{" "}
            <span className="mt-auto text-[15px] font-extrabold text-ayc-blue">
              {labels.allReviewers} <span aria-hidden="true">→</span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

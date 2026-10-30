import { useId } from "react";

import { examPageCopy } from "@/content/exam-pages";
import type { Exam } from "@/services/catalogue.types";

const copy = examPageCopy.subjects;

/** "What's covered": the Exam's Subjects as numbered cards, each with its code and full name. */
export function SubjectsCovered({ exam }: { exam: Pick<Exam, "code" | "board" | "subjects"> }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 flex-col gap-[clamp(28px,3.5vw,44px)] px-[clamp(20px,5vw,72px)] pt-[clamp(64px,8vw,112px)] pb-[clamp(40px,5vw,64px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow(exam.subjects.length, exam.board)}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
        </div>
        <p className="max-w-[28em] text-[17px] leading-normal text-ayc-slate">
          {copy.intro(exam.code)}
        </p>
      </div>
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        {exam.subjects.map((subject, index) => (
          <li
            key={subject.code}
            className="flex items-start gap-4 border-[1.5px] border-ayc-navy bg-ayc-paper p-5 shadow-hard transition-[transform,box-shadow] hover:-translate-x-0.75 hover:-translate-y-0.75 hover:shadow-[7px_7px_0_var(--ayc-blue)] motion-reduce:transition-none"
          >
            <span
              aria-hidden="true"
              className="pt-0.75 font-mono text-[13px] font-bold text-ayc-slate"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 flex-col gap-2">
              <span className="self-start bg-ayc-navy px-2 py-1.5 font-mono text-[13px] leading-none font-bold text-ayc-cream">
                {subject.code}
              </span>
              <span className="text-[19px] leading-tight font-bold tracking-[-0.01em] text-balance">
                {subject.name}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

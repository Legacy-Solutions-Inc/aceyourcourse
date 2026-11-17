import Link from "next/link";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";

interface ContentPickerProps {
  /** Every Exam, in the catalogue's order, each with its Subjects. */
  exams: readonly { code: string; subjects: readonly { code: string; name: string }[] }[];
  /** The Exam and Subject open now. */
  examCode: string;
  subjectCode: string | null;
}

const CHIP =
  "flex min-h-8.5 items-center gap-1.5 border-[1.5px] px-2.5 font-mono text-xs font-bold";

/**
 * Member App content's Exam → Subject picker (BUILD-MAP §3.6: exam chips,
 * then subject chips): links, so the open Subject is in the address.
 */
export function ContentPicker({ exams, examCode, subjectCode }: ContentPickerProps) {
  const exam = exams.find((candidate) => candidate.code === examCode);
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Exam" className="flex flex-wrap gap-1">
        {exams.map(({ code, subjects }) => (
          <li key={code}>
            <Link
              href={paths.admin.contentTopics(code, subjects[0]?.code ?? "")}
              aria-current={code === examCode ? "page" : undefined}
              className={cn(
                CHIP,
                code === examCode ? "bg-primary text-primary-foreground" : "bg-ayc-paper",
              )}
            >
              {code}
            </Link>
          </li>
        ))}
      </ul>
      {exam ? (
        <ul aria-label="Subject" className="flex flex-wrap gap-1">
          {exam.subjects.map(({ code, name }) => (
            <li key={code}>
              <Link
                href={paths.admin.contentTopics(exam.code, code)}
                aria-current={code === subjectCode ? "page" : undefined}
                title={name}
                className={cn(
                  CHIP,
                  code === subjectCode ? "bg-ayc-blue text-ayc-cream" : "bg-ayc-paper",
                )}
              >
                {code}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

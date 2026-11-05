import Link from "next/link";

import type { AdminAction } from "@/lib/admin/action";
import {
  examPagesHref,
  type ExamPageEditorKey,
  type ExamPagesPage,
  examSectionRows,
} from "@/lib/admin/exam-pages-view";
import type { SeoState } from "@/lib/admin/seo-check";
import { formatDate } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { AdminExamPage } from "@/services/admin.types";
import { SITE_PAGES } from "@/services/catalogue.schema";
import type { SitePageKey } from "@/services/catalogue.types";

import { ExamSectionSwitch } from "./exam-section-switch";

// Pages & promo's first two columns (mockup 84–108; BUILD-MAP §3.2): PAGES,
// then the selected page's Exam chips, "View page ↗", the Search & AI
// visibility card and SECTIONS · SHOW OR HIDE; or a Site page's chips, "View
// page ↗" and its Search & AI visibility card (ticket 20). Selecting goes
// through the URL, so a reload keeps it.

const LABEL = "font-mono text-[11px] font-medium tracking-[0.06em] text-muted-foreground";

/** Column 1, PAGES: the Exam pages, the Site pages, the Home promo banner and the announcement bar. */
export function ExamPagesNav({
  current,
  examCount,
}: {
  current: ExamPagesPage;
  examCount: number;
}) {
  const pages: { page: ExamPagesPage; title: string; note?: string }[] = [
    { page: "exam", title: "Exam pages", note: `× ${examCount}` },
    { page: "site", title: "Site pages", note: `× ${SITE_PAGES.length}` },
    { page: "promo", title: "Home promo banner" },
    { page: "announcement", title: "Announcement bar" },
  ];
  return (
    <nav aria-label="Pages" className="flex flex-col border-[1.5px] bg-ayc-paper">
      <h2 className="border-b-[1.5px] px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em]">
        PAGES
      </h2>
      <ul>
        {pages.map(({ page, title, note }) => (
          <li key={page}>
            <Link
              href={examPagesHref({ page })}
              scroll={false}
              aria-current={page === current ? "page" : undefined}
              className={cn(
                "flex justify-between gap-1.5 border-b border-ayc-ruled px-3 py-2.5 text-sm hover:bg-ayc-sand",
                page === current ? "bg-ayc-orange/15 font-bold" : "font-medium",
              )}
            >
              <span>{title}</span>
              {note ? (
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {note}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {/* The spec's note (2026-11-05), over the mockup's: the Site pages are editable now. */}
      <p className="px-3 py-2.5 text-xs leading-[1.45] text-muted-foreground">
        Menu, footer, and legal pages are fixed. Changes to those go through the developer.
      </p>
    </nav>
  );
}

interface ExamPageColumnProps {
  opened: AdminExamPage;
  /** Every Exam's code, in the catalogue's order, for the chips. */
  examCodes: string[];
  selected: ExamPageEditorKey;
  /** Search & AI visibility, from the title and description the page shows now. */
  seoState: SeoState;
  setSection: AdminAction<AdminExamPage>;
}

/** Column 2: the Exam chips, View page ↗, the cards and the sections. */
export function ExamPageColumn({
  opened,
  examCodes,
  selected,
  seoState,
  setSection,
}: ExamPageColumnProps) {
  const { exam, page } = opened;
  const date = page.officialExamDate;
  return (
    <section aria-label={`${exam.code} Exam page`} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={LABEL}>EXAM PAGES · {exam.code}</h2>
        <a
          href={paths.exams.details(exam.code)}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold whitespace-nowrap text-ayc-blue hover:underline"
        >
          View page <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <ul aria-label="Exam" className="flex flex-wrap gap-1">
        {examCodes.map((code) => (
          <li key={code}>
            <Link
              href={examPagesHref({ exam: code, section: selected })}
              scroll={false}
              aria-current={code === exam.code ? "page" : undefined}
              className={cn(
                "flex min-h-8.5 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold",
                code === exam.code ? "bg-primary text-primary-foreground" : "bg-ayc-paper",
              )}
            >
              {code}
            </Link>
          </li>
        ))}
      </ul>
      <Card
        href={examPagesHref({ exam: exam.code, section: "seo" })}
        current={selected === "seo"}
        title="Search & AI visibility"
        description="Page title, description, preview"
        state={<SeoStateLabel state={seoState} />}
      />
      <Card
        href={examPagesHref({ exam: exam.code, section: "date" })}
        current={selected === "date"}
        title="Official Exam Date"
        description="For the Member App’s countdown"
        state={
          <span className={date ? "text-foreground" : "text-muted-foreground"}>
            {date ? formatDate(date).toUpperCase() : "NOT SET"}
          </span>
        }
      />
      <h3 className={cn(LABEL, "pt-1.5 text-[10px] tracking-[0.08em]")}>SECTIONS · SHOW OR HIDE</h3>
      <ul className="flex flex-col gap-2">
        {examSectionRows(opened).map((row) => {
          const shown = row.toggle === null || page.sections[row.toggle];
          return (
            <li
              key={row.key}
              className={cn(
                "flex items-center gap-2.5 bg-ayc-paper px-3 py-2.5",
                row.key === selected ? "border-2 border-ayc-blue" : "border-[1.5px]",
                !shown && "border-dashed",
              )}
            >
              <Link
                href={examPagesHref({ exam: exam.code, section: row.key })}
                scroll={false}
                aria-current={row.key === selected ? "true" : undefined}
                className="flex min-w-0 flex-1 flex-col gap-0.5"
              >
                <span className="text-[15px] font-bold">{row.title}</span>
                <span className="text-xs text-muted-foreground">
                  {row.description}
                  {shown ? "" : " · HIDDEN ON SITE"}
                </span>
              </Link>
              {row.toggle ? (
                <ExamSectionSwitch
                  key={`${exam.code}-${row.toggle}`}
                  examCode={exam.code}
                  section={row.toggle}
                  on={shown}
                  title={row.title}
                  action={setSection}
                  aria-label={`Show ${row.title} on the ${exam.code} page`}
                />
              ) : (
                <span className="flex-none font-mono text-[9px] font-medium text-muted-foreground">
                  ALWAYS ON
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface SitePageColumnProps {
  site: SitePageKey;
  /** Where the page is on the Website, for "View page ↗". */
  path: string;
  /** Search & AI visibility, from the title and description the page shows now. */
  seoState: SeoState;
}

/** Column 2 for a Site page: the Site page chips, View page ↗ and Search & AI visibility. */
export function SitePageColumn({ site, path, seoState }: SitePageColumnProps) {
  const label = site.toUpperCase();
  return (
    <section aria-label={`${label} Site page`} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={LABEL}>SITE PAGES · {label}</h2>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold whitespace-nowrap text-ayc-blue hover:underline"
        >
          View page <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <ul aria-label="Site page" className="flex flex-wrap gap-1">
        {SITE_PAGES.map((page) => (
          <li key={page}>
            <Link
              href={examPagesHref({ page: "site", site: page })}
              scroll={false}
              aria-current={page === site ? "page" : undefined}
              className={cn(
                "flex min-h-8.5 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold",
                page === site ? "bg-primary text-primary-foreground" : "bg-ayc-paper",
              )}
            >
              {page.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
      <Card
        href={examPagesHref({ page: "site", site })}
        current
        title="Search & AI visibility"
        description="Page title, description, preview"
        state={<SeoStateLabel state={seoState} />}
      />
    </section>
  );
}

/** GOOD or CHECK, as the Search & AI visibility card shows it. */
function SeoStateLabel({ state }: { state: SeoState }) {
  return (
    <span className={state === "good" ? "text-ayc-success" : "text-ayc-warning"}>
      {state === "good" ? "GOOD" : "CHECK"}
    </span>
  );
}

interface CardProps {
  href: string;
  current: boolean;
  title: string;
  description: string;
  state: React.ReactNode;
}

/** A card that opens its editor in column 3, with its state on the right (mockup 95). */
function Card({ href, current, title, description, state }: CardProps) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 bg-ayc-paper px-3.5 py-3",
        current ? "border-2 border-ayc-blue" : "border-[1.5px]",
      )}
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <span className="font-mono text-[10px] font-bold">{state}</span>
    </Link>
  );
}

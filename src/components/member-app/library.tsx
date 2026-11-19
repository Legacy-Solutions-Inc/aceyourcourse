import Link from "next/link";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import { BetaAccessNote } from "./content-state";
import {
  isLocked,
  type LibraryItemState,
  type LibraryItemView,
  type LibraryTopicView,
} from "./library-view";

interface LibraryProps {
  /** The selected Target Exam: the Library is per Exam. */
  exam: { code: string; board: string };
  /** The Exam's Subjects, in order, for the tabs. */
  subjects: readonly { code: string; name: string }[];
  /** The Subject open now, or null for an Exam with none. */
  subject: { code: string; name: string } | null;
  /** The open Subject's Topics, in order, each item stated by the access decision. */
  topics: readonly LibraryTopicView[];
  /** Where Members ask AYC for access during the beta. */
  contactEmail: string;
}

const ITEM_CLASS: Record<LibraryItemState, string> = {
  open: "bg-background",
  "free-preview": "bg-background",
  locked: "border-dashed border-ayc-slate bg-transparent text-ayc-slate",
  expired: "border-dashed border-ayc-slate bg-transparent text-ayc-slate",
};

/** One deck, quiz or Reviewer PDF button: open, Free Preview, or locked. */
function ItemLink({ item, exam }: { item: LibraryItemView; exam: string }) {
  const locked = isLocked(item.state);
  const why =
    item.state === "expired" ? `your ${exam} All-Access ended` : `unlock with ${exam} All-Access`;
  return (
    <Link
      href={item.href}
      // A locked item's name says it's locked and why; the lock itself is decoration.
      aria-label={locked ? `${item.label}, locked: ${why}` : undefined}
      className={cn(
        "flex min-h-10 items-center gap-1.5 border-[1.5px] px-3 text-[13px] font-semibold",
        ITEM_CLASS[item.state],
      )}
    >
      {locked ? <span aria-hidden="true">🔒</span> : null}
      {item.label}
      {item.state === "free-preview" ? (
        <span className="font-mono text-[10px] font-bold tracking-[0.06em] whitespace-pre text-ayc-blue">
          {" · FREE PREVIEW"}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The Library (mockup `library`, BUILD-MAP §3; stories 93, 94 and 103): the
 * selected Target Exam's Subjects as tabs, then the open Subject's Topics in
 * order. Each Topic shows the Member's % done (story 93), kept when their
 * access ends, and the content Members can see, each open, Free Preview or
 * locked; an empty one says its content is still being prepared.
 */
export function Library({ exam, subjects, subject, topics, contactEmail }: LibraryProps) {
  const anyLocked = topics.some((topic) => topic.locked);
  return (
    <>
      {subjects.length > 1 ? (
        <nav aria-label="Subjects" className="-mb-1 overflow-x-auto border-b-[1.5px]">
          <ul className="flex">
            {subjects.map((tab) => {
              const current = tab.code === subject?.code;
              return (
                <li key={tab.code} className="-mr-[1.5px]">
                  <Link
                    href={paths.memberApp.librarySubject(tab.code)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-t-md border-[1.5px] border-b-0 px-4.5 font-mono text-sm font-bold tracking-[0.04em]",
                      current ? "bg-primary text-primary-foreground" : "bg-ayc-paper",
                    )}
                  >
                    {tab.code}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {subject ? (
        <section aria-labelledby="library-subject" className="flex flex-col gap-3">
          <h2 id="library-subject" className="text-[15px] font-semibold text-muted-foreground">
            {subject.name}
          </h2>
          {topics.length > 0 ? (
            <ol
              aria-label={`${subject.code} Topics`}
              className="flex flex-col border-[1.5px] bg-ayc-paper"
            >
              {topics.map((topic) => (
                <li
                  key={topic.id}
                  className="flex flex-wrap items-center gap-x-4.5 gap-y-2.5 border-b border-ayc-ruled px-4 py-3.5 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
                    <h3 className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs font-bold text-ayc-blue">
                        {topic.number}
                      </span>
                      <span className="text-[17px] font-bold">{topic.name}</span>
                    </h3>
                    {topic.items.length > 0 ? (
                      topic.percent === null ? null : (
                        <p className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="h-1.5 max-w-55 flex-1 bg-ayc-sand">
                            <span
                              className="block h-full bg-ayc-blue"
                              style={{ width: `${topic.percent}%` }}
                            />
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {topic.percent}% DONE
                          </span>
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Content for this Topic is still being prepared.
                      </p>
                    )}
                  </div>
                  {topic.items.length > 0 ? (
                    <div className="flex flex-col items-start gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {topic.items.map((item) => (
                          <ItemLink key={item.id} item={item} exam={exam.code} />
                        ))}
                      </div>
                      {topic.locked ? (
                        <a
                          href="#unlock"
                          className="text-[13px] font-bold text-ayc-blue underline underline-offset-2"
                        >
                          🔒 Unlock with {exam.code} All-Access
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-[1.5px] border-dashed border-ayc-slate p-4 text-[15px]">
              No Topics in {subject.code} yet. Its content is still being prepared, and shows up
              here automatically.
            </p>
          )}
        </section>
      ) : (
        <p className="text-[15px]">{exam.code}’s content is still being prepared.</p>
      )}

      {anyLocked ? (
        <section
          id="unlock"
          aria-labelledby="library-unlock"
          className="flex max-w-xl scroll-mt-6 flex-col gap-1.5 border-[1.5px] border-ayc-blue bg-ayc-paper p-4"
        >
          <h2
            id="library-unlock"
            className="font-mono text-xs font-bold tracking-[0.06em] text-ayc-blue"
          >
            🔒 UNLOCK WITH {exam.code} ALL-ACCESS
          </h2>
          <p className="text-[15px] leading-normal">
            {exam.code} All-Access opens every deck, quiz and Reviewer PDF for {exam.code}.{" "}
            <BetaAccessNote contactEmail={contactEmail} />
          </p>
        </section>
      ) : null}
    </>
  );
}

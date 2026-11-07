import Link from "next/link";

import { MoveButtons } from "@/components/admin/move-buttons";
import type { AdminAction } from "@/lib/admin/action";
import { faqGroupTitle, faqListHref, faqListLabel, faqMeta } from "@/lib/admin/faq-list";
import { cn } from "@/lib/utils";
import type { AdminFaqList } from "@/services/admin.types";
import type { Faq } from "@/services/catalogue.types";

import { FaqSearch } from "./faq-search";

/** Why ▲▼ wait while searching: the rows are matches from every group, not one group's order. */
const CLEAR_TO_REORDER = "Clear the search to reorder";

/**
 * The FAQS tab's GROUPS column (mockup 281–285): the 5 fixed groups with their
 * counts, each a link to its questions. Groups can't be added or renamed.
 */
export function FaqGroups({ list }: { list: AdminFaqList }) {
  const { groups, query } = list;
  return (
    <nav aria-label="FAQ groups" className="flex flex-col border-[1.5px] bg-ayc-paper">
      <h2 className="border-b-[1.5px] px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em]">
        GROUPS
      </h2>
      <ul>
        {groups.map(({ group, title, count }) => {
          const current = group === query.group && !query.q;
          return (
            <li key={group}>
              <Link
                href={faqListHref({ group, q: null })}
                scroll={false}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex justify-between gap-1.5 border-b border-ayc-ruled px-3 py-2.5 text-sm hover:bg-ayc-sand",
                  group === query.group ? "font-bold" : "font-medium",
                  current && "bg-ayc-orange/15",
                )}
              >
                <span>{title}</span>
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {count}
                  <span className="sr-only">{count === 1 ? " question" : " questions"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-3 py-2.5 text-xs leading-[1.45] text-muted-foreground">
        Groups match the sections on the FAQ page.
      </p>
    </nav>
  );
}

interface FaqListProps {
  list: AdminFaqList;
  /** The selected FAQ's id, "new", or null. */
  selected: string | null;
  move: AdminAction<string[]>;
}

/**
 * The FAQS tab's questions (mockup 287–300; BUILD-MAP §3.4): the search, the
 * group's questions in order with ▲▼ (disabled while searching), each with
 * its meta line, "+ Add question to {group}" and the note on structured data.
 */
export function FaqList({ list, selected, move }: FaqListProps) {
  const { rows, query } = list;
  const searching = query.q !== null;
  return (
    <section aria-label="Questions" className="flex min-w-0 flex-col gap-2">
      <FaqSearch query={query} selected={selected} />
      <p className="font-mono text-[11px] font-medium text-muted-foreground">
        {faqListLabel(query, rows.length)}
      </p>
      <div className="border-[1.5px] bg-ayc-paper">
        {rows.length > 0 ? (
          <ul aria-label={searching ? "Matching questions" : faqGroupTitle(query.group)}>
            {rows.map((faq, index) => (
              <FaqListRow
                key={faq.id}
                faq={faq}
                href={faqListHref(query, faq.id)}
                selected={faq.id === selected}
                searching={searching}
                first={index === 0}
                last={index === rows.length - 1}
                move={move}
              />
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No questions match.</p>
        )}
      </div>
      {searching ? <p className="text-xs text-muted-foreground">{CLEAR_TO_REORDER}.</p> : null}
      <Link
        href={faqListHref(query, "new")}
        scroll={false}
        className="flex min-h-9 items-center self-start border-[1.5px] border-dashed px-3 text-[13px] font-semibold hover:bg-ayc-sand"
      >
        + Add question to {faqGroupTitle(query.group)}
      </Link>
      <p className="flex gap-2.5 border border-dashed border-ayc-rule p-3 text-[13px] leading-[1.45] text-ayc-slate">
        <span aria-hidden="true" className="font-mono text-xs font-bold text-ayc-blue">
          i
        </span>
        <span>
          Published with FAQ structured data, so search engines and AI assistants can quote the
          answers. Keep answers short and direct.
        </span>
      </p>
    </section>
  );
}

interface FaqListRowProps {
  faq: Faq;
  href: string;
  selected: boolean;
  searching: boolean;
  first: boolean;
  last: boolean;
  move: AdminAction<string[]>;
}

/** One question (mockup 292–295): ▲▼, the question and its meta line. Hidden ones are dimmed. */
function FaqListRow({ faq, href, selected, searching, first, last, move }: FaqListRowProps) {
  const hidden = !faq.showOnFaqPage;
  const name = `“${faq.question}”`;
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 border-b border-ayc-ruled px-3 py-2.5 last:border-b-0",
        // Dimmed with colour, not the mockup's opacity, so the text keeps its contrast.
        hidden && "bg-ayc-sand/70 text-muted-foreground",
        selected && "bg-ayc-orange/15",
      )}
    >
      <MoveButtons
        id={faq.id}
        labels={{ up: `Move up: ${name}`, down: `Move down: ${name}` }}
        first={first}
        last={last}
        disabledReason={searching ? CLEAR_TO_REORDER : null}
        action={move}
        what="The FAQ order"
        gone="That question is no longer in the catalogue. The list is up to date."
        className="flex-none flex-col"
      />
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5"
      >
        <span className="text-sm leading-[1.35] font-semibold">{faq.question}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {faqMeta(faq, searching)}
        </span>
      </Link>
    </li>
  );
}

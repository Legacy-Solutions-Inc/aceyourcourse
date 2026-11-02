import Link from "next/link";

import type { AdminAction } from "@/lib/admin/action";
import { pinnedOnHomeLine, reviewListHref, reviewMeta, reviewName } from "@/lib/admin/review-list";
import { cn } from "@/lib/utils";
import type {
  AdminReview,
  AdminReviewList,
  AdminReviewRow,
  ReviewStarsFilter,
} from "@/services/admin.types";

import { ReviewMoveButtons } from "./review-move-buttons";
import { ReviewPinSwitch } from "./review-pin-switch";
import { ReviewSearch } from "./review-search";

interface ReviewListProps {
  list: AdminReviewList;
  /** The selected Review's id, "new", or null. */
  selected: string | null;
  setPin: AdminAction<AdminReview>;
  move: AdminAction<string[]>;
}

const NO_FILTERS = { q: null, exam: null, stars: null, pinned: false };

const STAR_CHIPS: { stars: ReviewStarsFilter | null; label: string }[] = [
  { stars: null, label: "ANY ★" },
  { stars: "5", label: "5★" },
  { stars: "4", label: "4★" },
  { stars: "3-or-less", label: "3★ AND BELOW" },
];

const chip =
  "flex min-h-8.5 items-center border-[1.5px] px-2.5 font-mono text-xs font-bold hover:bg-ayc-sand";
const chipOn = "bg-primary text-primary-foreground hover:bg-primary";

/** Why ▲▼ wait: the order is the whole Home order, so the rows must be all of it. */
const CLEAR_TO_REORDER = "Clear the search, Exam and stars to reorder";

/**
 * The REVIEWS tab's list (mockup 237–259; BUILD-MAP §3.4): the search, Exam
 * and star chips and "Pinned on Home only", all in the URL; the counters;
 * then every Review the seam matched, each with its HOME switch, and with
 * ▲▼ to reorder Home while "Pinned on Home only" is on.
 */
export function ReviewList({ list, selected, setPin, move }: ReviewListProps) {
  const { rows, query, examCodes, total, homeOrder, pinnedOnHome } = list;
  const pinLine = pinnedOnHomeLine(pinnedOnHome);
  const filtered = query.q !== null || query.exam !== null || query.stars !== null;
  return (
    <section aria-label="Reviews" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ReviewSearch query={query} selected={selected} />
        <div role="group" aria-label="Exam" className="flex flex-wrap gap-1.5">
          {[null, ...examCodes].map((exam) => (
            <Link
              key={exam ?? "all"}
              href={reviewListHref({ ...query, exam }, selected)}
              scroll={false}
              aria-current={query.exam === exam ? "true" : undefined}
              className={cn(chip, query.exam === exam ? chipOn : "bg-ayc-paper")}
            >
              {exam ?? "ALL"}
            </Link>
          ))}
        </div>
        <div role="group" aria-label="Stars" className="flex flex-wrap gap-1.5 wide:ml-2">
          {STAR_CHIPS.map(({ stars, label }) => (
            <Link
              key={label}
              href={reviewListHref({ ...query, stars }, selected)}
              scroll={false}
              aria-current={query.stars === stars ? "true" : undefined}
              className={cn(chip, query.stars === stars ? chipOn : "bg-ayc-paper")}
            >
              {label}
            </Link>
          ))}
        </div>
        <Link
          href={reviewListHref({ ...query, pinned: !query.pinned }, selected)}
          scroll={false}
          aria-current={query.pinned ? "true" : undefined}
          className={cn(
            "ml-auto flex min-h-8.5 items-center border-[1.5px] px-2.5 text-[13px] font-semibold",
            query.pinned
              ? "border-ayc-warning bg-ayc-orange/15"
              : "border-ayc-rule hover:bg-ayc-sand",
          )}
        >
          Pinned on Home only
        </Link>
      </div>

      <div className="flex justify-between gap-2.5 font-mono text-[11px] font-medium text-muted-foreground">
        <span>{rows.length === 1 ? "1 REVIEW" : `${rows.length} REVIEWS`}</span>
        <span className={cn(pinLine.over && "text-destructive")}>{pinLine.text}</span>
      </div>

      <div className="border-[1.5px] bg-ayc-paper">
        {rows.length > 0 ? (
          <ul aria-label={`Reviews · ${rows.length}`}>
            {rows.map((row) => (
              <ReviewListRow
                key={row.review.id}
                row={row}
                href={reviewListHref(query, row.review.id)}
                selected={row.review.id === selected}
                reorder={
                  query.pinned
                    ? {
                        first: homeOrder[0] === row.review.id,
                        last: homeOrder.at(-1) === row.review.id,
                        disabledReason: filtered ? CLEAR_TO_REORDER : null,
                      }
                    : null
                }
                setPin={setPin}
                move={move}
              />
            ))}
          </ul>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3.5 py-7 text-center">
            <p
              className="font-mono text-4xl leading-none tracking-[4px] text-ayc-rule"
              aria-hidden="true"
            >
              ☆☆☆
            </p>
            <p className="text-lg font-extrabold">No reviews added yet</p>
            <p className="max-w-[40ch] text-sm text-muted-foreground">
              The Home page hides the reviews section until you add one. Copy reviews word for word
              from Shopee, Lazada, or TikTok Shop.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-3.5 py-7 text-center text-sm text-muted-foreground">
            <p>No reviews match. Clear the search or filters.</p>
            <Link
              href={reviewListHref(NO_FILTERS, selected)}
              scroll={false}
              className="font-semibold text-ayc-blue underline underline-offset-4"
            >
              Clear filters
            </Link>
          </div>
        )}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        EVERY REVIEW SHOWS ON ITS PRODUCT PAGE AND EXAM PAGE · PINNED ONES ALSO SHOW ON HOME
      </p>
      {query.pinned && filtered ? (
        <p className="text-xs text-muted-foreground">{CLEAR_TO_REORDER}.</p>
      ) : null}
    </section>
  );
}

interface ReviewListRowProps {
  row: AdminReviewRow;
  href: string;
  selected: boolean;
  /** ▲▼'s state while "Pinned on Home only" is on; null otherwise. */
  reorder: { first: boolean; last: boolean; disabledReason: string | null } | null;
  setPin: AdminAction<AdminReview>;
  move: AdminAction<string[]>;
}

/** One Review (mockup 243–249): its stars, a 2-line excerpt and the meta line, then HOME. */
function ReviewListRow({ row, href, selected, reorder, setPin, move }: ReviewListRowProps) {
  const { review } = row;
  const name = reviewName(review.text);
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-ayc-ruled px-3.5 py-2.75 last:border-b-0 wide:grid-cols-[76px_minmax(0,1fr)_auto]",
        selected && "bg-ayc-orange/15",
      )}
    >
      <span
        role="img"
        aria-label={`${review.stars} out of 5 stars`}
        className="col-span-2 text-[13px] tracking-[1px] text-ayc-star wide:col-span-1"
      >
        {"★".repeat(review.stars)}
        {"☆".repeat(5 - review.stars)}
      </span>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-col gap-0.75"
      >
        <span className="line-clamp-2 text-sm leading-[1.4]">
          {review.text.replace(/\n/g, " ")}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {reviewMeta(row)}
        </span>
      </Link>
      <span className="flex items-center justify-end gap-1.5">
        {reorder ? (
          <ReviewMoveButtons
            reviewId={review.id}
            name={name}
            first={reorder.first}
            last={reorder.last}
            disabledReason={reorder.disabledReason}
            action={move}
          />
        ) : null}
        <span
          className="font-mono text-[10px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          HOME
        </span>
        <ReviewPinSwitch
          reviewId={review.id}
          pinned={review.homePin !== null}
          action={setPin}
          aria-label={`Pin on Home: ${name}`}
        />
      </span>
    </li>
  );
}

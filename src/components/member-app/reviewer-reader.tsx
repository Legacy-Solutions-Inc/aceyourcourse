"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { StudyActionState } from "@/app/app/(shell)/library/actions";
import type { ShownRefusal } from "@/lib/member-app/access";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import {
  openingPlace,
  type ReaderPlace,
  READER_ZOOMS,
  zoomIn,
  zoomOut,
} from "@/lib/reviewer-pdfs/reader";
import { paths } from "@/paths";
import type { ReaderPositionInput } from "@/services/member.types";

import { ContentState } from "./content-state";
import { keptNote } from "./study-states";

/** The Server Action the reader calls (src/app/app/(shell)/library/actions.ts). */
export interface ReviewerReaderActions {
  savePosition: (input: ReaderPositionInput) => Promise<StudyActionState>;
}

export interface ReviewerReaderProps {
  reviewerPdfId: string;
  /** The Topic's name. */
  title: string;
  /** The label over the page, such as "MSTC Reviewer · Simple Curves". */
  label: string;
  /** At least 1: a Reviewer PDF with no pages shows that it's being prepared instead. */
  pageCount: number;
  /** The page and zoom the Member left it at, or null. */
  resumeAt: ReaderPlace | null;
  examCode: string;
  /** How the Member gets the Exam's All-Access, should access stop mid-way: its Plans, or asking AYC. */
  unlock: UnlockRoute;
  back: { href: string; label: string };
  actions: ReviewerReaderActions;
}

/** Whether a key press is the Member's to the reader: no modifier held, and not held down. */
const isPlainKey = (event: KeyboardEvent) =>
  !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;

const CONTROL =
  "min-h-12 min-w-12 cursor-pointer border-[1.5px] px-3.5 text-[15px] font-bold disabled:cursor-default disabled:opacity-40";

/** Where fetching one page has got to. */
type PageLoad =
  | { status: "loading" }
  /** The stamped page, as an object URL the browser holds while it's shown. */
  | { status: "shown"; src: string }
  /** The request never got an answer: the connection dropped. */
  | { status: "dropped" }
  /** The server answered with something other than the page: a refusal, or no such page. */
  | { status: "unavailable" };

/**
 * Fetches one stamped page from the page endpoint, shown through an object
 * URL that's let go when the page changes. The browser's own HTTP cache
 * applies (the endpoint lets it keep a page briefly), and nothing else is
 * kept. A request that fails is a dropped connection; any answer but the
 * page (a refusal, a redirect to another screen, no such page) is the
 * server's own, which tells the two apart for the Member (story 102).
 */
function usePageImage(url: string): PageLoad {
  const [answer, setAnswer] = useState<{ url: string; load: PageLoad } | null>(null);
  useEffect(() => {
    let current = true;
    let objectUrl: string | null = null;
    const settle = (load: PageLoad) => {
      if (current) setAnswer({ url, load });
    };
    fetch(url, { redirect: "manual" })
      .then(async (response) => {
        const isPage = response.ok && response.headers.get("content-type") === "image/webp";
        if (!isPage) return settle({ status: "unavailable" });
        const image = await response.blob();
        if (!current) return;
        objectUrl = URL.createObjectURL(image);
        settle({ status: "shown", src: objectUrl });
      })
      .catch(() => settle({ status: "dropped" }));
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  // Until this page's answer comes, it's loading: an answer for another page doesn't count.
  return answer?.url === url ? answer.load : { status: "loading" };
}

/**
 * The Reviewer PDF reader (stories 101, 102 and 105; mockups `reviewer` and
 * `loadError`): one page at a time, as the protected page endpoint stamps it
 * for this Member, with Previous and Next (and ← →), and zoom from 75% to
 * 150% in 25% steps, done here in the browser on the one image. Nothing is
 * kept for offline: each page is fetched from the server, which only lets the
 * Member's own browser hold it briefly. A page whose request drops says the
 * connection dropped, with Try again, which fetches it again; one the server
 * won't give reads the page again, so a pass that ended meanwhile shows
 * renew in its place. Each page turn and zoom is saved, and the Reviewer PDF
 * reopens there.
 */
export function ReviewerReader({
  reviewerPdfId,
  title,
  label,
  pageCount,
  resumeAt,
  examCode,
  unlock,
  back,
  actions,
}: ReviewerReaderProps) {
  const router = useRouter();
  const [place, setPlace] = useState(() => openingPlace(resumeAt, pageCount));
  const placeRef = useRef(place);
  // How often the Member has asked for this page again: each retry is a new request.
  const [retry, setRetry] = useState(0);
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);
  const { page, zoom } = place;
  const load = usePageImage(paths.memberApp.reviewerPage(reviewerPdfId, page, retry));
  const failed = load.status === "dropped" || load.status === "unavailable";

  // The server wouldn't give the page: it decides again, and its screen takes over should it refuse.
  useEffect(() => {
    if (load.status === "unavailable") router.refresh();
  }, [load.status, router]);

  /** Saves where the Member is, and shows why, should the server refuse. */
  const save = useCallback(
    async (next: ReaderPlace) => {
      try {
        const state = await actions.savePosition({ reviewerPdfId, ...next });
        if (state.status === "refused") setRefusal(state.decision);
      } catch (error) {
        // A redirect (a replaced device, a closed gate) isn't a failure: Next follows it.
        unstable_rethrow(error);
        // A save that doesn't reach the server costs only where the reader reopens.
      }
    },
    [actions, reviewerPdfId],
  );

  const moveTo = useCallback(
    (next: ReaderPlace) => {
      const now = placeRef.current;
      if (next.page === now.page && next.zoom === now.zoom) return;
      if (next.page !== now.page) setRetry(0);
      placeRef.current = next;
      setPlace(next);
      void save(next);
    },
    [save],
  );

  const turn = useCallback(
    (step: -1 | 1) => {
      const now = placeRef.current;
      moveTo({ ...now, page: Math.min(Math.max(now.page + step, 1), pageCount) });
    },
    [moveTo, pageCount],
  );

  // ← and → turn the page, from anywhere but a field or the page view, and never with a modifier held.
  const reading = refusal === null;
  useEffect(() => {
    if (!reading) return;
    function onKey(event: KeyboardEvent) {
      const { target } = event;
      // A field keeps its arrows, and so does the page view, which they scroll when zoomed.
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [data-page-view]")
      ) {
        return;
      }
      if (!isPlainKey(event)) return;
      if (event.key === "ArrowRight" && !failed) {
        event.preventDefault();
        turn(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        turn(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading, failed, turn]);

  const tryAgain = () => setRetry((tried) => tried + 1);

  return (
    <section
      aria-label={`${title} reviewer`}
      className="flex flex-col gap-4 select-none [-webkit-touch-callout:none] wide:gap-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-blue">{label}</p>
          <h1 className="text-[clamp(22px,2.6vw,30px)] leading-[1.1] font-extrabold tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {reading ? (
          <div role="group" aria-label="Zoom" className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => moveTo({ ...placeRef.current, zoom: zoomOut(placeRef.current.zoom) })}
              disabled={zoom === READER_ZOOMS[0]}
              className={CONTROL}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output aria-live="polite" className="min-w-14 text-center font-mono text-sm font-bold">
              {zoom}%
            </output>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => moveTo({ ...placeRef.current, zoom: zoomIn(placeRef.current.zoom) })}
              disabled={zoom === READER_ZOOMS.at(-1)}
              className={CONTROL}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        ) : null}
      </div>

      {refusal ? (
        <ContentState
          decision={refusal}
          // The count of the pages viewed shows when the Reviewer PDF is opened again.
          keptNote={keptNote(refusal, null)}
          examCode={examCode}
          unlock={unlock}
          back={back}
        />
      ) : (
        <>
          {/* Scrolls when zoomed past its width: focusable, so the keyboard scrolls it too. */}
          <div
            data-page-view=""
            role="region"
            aria-label="Page view"
            tabIndex={0}
            className="overflow-auto border-[1.5px] bg-ayc-sand/40 p-2 wide:p-4"
          >
            {load.status === "dropped" ? (
              <PageProblem
                page={page}
                tag="DIDN’T LOAD"
                heading="Looks like your connection dropped"
                text="Pages load one at a time and aren’t saved on your device, so you need a connection to keep going."
                onRetry={tryAgain}
              />
            ) : load.status === "unavailable" ? (
              <PageProblem
                page={page}
                tag="ISN’T AVAILABLE"
                heading="This page couldn’t be shown"
                text="Try again in a moment. If it still won’t show, go back to the topic."
                onRetry={tryAgain}
              />
            ) : (
              <div
                data-testid="page-frame"
                style={{ width: `${zoom}%` }}
                className="relative mx-auto aspect-[8.5/11] max-w-none bg-white shadow-hard"
              >
                {load.status === "shown" ? (
                  // The page is this Member's stamped copy, as an object URL: next/image can't take one.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={load.src}
                    alt={`Page ${page} of ${pageCount}`}
                    draggable={false}
                    onContextMenu={(event) => event.preventDefault()}
                    className="pointer-events-none block h-auto w-full"
                  />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground">
                    LOADING PAGE {page}…
                  </p>
                )}
              </div>
            )}
          </div>
          <nav aria-label="Pages" className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => turn(-1)}
              disabled={page === 1}
              className={CONTROL}
            >
              ← Prev
            </button>
            <span
              aria-live="polite"
              className="min-w-28 text-center font-mono text-[13px] font-bold"
            >
              PAGE {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => turn(1)}
              disabled={page === pageCount || failed}
              className={CONTROL}
            >
              Next →
            </button>
          </nav>
          <p className="text-center font-mono text-xs text-muted-foreground">
            Keyboard: ← previous page · → next page. Pages you view count toward your progress.
          </p>
        </>
      )}
    </section>
  );
}

interface PageProblemProps {
  page: number;
  /** After "PAGE n": what happened, such as "DIDN’T LOAD". */
  tag: string;
  heading: string;
  text: string;
  onRetry: () => void;
}

/**
 * A page that didn't come (mockup `loadError`): the connection dropped, or the
 * server wouldn't give it. Try again asks for it again.
 */
function PageProblem({ page, tag, heading, text, onRetry }: PageProblemProps) {
  return (
    <section
      role="alert"
      aria-labelledby="page-problem"
      className="mx-auto flex max-w-120 flex-col items-start gap-2.5 bg-ayc-paper p-5 wide:my-8 wide:p-7"
    >
      <p className="font-mono text-xs font-bold tracking-[0.06em] text-destructive">
        PAGE {page} {tag}
      </p>
      <h2 id="page-problem" className="text-[clamp(20px,2.4vw,26px)] leading-[1.15] font-extrabold">
        {heading}
      </h2>
      <p className="text-[15px] leading-normal">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 min-h-12 cursor-pointer border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { LessonActionState } from "@/app/app/(shell)/courses/actions";
import { LessonPlayer } from "@/components/video/lesson-player";
import { createSaveSchedule, type PlayerEvent } from "@/lib/courses/lesson-saving";
import { cn } from "@/lib/utils";
import type { PlaybackPass } from "@/services/video.types";

// ─────────────────────────────────────────────────────────────────────────────
// Watching a Lesson (Phase 5, ticket 04; spec, Phase 5 planning decisions →
// Watching a Lesson; mockup `player`): the player picks up where the Member
// left off and saves where they are every 10 seconds while playing, and on
// pause, at the end and on leaving (moving to another screen, hiding the tab
// or closing it). A save from a device another one replaced redirects to
// "Session ended", as every Member App action does, which takes the page and
// the video away; a save the access decision refuses otherwise (the Course
// locked or hidden meanwhile) reloads the screen, which then shows why.
// "Mark complete" marks the Lesson done and goes on to the next Lesson, or
// back to Courses after the last.
// ─────────────────────────────────────────────────────────────────────────────

/** What a save hears back (the Lesson screen's actions). */
export type WatchSaveState = LessonActionState;

export interface LessonWatchActions {
  save(input: { courseId: string; lessonId: string; position: number }): Promise<WatchSaveState>;
  complete(input: { courseId: string; lessonId: string }): Promise<WatchSaveState>;
}

interface LessonWatchProps {
  courseId: string;
  lessonId: string;
  title: string;
  /** The playback pass, or null when there's no video to play (shown by `fallback`). */
  pass: PlaybackPass | null;
  /** What stands in for the player without a pass: "This video isn't available yet". */
  fallback?: React.ReactNode;
  seconds: number;
  watermark: string;
  /** Where the video starts: the saved position, or 0. */
  startAt: number;
  /** Under the video: "You stopped here 2 days ago. The video picks up at 12:40." */
  note: string;
  /** The "Mark complete" button's words and where it goes after. */
  complete: { label: string; href: string };
  /** The Member has done this Lesson already. */
  done: boolean;
  actions: LessonWatchActions;
}

export function LessonWatch({
  courseId,
  lessonId,
  title,
  pass,
  fallback,
  seconds,
  watermark,
  startAt,
  note,
  complete,
  done,
  actions,
}: LessonWatchProps) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [completing, startCompleting] = useTransition();
  const [schedule] = useState(createSaveSchedule);
  const stopped = useRef(false);
  const doneShown = useRef(done);
  // The actions as the page gives them now: a refresh hands over new ones.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  }, [actions]);

  const heard = useCallback(
    // Undefined when the action redirected ("Session ended", sign-in): the page is going.
    (state: WatchSaveState | undefined) => {
      if (state?.status === "refused") {
        stopped.current = true;
        router.refresh();
      } else if (state?.status === "saved" && state.done && !doneShown.current) {
        // Just reached 90%: the side panel's ✓ and count come from the server.
        doneShown.current = true;
        router.refresh();
      }
    },
    [router],
  );

  const send = useCallback(
    (position: number | null) => {
      if (position === null || stopped.current) return;
      latest.current
        // Whole seconds, as the clock shows them (the server keeps whole seconds).
        .save({ courseId, lessonId, position: Math.round(position) })
        .then(heard)
        // A save lost to the network is made up by the next one.
        .catch(() => {});
    },
    [courseId, lessonId, heard],
  );

  const onEvent = useCallback(
    (event: PlayerEvent) => send(schedule.next(event, Date.now())),
    [send, schedule],
  );

  // On leaving: another screen (unmount), or the tab hidden or closed.
  useEffect(() => {
    const leave = () => send(schedule.leave());
    const hidden = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      leave();
    };
  }, [send, schedule]);

  function markComplete() {
    setProblem(null);
    startCompleting(async () => {
      try {
        const state: WatchSaveState | undefined = await latest.current.complete({
          courseId,
          lessonId,
        });
        if (state?.status === "saved") {
          doneShown.current = true;
          router.push(complete.href);
        } else if (state?.status === "not-saved") {
          setProblem("That didn’t save. Try again.");
        } else {
          heard(state);
        }
      } catch {
        setProblem("That didn’t save. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {pass ? (
        <>
          <LessonPlayer
            pass={pass}
            seconds={seconds}
            watermark={watermark}
            title={title}
            startAt={startAt}
            onEvent={onEvent}
          />
          <p className="font-mono text-xs font-medium text-muted-foreground">{note}</p>
        </>
      ) : (
        fallback
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={markComplete}
          disabled={completing}
          className={cn(
            "flex min-h-11 cursor-pointer items-center border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground",
            completing && "cursor-wait opacity-70",
          )}
        >
          {complete.label}
        </button>
        {problem ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// When the Lesson player saves where the Member is (Phase 5, ticket 04; spec,
// Phase 5 planning decisions → Watching a Lesson): every 10 seconds while
// playing, and on pause, at the end and on leaving the page. Pure and
// player-agnostic: the player adapter (src/components/video/lesson-player.tsx)
// turns VdoCipher's player and the sample player alike into these events,
// and the schedule says which position, if any, to send to the server.

/** How often a save goes out while the video plays. */
export const SAVE_EVERY_MS = 10_000;

/** What the player adapter reports: the position in seconds, as it plays, pauses or ends. */
export type PlayerEvent = { type: "time" | "pause" | "end"; position: number };

export interface SaveSchedule {
  /** The position to save after this event at `now` (ms), or null for none yet. */
  next(event: PlayerEvent, now: number): number | null;
  /** The position to save on leaving the page, or null when it's saved already. */
  leave(): number | null;
}

/** A fresh schedule for one Lesson screen. */
export function createSaveSchedule(): SaveSchedule {
  /** When the current stretch of playing (or the last save in it) began. */
  let since: number | null = null;
  let position: number | null = null;
  let saved: number | null = null;

  const unsaved = () => (position !== null && position !== saved ? position : null);
  const saving = (at: number) => {
    saved = at;
    return at;
  };

  return {
    next(event, now) {
      position = event.position;
      if (event.type === "time") {
        if (since === null) {
          since = now;
          return null;
        }
        if (now - since < SAVE_EVERY_MS) return null;
        since = now;
        return saving(event.position);
      }
      since = null;
      const left = unsaved();
      return left === null ? null : saving(left);
    },
    leave() {
      const left = unsaved();
      return left === null ? null : saving(left);
    },
  };
}

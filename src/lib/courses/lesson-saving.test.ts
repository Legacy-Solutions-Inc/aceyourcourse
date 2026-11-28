import { describe, expect, it } from "vitest";

import { SAVE_EVERY_MS, createSaveSchedule } from "./lesson-saving";

// When the Lesson player saves where the Member is (Phase 5, ticket 04; spec,
// Phase 5 planning decisions → Watching a Lesson): every 10 seconds while
// playing, and on pause, at the end and on leaving. Pure: the player
// adapter's events in, the position to save (or none) out.

describe("createSaveSchedule", () => {
  it("saves every 10 seconds while playing, not on every tick", () => {
    const schedule = createSaveSchedule();
    expect(schedule.next({ type: "time", position: 0 }, 0)).toBeNull();
    expect(schedule.next({ type: "time", position: 5 }, 5_000)).toBeNull();
    expect(schedule.next({ type: "time", position: 9.75 }, SAVE_EVERY_MS - 1)).toBeNull();
    expect(schedule.next({ type: "time", position: 10 }, SAVE_EVERY_MS)).toBe(10);
    expect(schedule.next({ type: "time", position: 15 }, 15_000)).toBeNull();
    expect(schedule.next({ type: "time", position: 20 }, 2 * SAVE_EVERY_MS)).toBe(20);
  });

  it("saves on pause, and starts the 10 seconds over when playing again", () => {
    const schedule = createSaveSchedule();
    schedule.next({ type: "time", position: 0 }, 0);
    expect(schedule.next({ type: "pause", position: 4.4 }, 4_400)).toBe(4.4);
    expect(schedule.next({ type: "time", position: 4.6 }, 60_000)).toBeNull();
    expect(schedule.next({ type: "time", position: 14 }, 69_000)).toBeNull();
    expect(schedule.next({ type: "time", position: 15 }, 70_000)).toBe(15);
  });

  it("saves at the end", () => {
    const schedule = createSaveSchedule();
    expect(schedule.next({ type: "end", position: 743 }, 0)).toBe(743);
  });

  it("saves on leaving only what isn't saved yet", () => {
    const schedule = createSaveSchedule();
    expect(schedule.leave()).toBeNull();
    schedule.next({ type: "time", position: 0 }, 0);
    schedule.next({ type: "time", position: 3 }, 3_000);
    expect(schedule.leave()).toBe(3);
    expect(schedule.leave()).toBeNull();
    expect(schedule.next({ type: "pause", position: 3 }, 3_100)).toBeNull();
  });

  it("doesn't save a pause where it was just saved", () => {
    const schedule = createSaveSchedule();
    schedule.next({ type: "time", position: 0 }, 0);
    schedule.next({ type: "time", position: 10 }, SAVE_EVERY_MS);
    expect(schedule.next({ type: "pause", position: 10 }, SAVE_EVERY_MS + 1)).toBeNull();
  });
});

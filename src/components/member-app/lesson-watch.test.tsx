import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LessonWatch, type LessonWatchActions, type WatchSaveState } from "./lesson-watch";

// Watching a Lesson on its screen (Phase 5, ticket 04; spec, Phase 5 planning
// decisions → Watching a Lesson), with the sample player: where the video
// starts, the saves every 10 seconds while playing and on pause, at the end
// and on leaving, and "Mark complete". A replaced device's save redirects to
// "Session ended" in the action (courses.test.tsx and the gate test).

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  router.push.mockReset();
  router.refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const SAVED: WatchSaveState = { status: "saved", done: false };

function actionsAnswering(state: WatchSaveState = SAVED) {
  return {
    save: vi.fn<LessonWatchActions["save"]>(async () => state),
    complete: vi.fn<LessonWatchActions["complete"]>(async () => ({ status: "saved", done: true })),
  };
}

function renderWatch(actions: LessonWatchActions, startAt = 0, seconds = 1006) {
  return render(
    <LessonWatch
      courseId="course-1"
      lessonId="lesson-2"
      title="Traverse computations"
      pass={{ kind: "sample", token: "sample:video" }}
      seconds={seconds}
      watermark="tester@example.com · 7Q2K9F"
      startAt={startAt}
      note="You stopped here 2 days ago. The video picks up at 12:40."
      complete={{
        label: "Mark complete · next lesson →",
        href: "/app/courses/course-1/lessons/lesson-3",
      }}
      done={false}
      actions={actions}
    />,
  );
}

const play = () => user().click(screen.getByRole("button", { name: "Play" }));
const pause = () => user().click(screen.getByRole("button", { name: "Pause" }));
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const positions = (save: ReturnType<typeof actionsAnswering>["save"]) =>
  save.mock.calls.map(([input]) => Math.round(input.position));

describe("LessonWatch", () => {
  it("starts the video at the saved position, with the note saying so", () => {
    renderWatch(actionsAnswering(), 760);
    expect(screen.getByTestId("sample-clock")).toHaveTextContent("12:40 / 16:46");
    expect(
      screen.getByText("You stopped here 2 days ago. The video picks up at 12:40."),
    ).toBeInTheDocument();
  });

  it("saves every 10 seconds while playing, and on pause", async () => {
    const actions = actionsAnswering();
    renderWatch(actions, 760);
    await play();
    await wait(9_000);
    expect(actions.save).not.toHaveBeenCalled();
    await wait(2_000);
    expect(actions.save).toHaveBeenCalledTimes(1);
    expect(actions.save.mock.calls[0]?.[0]).toMatchObject({
      courseId: "course-1",
      lessonId: "lesson-2",
    });
    expect(positions(actions.save)[0]).toBeGreaterThanOrEqual(769);
    await wait(10_000);
    expect(actions.save).toHaveBeenCalledTimes(2);

    await wait(1_000);
    await pause();
    expect(actions.save).toHaveBeenCalledTimes(3);
    // Paused: no more saves.
    await wait(30_000);
    expect(actions.save).toHaveBeenCalledTimes(3);
  });

  it("saves at the end", async () => {
    const actions = actionsAnswering();
    renderWatch(actions, 1000);
    await play();
    await wait(7_000);
    expect(positions(actions.save)).toEqual([1006]);
  });

  it("saves on leaving what isn't saved yet", async () => {
    const actions = actionsAnswering();
    const { unmount } = renderWatch(actions);
    await play();
    await wait(3_000);
    expect(actions.save).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    expect(actions.save).toHaveBeenCalledTimes(1);
    // Hidden again with nothing new to save: nothing goes out.
    await pause();
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    const [first, ...rest] = positions(actions.save);
    expect(first).toBeGreaterThanOrEqual(3);
    // The pause saved only if the clock moved on after the pagehide save; leaving added nothing.
    expect(rest.every((position) => position > (first ?? 0))).toBe(true);
    expect(rest.length).toBeLessThanOrEqual(1);
  });

  it("refreshes the screen once, when a save first marks the Lesson done", async () => {
    const actions = actionsAnswering({ status: "saved", done: true });
    renderWatch(actions);
    await play();
    await wait(11_000);
    expect(actions.save).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await wait(11_000);
    expect(actions.save).toHaveBeenCalledTimes(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("saves once more on moving to another screen", async () => {
    const actions = actionsAnswering();
    const { unmount } = renderWatch(actions);
    await play();
    await wait(4_000);
    unmount();
    expect(actions.save).toHaveBeenCalledTimes(1);
  });

  it("sends nothing more once the Lesson was refused meanwhile", async () => {
    const actions = actionsAnswering({ status: "refused" });
    renderWatch(actions);
    await play();
    await wait(11_000);
    await wait(30_000);
    expect(actions.save).toHaveBeenCalledTimes(1);
  });

  it("reloads the screen when the Lesson was refused meanwhile, so it says why", async () => {
    const actions = actionsAnswering({ status: "refused" });
    renderWatch(actions);
    await play();
    await wait(11_000);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("marks the Lesson complete and goes on to the next one", async () => {
    const actions = actionsAnswering();
    renderWatch(actions);
    await user().click(screen.getByRole("button", { name: "Mark complete · next lesson →" }));
    expect(actions.complete).toHaveBeenCalledWith({ courseId: "course-1", lessonId: "lesson-2" });
    expect(router.push).toHaveBeenCalledWith("/app/courses/course-1/lessons/lesson-3");
  });

  it("says Mark complete didn't save, and stays", async () => {
    const actions = actionsAnswering();
    actions.complete.mockResolvedValueOnce({ status: "not-saved" });
    renderWatch(actions);
    await user().click(screen.getByRole("button", { name: "Mark complete · next lesson →" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn’t save. Try again.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows what stands in for the player without a pass, with Mark complete still there", () => {
    render(
      <LessonWatch
        courseId="course-1"
        lessonId="lesson-2"
        title="Traverse computations"
        pass={null}
        fallback={<p>This video isn’t available yet</p>}
        seconds={1006}
        watermark=""
        startAt={0}
        note="Starts from the beginning."
        complete={{ label: "Mark complete · finish course", href: "/app/courses" }}
        done
        actions={actionsAnswering()}
      />,
    );
    expect(screen.getByText("This video isn’t available yet")).toBeInTheDocument();
    expect(screen.queryByText("Starts from the beginning.")).toBeNull();
    expect(screen.getByRole("button", { name: "Mark complete · finish course" })).toBeVisible();
  });
});

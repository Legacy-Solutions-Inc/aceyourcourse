import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SamplePlayer } from "./sample-player";

// The sample video player (Phase 5, ticket 02): a dark 16:9 frame labelled
// "SAMPLE VIDEO" with the moving watermark, play and pause, a progress bar
// and a running clock, and no video file.

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe("SamplePlayer", () => {
  it("shows SAMPLE VIDEO, the clock at the start, and Play", () => {
    render(<SamplePlayer seconds={754} watermark="editor@example.com" title="Beams" />);
    expect(screen.getByRole("figure", { name: "Sample video: Beams" })).toBeInTheDocument();
    expect(screen.getByText("SAMPLE VIDEO")).toBeInTheDocument();
    expect(screen.getByTestId("sample-clock")).toHaveTextContent("0:00 / 12:34");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Played" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("runs the clock and the progress bar while playing, and stops on pause", async () => {
    const onTime = vi.fn();
    render(<SamplePlayer seconds={754} watermark="editor@example.com" onTime={onTime} />);
    await user().click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("sample-clock")).toHaveTextContent(/^0:0[34] \/ 12:34$/);
    expect(onTime).toHaveBeenLastCalledWith(expect.any(Number), true);
    await user().click(screen.getByRole("button", { name: "Pause" }));
    const paused = screen.getByTestId("sample-clock").textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("sample-clock").textContent).toBe(paused);
    expect(onTime).toHaveBeenLastCalledWith(expect.any(Number), false);
  });

  it("starts where it's told, and stops at the end", async () => {
    render(<SamplePlayer seconds={10} watermark="editor@example.com" startAt={9} />);
    expect(screen.getByTestId("sample-clock")).toHaveTextContent("0:09 / 0:10");
    await user().click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByTestId("sample-clock")).toHaveTextContent("0:10 / 0:10");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("draws the watermark as a picture, never as text, and drifts it to another spot", async () => {
    render(<SamplePlayer seconds={754} watermark="editor@example.com" />);
    expect(screen.queryByText("editor@example.com")).not.toBeInTheDocument();
    const mark = screen.getByTestId("sample-watermark");
    expect(mark.style.backgroundImage).toContain(encodeURIComponent("editor@example.com"));
    const first = mark.style.left;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByTestId("sample-watermark").style.left).not.toBe(first);
  });
});

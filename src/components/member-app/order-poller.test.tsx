import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderPoller } from "./order-poller";

// Confirming payment's refresh (Phase 4, tickets 03 and 04; spec, Phase 4
// planning decisions → Recording an outcome): it reads the Order again every
// 3 seconds, and after about 15 seconds on the screen it also has the server
// ask PayMongo for the status on each read (the server keeps that to once
// every 10 seconds per Order).

// Next's router is one object for the life of the page, as here.
const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** Moves the clock on by `ms`, letting each tick's check settle. */
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OrderPoller", () => {
  it("reads the Order again every 3 seconds", async () => {
    render(<OrderPoller check={null} />);

    await wait(2_999);
    expect(refresh).not.toHaveBeenCalled();
    await wait(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await wait(6_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("asks for the status only after about 15 seconds on the screen, then on each read", async () => {
    const check = vi.fn(async () => {});
    render(<OrderPoller check={check} />);

    await wait(14_999);
    expect(check).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(4);

    await wait(1);
    expect(check).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(5);

    await wait(3_000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("counts the 15 seconds from when the screen opened, though each read hands it a new check", async () => {
    const checks: Array<() => Promise<void>> = [];
    const fresh = () => {
      const check = vi.fn(async () => {});
      checks.push(check);
      return check;
    };
    const { rerender } = render(<OrderPoller check={fresh()} />);
    // Each read renders the page again, binding the Order's check anew.
    refresh.mockImplementation(() => rerender(<OrderPoller check={fresh()} />));

    // The reads come 3 seconds apart, each its own render.
    for (let tick = 0; tick < 5; tick += 1) await wait(3_000);

    expect(checks.at(-2)).toHaveBeenCalledTimes(1);
    expect(checks.slice(0, -2).every((check) => vi.mocked(check).mock.calls.length === 0)).toBe(
      true,
    );
  });

  it("keeps reading the Order when a status check fails", async () => {
    const check = vi.fn(async () => {
      throw new Error("offline");
    });
    render(<OrderPoller check={check} />);

    await wait(18_000);

    expect(check).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(6);
  });

  it("stops when the screen closes", async () => {
    const { unmount } = render(<OrderPoller check={null} />);
    unmount();

    await wait(9_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});

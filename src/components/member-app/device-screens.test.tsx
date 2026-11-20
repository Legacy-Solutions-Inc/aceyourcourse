import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { claimedAtLabel, SessionEnded, UseThisDevice } from "./device-screens";

// The Active Device screens (stories 107, 108, 133f; mockup `session`): what
// each says and what its form sends. The pages that choose between them are
// tested in src/app/app/device.test.tsx.

// 17 Nov 2026, 9:50 PM in Manila (UTC+8).
const NOW = new Date("2026-11-17T13:50:00.000Z");
const TONIGHT = { deviceLabel: "Chrome on Android", claimedAt: "2026-11-17T13:42:00.000Z" };
const action = vi.fn(async () => {});

describe("claimedAtLabel", () => {
  it("says Today and the Manila time for a claim on the same Manila day", () => {
    expect(claimedAtLabel("2026-11-17T13:42:00.000Z", NOW)).toBe("Today, 9:42 PM");
  });

  it("gives the date for an earlier day, by the Manila calendar", () => {
    // 15:59 UTC on 16 Nov is 11:59 PM in Manila, still the 16th.
    expect(claimedAtLabel("2026-11-16T15:59:00.000Z", NOW)).toBe("16 Nov 2026, 11:59 PM");
  });

  it("counts a claim after Manila midnight as today, though it's still yesterday in UTC", () => {
    expect(claimedAtLabel("2026-11-16T16:05:00.000Z", NOW)).toBe("Today, 12:05 AM");
  });
});

describe("SessionEnded", () => {
  function renderIt(overrides: Partial<React.ComponentProps<typeof SessionEnded>> = {}) {
    return render(
      <SessionEnded
        email="tester@example.com"
        newDevice={TONIGHT}
        now={NOW}
        next="/app/account"
        contactEmail="hello@example.com"
        problem={null}
        action={action}
        {...overrides}
      />,
    );
  }

  it("says the Member signed in on another device, naming it, as the mockup does", () => {
    renderIt();

    expect(screen.getByText("SESSION ENDED")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeInTheDocument();
    expect(screen.getByText("tester@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Only one device can be active at a time\./)).toBeInTheDocument();
    expect(screen.getByText("NEW DEVICE · Chrome on Android · Today, 9:42 PM")).toBeInTheDocument();
  });

  it("sends next with “Sign in on this device”", () => {
    renderIt();
    const button = screen.getByRole("button", { name: "Sign in on this device" });
    const form = button.closest("form");
    expect(form).not.toBeNull();
    expect(within(form as HTMLFormElement).getByDisplayValue("/app/account")).toHaveAttribute(
      "name",
      "next",
    );
  });

  it("offers support by email for someone who didn't sign in elsewhere", () => {
    renderIt();
    expect(screen.getByRole("link", { name: "Wasn’t you? Email support" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
  });

  it("leaves the new device out when there is none to name", () => {
    renderIt({ newDevice: null });
    expect(screen.queryByText(/NEW DEVICE/)).not.toBeInTheDocument();
  });

  it("says why the last sign-in didn't go on, and nothing otherwise", () => {
    const { unmount } = renderIt();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();

    renderIt({ problem: "Sign-in isn't answering right now. Try again in a minute." });
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in isn't answering right now.");
  });
});

describe("UseThisDevice", () => {
  const signOutAction = vi.fn(async () => {});

  function renderIt(overrides: Partial<React.ComponentProps<typeof UseThisDevice>> = {}) {
    return render(
      <UseThisDevice
        email="angel@example.com"
        activeDevice={TONIGHT}
        now={NOW}
        next="/app/library"
        action={action}
        signOutAction={signOutAction}
        {...overrides}
      />,
    );
  }

  it("asks to use the Member App here, naming the device that would be replaced", () => {
    renderIt();

    expect(
      screen.getByRole("heading", { level: 1, name: "Use the Member App on this device?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("angel@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Using it here signs that device out/)).toBeInTheDocument();
    expect(screen.getByText("ACTIVE NOW · Chrome on Android · Today, 9:42 PM")).toBeInTheDocument();
  });

  it("names no other device before the Member's first claim", () => {
    renderIt({ activeDevice: null });
    expect(screen.queryByText(/ACTIVE NOW/)).not.toBeInTheDocument();
    expect(screen.queryByText(/signs that device out/)).not.toBeInTheDocument();
  });

  it("sends next with “Use the Member App on this device”, and offers Sign out instead", () => {
    renderIt();
    const button = screen.getByRole("button", { name: "Use the Member App on this device" });
    expect(
      within(button.closest("form") as HTMLFormElement).getByDisplayValue("/app/library"),
    ).toHaveAttribute("name", "next");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

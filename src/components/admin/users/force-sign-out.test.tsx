import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { ForcedSignOut } from "@/services/admin.types";

import { ForceSignOut } from "./force-sign-out";

// Force sign-out on a Member's detail page (story 132; mockup's signOut
// confirm): "Sign out this device" asks first, with a reason Staff Activity
// keeps. The Server Action is the boundary, so it's replaced; the panel shows
// what it answers and reads the page again.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  name: "Bea Tester",
  email: "tester@example.com",
};
const PHONE = { deviceLabel: "Chrome on Android", claimedAt: "2026-11-19T03:00:00.000Z" };
const SIGNED_OUT: ForcedSignOut = { userId: BEA.userId, signedOut: PHONE, reason: "Shared" };

type State = AdminActionState<ForcedSignOut>;

function renderPanel({
  device = PHONE as typeof PHONE | null,
  answer = { status: "saved", value: SIGNED_OUT } as State,
} = {}) {
  const action = vi.fn(async (): Promise<State> => answer);
  const user = userEvent.setup();
  render(<ForceSignOut member={BEA} device={device} action={action} />);
  return { user, action };
}

const signOutButton = () => screen.getByRole("button", { name: "Sign out this device" });
const dialog = () => screen.getByRole("dialog");
const reasonField = () => within(dialog()).getByLabelText("REASON · SAVED IN STAFF ACTIVITY");
const confirm = () => within(dialog()).getByRole("button", { name: "Sign out device" });

describe("ForceSignOut", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("shows the Active Device and when it was claimed", () => {
    renderPanel();
    expect(screen.getByText("Chrome on Android")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE SINCE 19 NOV 2026, 11:00 AM")).toBeInTheDocument();
  });

  it("asks first, naming the Member and the device", async () => {
    const { user, action } = renderPanel();
    await user.click(signOutButton());

    expect(dialog()).toHaveAccessibleName("Sign Bea out of Chrome on Android?");
    expect(dialog()).toHaveTextContent("Their next click in the Member App shows “Session ended”");
    expect(action).not.toHaveBeenCalled();
  });

  it("sends the Member and the reason, then says the device is signed out", async () => {
    const { user, action } = renderPanel();
    await user.click(signOutButton());
    await user.type(reasonField(), "Shared");
    await user.click(confirm());

    expect(action).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { userId: BEA.userId, reason: "Shared" } },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "✓ SIGNED OUT · CHROME ON ANDROID · THEIR NEXT CLICK SHOWS “SESSION ENDED”",
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a refused reason under its field, and keeps asking", async () => {
    const { user } = renderPanel({
      answer: {
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { reason: ["ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY"] },
        },
      },
    });
    await user.click(signOutButton());
    await user.click(confirm());

    expect(reasonField()).toHaveAccessibleDescription(
      "ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY",
    );
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
  });

  it("says when the Member had no Active Device left to sign out", async () => {
    const { user } = renderPanel({
      answer: {
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "This Member has no Active Device, so there’s nothing to sign out.",
        },
      },
    });
    await user.click(signOutButton());
    await user.type(reasonField(), "Shared");
    await user.click(confirm());

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This Member has no Active Device, so there’s nothing to sign out.",
    );
  });

  it("says when the request never arrived, keeping the reason to try again", async () => {
    const { user } = renderPanel({ answer: { status: "failed" } });
    await user.click(signOutButton());
    await user.type(reasonField(), "Shared");
    await user.click(confirm());

    expect(within(dialog()).getByRole("alert")).toHaveTextContent(
      "Couldn’t reach the server, so nothing was changed.",
    );
    expect(reasonField()).toHaveValue("Shared");
  });

  it("sends nothing when cancelled", async () => {
    const { user, action } = renderPanel();
    await user.click(signOutButton());
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("says there's nothing to sign out with no Active Device", () => {
    renderPanel({ device: null });
    expect(screen.getByText("No Active Device. Nothing to sign out.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out this device" })).toBeNull();
  });
});

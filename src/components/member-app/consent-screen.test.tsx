import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ConsentFormState } from "@/app/app/consent/actions";
import type { ConsentStatus } from "@/lib/member-app/consent";

import { ConsentScreen } from "./consent-screen";

// The consent screen (mockup `consent`; spec, Phase 3 → Consent; stories 82,
// 83, 133e). The Server Action is passed in, so it's a mock here; the action
// itself, which refuses on the server whatever the browser sends, is tested in
// src/app/app/consent/consent.test.tsx.

type Status = Exclude<ConsentStatus, "ok">;

function renderScreen({
  status = "first-time" as Status,
  outdated = false,
  result = { error: null } as ConsentFormState,
} = {}) {
  const user = userEvent.setup();
  const action = vi.fn(
    async (_: ConsentFormState, __: FormData): Promise<ConsentFormState> => result,
  );
  const signOutAction = vi.fn(async () => {});
  render(
    <ConsentScreen
      status={status}
      versions={{ terms: "2.0", privacy: "2.1" }}
      next="/app/library"
      outdated={outdated}
      action={action}
      signOutAction={signOutAction}
    />,
  );
  return { user, action, signOutAction };
}

const termsBox = () => screen.getByRole("checkbox", { name: /I agree to the Terms of Use/ });
const privacyBox = () => screen.getByRole("checkbox", { name: /I’ve read the Privacy Policy/ });
const agree = () => screen.getByRole("button", { name: "Agree and continue" });

describe("ConsentScreen", () => {
  it("says what's kept and why, before a new Member starts", () => {
    renderScreen();

    expect(screen.getByText("BEFORE YOU START")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "What we keep, and why" }),
    ).toBeInTheDocument();
    const kept = within(screen.getByRole("list", { name: "What we keep, and why" }));
    expect(kept.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringMatching(/Google name and email/),
      expect.stringMatching(/Target Exams.*study progress/),
      expect.stringMatching(/Active Device.*log/),
      expect.stringMatching(/email and Member ID.*Reviewer PDF page/),
    ]);
    expect(screen.getByText(/We don’t sell your data/)).toBeInTheDocument();
    expect(screen.getByText("WE SAVE THE DATE AND VERSION YOU AGREED TO.")).toBeInTheDocument();
  });

  it("starts with both boxes unchecked and “Agree and continue” disabled", () => {
    renderScreen();

    expect(termsBox()).not.toBeChecked();
    expect(privacyBox()).not.toBeChecked();
    expect(termsBox()).toBeRequired();
    expect(privacyBox()).toBeRequired();
    expect(agree()).toBeDisabled();
  });

  it("keeps “Agree and continue” disabled with only the Terms box ticked", async () => {
    const { user } = renderScreen();
    await user.click(termsBox());

    expect(termsBox()).toBeChecked();
    expect(agree()).toBeDisabled();
  });

  it("keeps “Agree and continue” disabled with only the Privacy box ticked", async () => {
    const { user } = renderScreen();
    await user.click(privacyBox());

    expect(agree()).toBeDisabled();
  });

  it("enables “Agree and continue” once both are ticked, and disables it again when one is unticked", async () => {
    const { user } = renderScreen();
    await user.click(termsBox());
    await user.click(privacyBox());
    expect(agree()).toBeEnabled();

    await user.click(termsBox());
    expect(agree()).toBeDisabled();
  });

  it("sends both agreements, the versions shown and next to the action", async () => {
    const { user, action } = renderScreen();
    await user.click(termsBox());
    await user.click(privacyBox());
    await user.click(agree());

    expect(action).toHaveBeenCalledOnce();
    const sent = action.mock.calls[0]?.[1];
    expect(sent?.get("terms")).toBe("agreed");
    expect(sent?.get("privacy")).toBe("agreed");
    expect(sent?.get("termsVersion")).toBe("2.0");
    expect(sent?.get("privacyVersion")).toBe("2.1");
    expect(sent?.get("next")).toBe("/app/library");
  });

  it("shows the versions being agreed to, and links to both documents", () => {
    renderScreen();

    expect(termsBox()).toHaveAccessibleName(/version 2\.0/);
    expect(privacyBox()).toHaveAccessibleName(/version 2\.1/);
    expect(screen.getByRole("link", { name: /Terms of Use/ })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(screen.getByRole("link", { name: /Privacy Policy/ })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
  });

  it("shows the server's refusal", async () => {
    const { user } = renderScreen({ result: { error: "Tick both boxes to agree." } });
    await user.click(termsBox());
    await user.click(privacyBox());
    await user.click(agree());

    expect(await screen.findByRole("alert")).toHaveTextContent("Tick both boxes to agree.");
  });

  it.each([
    ["terms-changed", "We’ve updated our Terms"],
    ["privacy-changed", "We’ve updated our Privacy Policy"],
    ["both-changed", "We’ve updated our Terms and Privacy Policy"],
  ] as const)("names what changed when asking again (%s)", (status, heading) => {
    renderScreen({ status });

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.queryByText("BEFORE YOU START")).not.toBeInTheDocument();
    // What's kept is still listed, under the change.
    expect(
      screen.getByRole("heading", { level: 2, name: "What we keep, and why" }),
    ).toBeInTheDocument();
    expect(termsBox()).not.toBeChecked();
    expect(privacyBox()).not.toBeChecked();
    expect(agree()).toBeDisabled();
  });

  it("names only the Privacy Policy for a Member whose agreement has an old Privacy version", () => {
    renderScreen({ status: "privacy-changed" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^We’ve updated our Privacy Policy$/,
    );
    expect(screen.queryByRole("heading", { name: /Terms/ })).not.toBeInTheDocument();
  });

  it("says the documents changed while the screen was open, when it reloads with the current versions", () => {
    renderScreen({ outdated: true });

    expect(screen.getByRole("status")).toHaveTextContent(
      /changed while this page was open.*current version/,
    );
  });

  it("says nothing about a change on a normal visit", () => {
    renderScreen();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers Sign out to someone who doesn't want to agree", async () => {
    const { user, signOutAction } = renderScreen();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOutAction).toHaveBeenCalledOnce();
  });
});

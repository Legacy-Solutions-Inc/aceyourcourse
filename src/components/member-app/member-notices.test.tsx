import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberNotices } from "./member-notices";

// The Member App's in-app notices (ticket 17; spec, Phase 3 planning
// decisions → In-app notices): one dismissible banner per notice, above every
// screen but the focus screens (a deck, a quiz, a Reviewer PDF). Dismissing
// hides it at once and tells the server, which keeps it dismissed on every
// device; if the server can't be reached, it comes back.
const nav = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const GRANTED = {
  id: "6a0c8f8e-3f43-4c4a-9d5e-0b2f6c1d7e01",
  text: "You now have CE All-Access until 17 Dec 2026",
};
const EXTENDED = {
  id: "6a0c8f8e-3f43-4c4a-9d5e-0b2f6c1d7e02",
  text: "Your ME access was extended to 24 Dec 2026",
};

function renderNotices(
  notices = [GRANTED, EXTENDED],
  dismiss = vi.fn(async (_id: string) => ({ ok: true })),
) {
  const user = userEvent.setup();
  render(
    <main id="main">
      <MemberNotices notices={notices} dismiss={dismiss} />
      <h1>Home</h1>
    </main>,
  );
  return { user, dismiss };
}

const region = () => screen.getByRole("region", { name: "Notices" });
const dismissButton = (text: string) => screen.getByRole("button", { name: `Dismiss: ${text}` });

describe("MemberNotices", () => {
  beforeEach(() => {
    nav.pathname = "/app";
  });

  it("shows each notice with its own Dismiss button", () => {
    renderNotices();
    const items = within(region()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(GRANTED.text);
    expect(items[1]).toHaveTextContent(EXTENDED.text);
    expect(dismissButton(GRANTED.text)).toBeInTheDocument();
    expect(dismissButton(EXTENDED.text)).toBeInTheDocument();
  });

  it("shows nothing when there's no notice", () => {
    renderNotices([]);
    expect(screen.queryByRole("region", { name: "Notices" })).toBeNull();
  });

  it("hides a dismissed notice at once, tells the server, and moves focus to the next one", async () => {
    const { user, dismiss } = renderNotices();
    await user.click(dismissButton(GRANTED.text));

    expect(screen.queryByText(GRANTED.text)).toBeNull();
    expect(dismiss).toHaveBeenCalledWith(GRANTED.id);
    expect(dismissButton(EXTENDED.text)).toHaveFocus();
  });

  it("moves focus to the screen's heading when the last notice is dismissed", async () => {
    const { user } = renderNotices([GRANTED]);
    await user.click(dismissButton(GRANTED.text));

    expect(screen.queryByRole("region", { name: "Notices" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toHaveFocus();
  });

  it("brings a notice back, saying so, when the server can't be reached", async () => {
    const dismiss = vi.fn(async () => {
      throw new Error("offline");
    });
    const { user } = renderNotices([GRANTED], dismiss);
    await user.click(dismissButton(GRANTED.text));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t dismiss this notice. Try again.",
    );
    expect(within(region()).getByText(GRANTED.text)).toBeInTheDocument();
  });

  it.each([
    "/app/library/deck/0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
    "/app/library/quiz/0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
    "/app/library/reviewer-pdf/0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
  ])("stays out of the way on the focus screen %s", (pathname) => {
    nav.pathname = pathname;
    renderNotices();
    expect(screen.queryByRole("region", { name: "Notices" })).toBeNull();
  });
});

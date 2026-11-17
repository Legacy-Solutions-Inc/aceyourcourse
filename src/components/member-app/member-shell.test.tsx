import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemberDrawer } from "./member-drawer";
import { MemberSidebar } from "./member-sidebar";
import { NotOpenYet } from "./not-open-yet";

// The Member App's shell (BUILD-MAP §2): the sidebar's seven numbered items
// and its footer, the mobile drawer around it (the "Menu" button opens it;
// Escape, ✕, the scrim or a link close it), and the "Not open yet" screen.
vi.mock("next/navigation", () => ({ usePathname: () => "/app/library" }));

const BEA = { name: "Bea Tester", email: "tester@example.com" };
const signOut = vi.fn(async () => {});

describe("MemberSidebar", () => {
  it("lists the seven screens in order, each numbered, with its hint", () => {
    render(<MemberSidebar user={BEA} signOutAction={signOut} />);

    const nav = screen.getByRole("navigation", { name: "Member App" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "01HomeCountdown, streak and progress",
      "02LibraryFlash cards, quizzes, reviewers",
      "03CoursesVideo lessons",
      "04PlansBuy or renew access",
      "05BillingPayments and receipts",
      "06AccountExam date and privacy",
      "07SupportContact us",
    ]);
    expect(within(nav).getByRole("link", { name: /Plans/ })).toHaveAttribute("href", "/app/plans");
  });

  it("marks the current screen and only the current screen", () => {
    render(<MemberSidebar user={BEA} signOutAction={signOut} />);
    expect(screen.getByRole("link", { name: /Library/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveAttribute("aria-current");
  });

  it("shows the signed-in Member's name and email, with Sign out", () => {
    render(<MemberSidebar user={BEA} signOutAction={signOut} />);
    expect(screen.getByText("Bea Tester")).toBeInTheDocument();
    expect(screen.getByText("tester@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
  });

  it("shows the email alone when sign-in gave no name", () => {
    render(<MemberSidebar user={{ ...BEA, name: null }} signOutAction={signOut} />);
    expect(screen.getAllByText("tester@example.com")).toHaveLength(1);
  });

  it("has no exam switcher yet, and no close button outside the drawer", () => {
    render(<MemberSidebar user={BEA} signOutAction={signOut} />);
    expect(screen.queryByText(/STUDYING FOR/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });
});

describe("MemberDrawer", () => {
  function renderDrawer() {
    const user = userEvent.setup();
    render(<MemberDrawer user={BEA} signOutAction={signOut} />);
    return { user, menu: screen.getByRole("button", { name: "Menu" }) };
  }

  it("starts closed", () => {
    const { menu } = renderDrawer();
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the menu, and Escape closes it with focus back on the Menu button", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getAllByRole("link")).toHaveLength(7);
    expect(within(drawer).getByText("Bea Tester")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it("closes from ✕", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it("closes when the scrim is tapped", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    const scrim = document.querySelector('[data-slot="sheet-overlay"]');
    expect(scrim).not.toBeNull();
    await user.click(scrim as Element);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when a screen is chosen", async () => {
    const { user, menu } = renderDrawer();
    await user.click(menu);
    // jsdom can't follow links; stop it after the drawer has seen the click.
    window.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: /Plans/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NotOpenYet", () => {
  const renderScreen = () =>
    render(<NotOpenYet user={BEA} contactEmail="hello@example.com" signOutAction={signOut} />);

  it("says the Member App isn't open yet, and who is signed in", () => {
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Not open yet" })).toBeInTheDocument();
    expect(screen.getByText("tester@example.com")).toBeInTheDocument();
  });

  it("gives the support email as a link to write to", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: "hello@example.com" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
  });

  it("offers Sign out, and a way back to the website, but no way into the Member App", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Back to the website" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

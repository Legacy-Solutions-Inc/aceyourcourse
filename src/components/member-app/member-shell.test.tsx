import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberDrawer } from "./member-drawer";
import { MemberSidebar } from "./member-sidebar";
import { NotOpenYet } from "./not-open-yet";
import { ShareStreak, ShellStreakProvider, type StreakRead } from "./shell-streak";

// The Member App's shell (BUILD-MAP §2): the sidebar's seven numbered items
// and its footer, the mobile drawer around it (the "Menu" button opens it;
// Escape, ✕, the scrim or a link close it), and the "Not open yet" screen.
const nav = vi.hoisted(() => ({ pathname: "/app/library" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

beforeEach(() => {
  nav.pathname = "/app/library";
});

const BEA = { name: "Bea Tester", email: "tester@example.com" };
const signOut = vi.fn(async () => {});
const switchExam = vi.fn(async () => {});
/** What every sidebar here is given; a Member who is still onboarding has no Target Exams. */
const shell = { user: BEA, signOutAction: signOut, switchAction: switchExam, exams: [] };

const CE = {
  code: "CE",
  board: "CELE",
  name: "Civil Engineering",
  meta: "Exam 21 Nov 2026",
  countdown: "4 days to the exam",
  selected: true,
};
const ME = {
  code: "ME",
  board: "MELE",
  name: "Mechanical Engineering",
  meta: "Exam 8 Feb 2027",
  countdown: "83 days to the exam",
  selected: false,
};

describe("MemberSidebar", () => {
  it("lists the seven screens in order, each numbered, with its hint", () => {
    render(<MemberSidebar {...shell} />);

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
    render(<MemberSidebar {...shell} />);
    expect(screen.getByRole("link", { name: /Library/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveAttribute("aria-current");
  });

  it("shows the signed-in Member's name and email, with Sign out", () => {
    render(<MemberSidebar {...shell} />);
    expect(screen.getByText("Bea Tester")).toBeInTheDocument();
    expect(screen.getByText("tester@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
  });

  it("shows the email alone when sign-in gave no name", () => {
    render(<MemberSidebar {...shell} user={{ ...BEA, name: null }} />);
    expect(screen.getAllByText("tester@example.com")).toHaveLength(1);
  });

  it("has no exam switcher or badge while the Member is onboarding, and no close button outside the drawer", () => {
    render(<MemberSidebar {...shell} />);
    expect(screen.queryByText(/STUDYING FOR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Studying for/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });
});

// The sidebar's streak button (mockup L132; story 90): the Member's current
// Study Streak, account-wide, and whether today is done, linking to Home.
// The shell's layout reads it once, and stays as it is while the Member moves
// between screens, so Home's dashboard, which reads it afresh, shares its
// read: the button and the streak card never disagree.
describe("the streak button", () => {
  const withExam = { ...shell, exams: [CE] };
  /** A read of the streak, made `at` ms after the layout's. */
  const read = (current: number, studiedToday: boolean, at = 0): StreakRead => ({
    current,
    studiedToday,
    readAt: Date.parse("2026-11-17T03:42:00.000Z") + at,
  });
  const renderWith = (initial: StreakRead, children?: React.ReactNode) =>
    render(
      <ShellStreakProvider initial={initial}>
        <MemberSidebar {...withExam} />
        {children}
      </ShellStreakProvider>,
    );

  it("says the current streak and to study today, linking to Home", () => {
    renderWith(read(6, false));

    expect(screen.getByRole("link", { name: "6-DAY STREAK STUDY TODAY" })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("says today is done once it's a Study Day", () => {
    renderWith(read(7, true));

    expect(screen.getByRole("link", { name: "7-DAY STREAK DONE TODAY" })).toBeInTheDocument();
  });

  it("invites a Member with no streak to start one, rather than a 0-day streak", () => {
    renderWith(read(0, false));

    expect(screen.getByRole("link", { name: "START A STREAK STUDY TODAY" })).toBeInTheDocument();
    expect(screen.queryByText(/0-DAY/)).not.toBeInTheDocument();
  });

  it("follows the dashboard's newer read of the streak", () => {
    renderWith(read(0, false), <ShareStreak read={read(1, true, 60_000)} />);

    expect(screen.getByRole("link", { name: "1-DAY STREAK DONE TODAY" })).toBeInTheDocument();
  });

  it("keeps the layout's read over an older one shared before it", () => {
    const { rerender } = renderWith(read(0, false), <ShareStreak read={read(1, true, 60_000)} />);
    expect(screen.getByRole("link", { name: "1-DAY STREAK DONE TODAY" })).toBeInTheDocument();

    // A day later the layout redraws (a Target Exam switch, say) with its own read.
    rerender(
      <ShellStreakProvider initial={read(1, false, 24 * 60 * 60_000)}>
        <MemberSidebar {...withExam} />
        <ShareStreak read={read(1, true, 60_000)} />
      </ShellStreakProvider>,
    );
    expect(screen.getByRole("link", { name: "1-DAY STREAK STUDY TODAY" })).toBeInTheDocument();
  });

  it("isn't shown while the Member is onboarding", () => {
    render(
      <ShellStreakProvider initial={read(3, false)}>
        <MemberSidebar {...shell} />
      </ShellStreakProvider>,
    );

    expect(screen.queryByRole("link", { name: /STREAK/ })).not.toBeInTheDocument();
  });

  it("isn't shown outside the shell", () => {
    render(<MemberSidebar {...withExam} />);

    expect(screen.queryByRole("link", { name: /STREAK/ })).not.toBeInTheDocument();
  });
});

// The exam switcher (BUILD-MAP §2; spec → The mockup's hardcoded CE labels):
// the card and the footer badge say the selected Target Exam, never a fixed
// "CE".
describe("the exam switcher", () => {
  const renderSwitcher = (exams = [CE, ME]) => {
    const user = userEvent.setup();
    render(<MemberSidebar {...shell} exams={exams} />);
    return { user, card: screen.getByRole("button", { name: /STUDYING FOR/ }) };
  };

  it("says the selected Target Exam's code and board, and the days left", () => {
    const { card } = renderSwitcher();
    expect(card).toHaveTextContent("CE · CELE");
    expect(card).toHaveTextContent("4 days to the exam");
    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("list", { name: "Your exams", hidden: true })).not.toBeVisible();
  });

  it("follows the selected Target Exam, in the card and the footer badge", () => {
    renderSwitcher([
      { ...CE, selected: false },
      { ...ME, selected: true },
    ]);
    expect(screen.getByRole("button", { name: /STUDYING FOR/ })).toHaveTextContent("ME · MELE");
    expect(screen.getByText("ME · MELE", { selector: "span.border" })).toHaveTextContent(
      "Studying for ME · MELE",
    );
    expect(screen.queryByText(/CE · CELE/)).not.toBeInTheDocument();
  });

  it("opens the Member's Target Exams, each with its Exam Date, marking the selected one", async () => {
    const { user, card } = renderSwitcher();
    await user.click(card);

    expect(card).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Your exams" });
    const [ce, me] = within(list).getAllByRole("button");
    expect(ce).toHaveTextContent("Civil EngineeringExam 21 Nov 2026");
    expect(ce).toHaveAttribute("aria-current", "true");
    expect(within(ce as HTMLElement).getByText("Selected")).toBeInTheDocument();
    expect(me).toHaveTextContent("Mechanical EngineeringExam 8 Feb 2027");
    expect(me).not.toHaveAttribute("aria-current");
  });

  it("switches to the Target Exam picked, sending its code, and closes the list", async () => {
    const { user, card } = renderSwitcher();
    await user.click(card);
    await user.click(screen.getByRole("button", { name: /Mechanical Engineering/ }));

    expect(switchExam).toHaveBeenCalledTimes(1);
    const sent = switchExam.mock.calls[0] as unknown as [FormData];
    expect(sent[0].get("examCode")).toBe("ME");
    expect(card).toHaveAttribute("aria-expanded", "false");
  });

  it("offers “+ Add an exam”, which opens the add form", async () => {
    const { user, card } = renderSwitcher();
    await user.click(card);
    expect(screen.getByRole("link", { name: "+ Add an exam" })).toHaveAttribute(
      "href",
      "/app/add-exam",
    );
  });

  it("closes on Escape", async () => {
    const { user, card } = renderSwitcher();
    await user.click(card);
    await user.keyboard("{Escape}");
    expect(card).toHaveAttribute("aria-expanded", "false");
  });

  it("puts focus back on the card when Escape closes the list from inside it", async () => {
    const { user, card } = renderSwitcher();
    await user.click(card);
    screen.getByRole("button", { name: /Mechanical Engineering/ }).focus();
    await user.keyboard("{Escape}");

    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(card).toHaveFocus();
  });
});

describe("MemberDrawer", () => {
  function renderDrawer() {
    const user = userEvent.setup();
    render(<MemberDrawer {...shell} exams={[CE, ME]} />);
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
    expect(within(within(drawer).getByRole("navigation")).getAllByRole("link")).toHaveLength(7);
    expect(within(drawer).getByRole("button", { name: /STUDYING FOR/ })).toHaveTextContent(
      "CE · CELE",
    );
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

  it("has no Menu button on a focus screen, which has a back bar instead", () => {
    nav.pathname = "/app/library/deck/3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";
    render(<MemberDrawer {...shell} exams={[CE, ME]} />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
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

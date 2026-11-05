import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExamsMenu } from "./exams-menu";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const EXAMS = [
  { code: "CE", name: "Civil Engineering", board: "CELE" },
  { code: "CPA", name: "Accountancy", board: "CPALE" },
];

function renderMenu() {
  return render(
    <div>
      <p>Outside the menu</p>
      <ExamsMenu exams={EXAMS} />
    </div>,
  );
}

const examsButton = () => screen.getByRole("button", { name: /exams/i });

describe("ExamsMenu", () => {
  it("starts closed", () => {
    renderMenu();
    expect(examsButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /civil engineering/i })).not.toBeInTheDocument();
  });

  it("opens on click and lists every Exam with code, name and board, linking to its Exam page", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(examsButton());

    expect(examsButton()).toHaveAttribute("aria-expanded", "true");
    const ce = screen.getByRole("link", { name: /CE.*Civil Engineering.*CELE/ });
    expect(ce).toHaveAttribute("href", "/exams/ce");
    expect(screen.getByRole("link", { name: /CPA.*Accountancy.*CPALE/ })).toHaveAttribute(
      "href",
      "/exams/cpa",
    );
    expect(screen.getByRole("link", { name: /browse all reviewers/i })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("opens with Enter and with Space from the keyboard", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.tab();
    expect(examsButton()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(examsButton()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(examsButton()).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(examsButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(examsButton());
    await user.tab();
    expect(screen.getByRole("link", { name: /civil engineering/i })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(examsButton()).toHaveAttribute("aria-expanded", "false");
    expect(examsButton()).toHaveFocus();
  });

  it("closes on a click outside the menu", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(examsButton());

    await user.click(screen.getByText("Outside the menu"));

    expect(examsButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open on a click inside the panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(examsButton());

    await user.click(screen.getByText(/pick your board exam/i));

    expect(examsButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes once an Exam is chosen", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(examsButton());
    // jsdom can't navigate. Stop the link's default action to keep the run quiet.
    window.addEventListener("click", (event) => event.preventDefault(), { once: true });

    await user.click(screen.getByRole("link", { name: /civil engineering/i }));

    expect(examsButton()).toHaveAttribute("aria-expanded", "false");
  });

  // Ticket 23: Owners add Exams, up to 12.
  it.each([6, 12])("lists %i Exams in order, in rows of at most 6", async (count) => {
    const user = userEvent.setup();
    const exams = Array.from({ length: count }, (_, i) => ({
      code: `X${String.fromCharCode(65 + i)}`,
      name: `Exam ${i + 1}`,
      board: `B${i}`,
    }));
    render(<ExamsMenu exams={exams} />);
    await user.click(examsButton());

    const links = screen.getAllByRole("link", { name: /^X[A-L] Exam/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      exams.map((exam) => `/exams/${exam.code.toLowerCase()}`),
    );
    expect(screen.getByRole("list").style.gridTemplateColumns).toContain(" / 6)");
  });

  it("shows markup typed into an Exam's name as plain text", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ExamsMenu exams={[{ code: "CHE", name: "<b>CHE</b>", board: "CHELE" }]} />,
    );
    await user.click(examsButton());

    expect(screen.getByRole("link", { name: /<b>CHE<\/b>/ })).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
});

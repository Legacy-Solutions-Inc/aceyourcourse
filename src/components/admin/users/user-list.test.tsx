import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminUserList, AdminUserRow } from "@/services/admin.types";

import { UserList } from "./user-list";

// The Users list (story 129; BUILD-MAP §3.10): each Member's row, the filter
// chips and the pages, all links, with the search box in the URL. The list
// comes from the seam, already searched, filtered and paged.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const NOW = new Date("2026-11-19T03:42:00.000Z");

const BEA: AdminUserRow = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  name: "Bea Tester",
  email: "tester@example.com",
  joinedAt: "2026-11-17T03:42:00.000Z",
  targetExams: ["CE", "ME"],
  accessPasses: [{ examCode: "CE", endsAt: "2027-02-15T03:42:00.000Z" }],
  activeDevice: { deviceLabel: "Chrome on Android", claimedAt: "2026-11-19T03:00:00.000Z" },
  role: "member",
  betaTester: true,
};
const LOU: AdminUserRow = {
  userId: "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
  name: null,
  email: "lapsed@example.com",
  joinedAt: "2026-11-16T03:42:00.000Z",
  targetExams: [],
  accessPasses: [{ examCode: "CE", endsAt: "2026-11-14T03:42:00.000Z" }],
  activeDevice: null,
  role: "owner",
  betaTester: false,
};

function list(change: Partial<AdminUserList> = {}): AdminUserList {
  return {
    query: { q: null, filter: "all", page: 1 },
    rows: [BEA, LOU],
    matching: 2,
    total: 2,
    pageCount: 1,
    ...change,
  };
}

const table = () => screen.getByRole("table");
const rowOf = (text: string) =>
  within(table())
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(text));

describe("UserList", () => {
  it("shows each Member with a link to their page, their Target Exams, passes, Active Device and role", () => {
    render(<UserList list={list()} now={NOW} />);

    const bea = rowOf("Bea Tester");
    if (!bea) throw new Error("No row for Bea");
    expect(within(bea).getByRole("link", { name: /Bea Tester/ })).toHaveAttribute(
      "href",
      `/admin/users/${BEA.userId}`,
    );
    expect(bea).toHaveTextContent("tester@example.com");
    expect(bea).toHaveTextContent("CE · ME");
    expect(bea).toHaveTextContent("CE · 15 FEB 2027");
    expect(bea).toHaveTextContent("Chrome on Android");
    expect(bea).toHaveTextContent("SINCE 19 NOV 2026, 11:00 AM");
    expect(bea).toHaveTextContent("MEMBER");
    expect(bea).toHaveTextContent("BETA TESTER");
  });

  it("shows a Member with no name by their email, and what they don't have", () => {
    render(<UserList list={list()} now={NOW} />);

    const lou = rowOf("lapsed@example.com");
    if (!lou) throw new Error("No row for Lou");
    expect(within(lou).getByRole("link", { name: /lapsed@example\.com/ })).toBeInTheDocument();
    expect(lou).toHaveTextContent("No Target Exam");
    expect(lou).toHaveTextContent("No Active Device");
    expect(lou).toHaveTextContent("OWNER");
  });

  it("shows an ended pass in red, saying it ended", () => {
    render(<UserList list={list()} now={NOW} />);

    // Each cell is there twice: in its column, and folded under the name for a phone.
    const ended = within(rowOf("lapsed@example.com") ?? document.body).getAllByText(
      "CE · ENDED 14 NOV 2026",
    );
    expect(ended).toHaveLength(2);
    for (const pass of ended) expect(pass).toHaveClass("text-destructive");
    const active = within(rowOf("Bea Tester") ?? document.body).getAllByText("CE · 15 FEB 2027");
    for (const pass of active) expect(pass).not.toHaveClass("text-destructive");
  });

  it("says when a Member has no pass", () => {
    render(<UserList list={list({ rows: [{ ...BEA, accessPasses: [] }] })} now={NOW} />);
    expect(rowOf("Bea Tester")).toHaveTextContent("No pass");
  });

  it("marks the current filter, and every chip starts again at the first page", () => {
    render(
      <UserList
        list={list({ query: { q: "bea", filter: "beta", page: 2 }, pageCount: 3, matching: 60 })}
        now={NOW}
      />,
    );

    const chips = screen.getByRole("group", { name: "Filter" });
    expect(within(chips).getByRole("link", { name: "Beta Tester" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(chips).getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
    expect(within(chips).getByRole("link", { name: "Expired" })).toHaveAttribute(
      "href",
      "/admin/users?q=bea&filter=expired",
    );
    expect(
      within(chips)
        .getAllByRole("link")
        .map((chip) => chip.textContent),
    ).toEqual(["All", "Active Pass", "Expired", "None", "Staff", "Beta Tester"]);
  });

  it("keeps the search in the box", () => {
    render(<UserList list={list({ query: { q: "bea", filter: "all", page: 1 } })} now={NOW} />);
    expect(screen.getByRole("searchbox", { name: "Search by name or email" })).toHaveValue("bea");
  });

  it("goes to the pages before and after, keeping the search and filter", () => {
    render(
      <UserList
        list={list({ query: { q: "bea", filter: "beta", page: 2 }, pageCount: 3, matching: 60 })}
        now={NOW}
      />,
    );

    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(pages).toHaveTextContent("PAGE 2 OF 3");
    expect(within(pages).getByRole("link", { name: "← Previous" })).toHaveAttribute(
      "href",
      "/admin/users?q=bea&filter=beta",
    );
    expect(within(pages).getByRole("link", { name: "Next →" })).toHaveAttribute(
      "href",
      "/admin/users?q=bea&filter=beta&page=3",
    );
  });

  it("has no page before the first, and none after the last", () => {
    render(<UserList list={list({ pageCount: 2 })} now={NOW} />);
    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pages).queryByRole("link", { name: "← Previous" })).toBeNull();
    expect(within(pages).getByRole("link", { name: "Next →" })).toBeInTheDocument();
  });

  it("shows no pages when one holds every Member", () => {
    render(<UserList list={list()} now={NOW} />);
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("says which Members it shows", () => {
    render(<UserList list={list()} now={NOW} />);
    expect(screen.getByText("1–2 OF 2 MEMBERS")).toBeInTheDocument();
  });

  it("says when a search or filter matches nobody, with a way back to everyone", () => {
    render(
      <UserList
        list={list({ query: { q: "nobody", filter: "staff", page: 1 }, rows: [], matching: 0 })}
        now={NOW}
      />,
    );

    expect(screen.getByText("No users match. Clear the search or filter.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show every Member" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("says when there are no Members at all yet", () => {
    render(<UserList list={list({ rows: [], matching: 0, total: 0 })} now={NOW} />);

    expect(
      screen.getByText(
        "No Members yet. Members appear here after their first sign-in to the Member App.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show every Member" })).toBeNull();
  });
});

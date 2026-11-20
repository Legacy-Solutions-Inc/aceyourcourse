import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AdminPrivacyRequest } from "@/services/admin.types";

import { PrivacyRequests } from "./privacy-requests";

// The Users screen's Privacy Requests tab (Phase 3, ticket 18; story 133):
// what Members asked for from Account, soonest due first as the seam orders
// them, each with its Member, dates and status, an overdue one flagged.
// Carrying them out comes with ticket 19, so there's nothing to click but the
// Member.
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = { userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f", email: "stranger@example.com" };

const COPY: AdminPrivacyRequest = {
  id: "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a11",
  type: "data-copy",
  status: "open",
  // 00:30 on 20 Nov in Manila, still the 19th in UTC.
  requestedAt: "2026-11-19T16:30:00.000Z",
  dueOn: "2026-11-27",
  overdue: true,
  member: { ...SAM, name: null },
};
const DELETION: AdminPrivacyRequest = {
  id: "0b6e4d2a-7c1f-4e3b-9a85-2d4c6e8f0a12",
  type: "deletion",
  status: "open",
  requestedAt: "2026-11-19T02:00:00.000Z",
  dueOn: "2026-12-19",
  overdue: false,
  member: BEA,
};

const list = () => screen.getByRole("region", { name: "Privacy Requests" });
const rows = () => within(list()).getAllByRole("row").slice(1);

describe("PrivacyRequests", () => {
  it("lists each request in the seam's order: type, Member, requested, due, status", () => {
    render(<PrivacyRequests requests={[COPY, DELETION]} />);

    expect(
      within(list())
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["TYPE", "MEMBER", "REQUESTED", "DUE", "STATUS"]);
    expect(rows()).toHaveLength(2);
    const [copy, deletion] = rows();
    expect(copy).toHaveTextContent("DATA COPY");
    expect(copy).toHaveTextContent("20 NOV 2026");
    expect(copy).toHaveTextContent("27 NOV 2026");
    expect(deletion).toHaveTextContent("DELETION");
    expect(deletion).toHaveTextContent("Bea Tester");
    expect(deletion).toHaveTextContent(BEA.email);
    expect(deletion).toHaveTextContent("19 NOV 2026");
    expect(deletion).toHaveTextContent("19 DEC 2026");
    expect(deletion).toHaveTextContent("OPEN");
  });

  it("opens each Member's detail page, named by their email when they have no name", () => {
    render(<PrivacyRequests requests={[COPY, DELETION]} />);
    expect(within(list()).getByRole("link", { name: "Bea Tester" })).toHaveAttribute(
      "href",
      `/admin/users/${BEA.userId}`,
    );
    expect(within(list()).getByRole("link", { name: SAM.email })).toHaveAttribute(
      "href",
      `/admin/users/${SAM.userId}`,
    );
  });

  it("flags an overdue request, and only that one", () => {
    render(<PrivacyRequests requests={[COPY, DELETION]} />);
    const [copy, deletion] = rows();
    expect(within(copy as HTMLElement).getByText("OVERDUE")).toBeInTheDocument();
    expect(within(deletion as HTMLElement).queryByText("OVERDUE")).not.toBeInTheDocument();
  });

  it("says a done request is done", () => {
    render(<PrivacyRequests requests={[{ ...DELETION, status: "done" }]} />);
    expect(rows()[0]).toHaveTextContent("DONE");
  });

  it("says a request's account is deleted, with no Member to open", () => {
    render(<PrivacyRequests requests={[{ ...DELETION, status: "done", member: null }]} />);
    expect(rows()[0]).toHaveTextContent("Account deleted");
    expect(within(list()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers nothing to carry a request out yet", () => {
    render(<PrivacyRequests requests={[COPY, DELETION]} />);
    expect(within(list()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says where requests come from when there are none", () => {
    render(<PrivacyRequests requests={[]} />);
    expect(
      screen.getByText(
        "No Privacy Requests. Members ask for a copy of their data, or for their account to be deleted, from Account in the Member App.",
      ),
    ).toBeInTheDocument();
  });
});

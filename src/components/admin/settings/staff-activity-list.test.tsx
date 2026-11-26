import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StaffActivityEntry,
  StaffActivityList as List,
  StaffActivityQuery,
} from "@/services/admin.types";

import { StaffActivityCard } from "./staff-activity-card";
import { StaffActivityList } from "./staff-activity-list";

// The Staff Activity list for Owners (Phase 4, ticket 15): each record's
// time in Manila, who made it, its area and what it changed, newest first;
// filters by Staff member and area in the URL; "Older" and "Newest" by the
// cursor; "No activity" when nothing matches. The router is the boundary,
// so it's replaced.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const FIRST_PAGE: StaffActivityQuery = { actor: null, area: null, before: null };
const ANGEL = { email: "angel@aceyourcourse.ph", name: "Angel Rose L. Lepaña" };
const PAYMONGO = { email: "system:paymongo", name: "PayMongo (system)" };

function entry(seq: number, fields: Partial<StaffActivityEntry> = {}): StaffActivityEntry {
  return {
    seq,
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    // 17:30 on 25 Nov in UTC is 1:30 am on 26 Nov in Manila.
    at: "2026-11-25T17:30:00.000Z",
    actor: ANGEL,
    entity: "plan",
    entityId: "plan-1",
    action: "update",
    before: { price: 499, onSale: true, note: "old" },
    after: { price: 599, onSale: true, bestValue: true },
    ...fields,
  };
}

function list(fields: Partial<List> = {}): List {
  return {
    query: FIRST_PAGE,
    entries: [entry(2)],
    next: null,
    actors: [ANGEL, PAYMONGO],
    entities: ["order", "plan"],
    ...fields,
  };
}

/** The records, in the order shown. */
const items = () =>
  [...screen.getByRole("list", { name: "Staff Activity" }).children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

describe("StaffActivityList", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("shows each record's time in Manila, who made it, its area, its action and the fields it changed", () => {
    render(<StaffActivityList list={list()} />);
    const [item] = items();
    const record = within(item ?? document.body);
    expect(record.getByText("26 Nov 2026, 1:30 am")).toHaveAttribute(
      "dateTime",
      "2026-11-25T17:30:00.000Z",
    );
    expect(item).toHaveTextContent("Angel Rose L. Lepaña");
    expect(item).toHaveTextContent("angel@aceyourcourse.ph");
    expect(item).toHaveTextContent("Plans");
    expect(item).toHaveTextContent("update · plan plan-1");
    expect(record.getAllByRole("listitem").map((change) => change.textContent)).toEqual([
      "Changed: price",
      "Added: bestValue",
      "Removed: note",
    ]);
    expect(record.getByRole("list", { name: "What changed" })).not.toHaveTextContent("onSale");
  });

  it("shows the values before and after, folded away", async () => {
    const user = userEvent.setup();
    render(<StaffActivityList list={list()} />);
    const details = screen.getByText("Before and after");
    await user.click(details);
    expect(screen.getByText(/"note": "old"/)).toBeVisible();
    expect(screen.getByText(/"bestValue": true/)).toBeVisible();
  });

  it("names PayMongo's own changes PayMongo (system), with no email", () => {
    render(
      <StaffActivityList
        list={list({
          entries: [entry(3, { actor: PAYMONGO, entity: "order", action: "paid" })],
        })}
      />,
    );
    const [item] = items();
    expect(item).toHaveTextContent("PayMongo (system)");
    expect(item).not.toHaveTextContent("system:paymongo");
    expect(item).toHaveTextContent("Orders");
  });

  it("lists newest first, as the seam gives them", () => {
    render(
      <StaffActivityList
        list={list({
          entries: [
            entry(9, { entityId: "plan-9" }),
            entry(5, { entityId: "plan-5" }),
            entry(1, { entityId: "plan-1" }),
          ],
        })}
      />,
    );
    expect(items().map((item) => item.textContent?.match(/plan-\d/)?.[0])).toEqual([
      "plan-9",
      "plan-5",
      "plan-1",
    ]);
  });

  it("says No activity when nothing matches, with a way back to all of it", () => {
    render(
      <StaffActivityList
        list={list({ query: { ...FIRST_PAGE, actor: ANGEL.email }, entries: [] })}
      />,
    );
    expect(screen.getByText("No activity")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Staff Activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all activity" })).toHaveAttribute(
      "href",
      "/admin/settings/activity",
    );
  });

  it("says No activity, with no link, before anything is recorded", () => {
    render(<StaffActivityList list={list({ entries: [], actors: [], entities: [] })} />);
    expect(screen.getByText("No activity")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show all activity" })).not.toBeInTheDocument();
  });

  it("filters by Staff member in the URL, back to the first page", async () => {
    const user = userEvent.setup();
    render(<StaffActivityList list={list({ query: { ...FIRST_PAGE, before: 40 } })} />);
    const staff = screen.getByRole("combobox", { name: "Staff member" });
    expect(
      within(staff)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All Staff", "Angel Rose L. Lepaña · angel@aceyourcourse.ph", "PayMongo (system)"]);
    await user.selectOptions(staff, "PayMongo (system)");
    expect(replace).toHaveBeenLastCalledWith("/admin/settings/activity?actor=system%3Apaymongo", {
      scroll: false,
    });
  });

  it("filters by area in the URL, keeping the Staff member", async () => {
    const user = userEvent.setup();
    render(<StaffActivityList list={list({ query: { ...FIRST_PAGE, actor: ANGEL.email } })} />);
    const area = screen.getByRole("combobox", { name: "Area" });
    expect(
      within(area)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All areas", "Orders", "Plans"]);
    await user.selectOptions(area, "Orders");
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/settings/activity?actor=angel%40aceyourcourse.ph&area=orders",
      { scroll: false },
    );
    await user.selectOptions(area, "All areas");
    expect(replace).toHaveBeenLastCalledWith(
      "/admin/settings/activity?actor=angel%40aceyourcourse.ph",
      { scroll: false },
    );
  });

  it("keeps a filter value from the URL that no record has, selected", () => {
    render(
      <StaffActivityList
        list={list({
          query: { actor: "nobody@example.com", area: "coupons", before: null },
          entries: [],
        })}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Staff member" })).toHaveValue(
      "nobody@example.com",
    );
    expect(screen.getByRole("combobox", { name: "Area" })).toHaveValue("coupons");
  });

  it("links to the older page by the cursor, keeping the filters", () => {
    render(
      <StaffActivityList list={list({ query: { ...FIRST_PAGE, area: "plans" }, next: 71 })} />,
    );
    const pages = screen.getByRole("navigation", { name: "Staff Activity pages" });
    expect(within(pages).getByRole("link", { name: "Older" })).toHaveAttribute(
      "href",
      "/admin/settings/activity?area=plans&before=71",
    );
    expect(within(pages).queryByRole("link", { name: "Newest" })).not.toBeInTheDocument();
  });

  it("links back to the newest page from an older one, and has no Older link on the last", () => {
    render(<StaffActivityList list={list({ query: { ...FIRST_PAGE, before: 71 }, next: null })} />);
    const pages = screen.getByRole("navigation", { name: "Staff Activity pages" });
    expect(within(pages).getByRole("link", { name: "Newest" })).toHaveAttribute(
      "href",
      "/admin/settings/activity",
    );
    expect(within(pages).queryByRole("link", { name: "Older" })).not.toBeInTheDocument();
  });

  it("has no page links on the only page", () => {
    render(<StaffActivityList list={list()} />);
    expect(
      screen.queryByRole("navigation", { name: "Staff Activity pages" }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing to edit or delete", () => {
    render(<StaffActivityList list={list()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("StaffActivityCard", () => {
  it("links from Settings to Staff Activity", () => {
    render(<StaffActivityCard />);
    const card = screen.getByRole("region", { name: "STAFF ACTIVITY" });
    expect(within(card).getByRole("link", { name: "Open Staff Activity" })).toHaveAttribute(
      "href",
      "/admin/settings/activity",
    );
  });
});

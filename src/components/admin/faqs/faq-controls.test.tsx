import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { AdminActionState } from "@/lib/admin/action";
import type { AdminFaq, AdminFaqList, DeletedFaq } from "@/services/admin.types";
import type { Faq } from "@/services/catalogue.types";

import { FaqGroups, FaqList } from "./faq-list";
import { FaqPanel } from "./faq-panel";

// The FAQS tab's columns: GROUPS, the questions with ▲▼, and the panel that
// follows a saved FAQ to its group. Server Actions are stubs that answer as
// adminAction would; the router is the framework boundary, so it's replaced.
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  unstable_rethrow: () => {},
}));

const faq = (id: string, question: string, fields: Partial<Faq> = {}): Faq => ({
  id,
  slug: id,
  group: "shipping",
  order: 1,
  question,
  answer: "An answer.",
  reviewQuote: null,
  popularLabel: null,
  requiresMemberApp: false,
  showOnFaqPage: true,
  showCoverageTable: false,
  ...fields,
});

const SHIPPING = [
  faq("faq-001", "Where do orders ship from?"),
  faq("faq-002", "Do you deliver nationwide?", {
    order: 2,
    reviewQuote: { reviewId: "rev-014", text: "Glossy" },
  }),
  faq("faq-003", "How do I track my order?", { order: 3, showOnFaqPage: false }),
];

const LIST: AdminFaqList = {
  groups: [
    { group: "shipping", title: "Shipping", count: 3 },
    { group: "paper", title: "Paper and print", count: 3 },
    { group: "coverage", title: "What’s covered", count: 4 },
    { group: "buying", title: "Buying", count: 6 },
    { group: "authenticity", title: "Authenticity", count: 2 },
  ],
  query: { group: "shipping", q: null },
  rows: SHIPPING,
  reviews: [],
  slugs: ["faq-001", "faq-002", "faq-003"],
};

type Submission = { input: unknown; expected?: { savedAt: string } };

function answering<T>(...answers: AdminActionState<T>[]) {
  return vi.fn(async (_previous: AdminActionState<T>, _submission: Submission) => {
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next;
  });
}

beforeEach(() => {
  router.refresh.mockClear();
  router.replace.mockClear();
});

describe("FaqGroups", () => {
  it("lists the 5 groups with their counts, the current one marked, and the note", () => {
    render(<FaqGroups list={LIST} />);

    const groups = screen.getByRole("navigation", { name: "FAQ groups" });
    const links = within(groups).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Shipping3 questions",
      "Paper and print3 questions",
      "What’s covered4 questions",
      "Buying6 questions",
      "Authenticity2 questions",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(links[3]).toHaveAttribute("href", "/admin/reviews?tab=faqs&group=buying");
    expect(within(groups).getByText("Groups match the sections on the FAQ page.")).toBeVisible();
  });
});

describe("FaqList", () => {
  function renderList(list: AdminFaqList = LIST, move = answering<string[]>()) {
    const user = userEvent.setup();
    render(
      <>
        <FaqList list={list} selected="faq-002" move={move} />
        <Toaster />
      </>,
    );
    return { user, move };
  }

  it("shows the group's questions in order with their meta lines, and the label", () => {
    renderList();

    expect(screen.getByText("SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Shipping" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "▲▼Where do orders ship from?ANSWER ONLY",
      "▲▼Do you deliver nationwide?WITH REVIEW QUOTE",
      "▲▼How do I track my order?ANSWER ONLY · HIDDEN",
    ]);
    expect(screen.getByRole("link", { name: /Do you deliver nationwide/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "+ Add question to Shipping" })).toHaveAttribute(
      "href",
      "/admin/reviews?tab=faqs&group=shipping&faq=new",
    );
    expect(screen.getByText(/Published with FAQ structured data/)).toBeInTheDocument();
  });

  it("disables ▲ on the first and ▼ on the last", () => {
    renderList();

    expect(
      screen.getByRole("button", { name: "Move up: “Where do orders ship from?”" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move down: “Where do orders ship from?”" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Move down: “How do I track my order?”" }),
    ).toBeDisabled();
  });

  it("moves a question down at once, then reads the list again", async () => {
    const { user, move } = renderList(
      LIST,
      answering<string[]>({ status: "saved", value: ["faq-002", "faq-001", "faq-003"] }),
    );

    await user.click(
      screen.getByRole("button", { name: "Move down: “Where do orders ship from?”" }),
    );

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(move).toHaveBeenCalledWith(expect.anything(), {
      input: { id: "faq-001", direction: "down" },
    });
  });

  it("says why the server refused a move, or that the question is gone", async () => {
    const { user } = renderList(
      LIST,
      answering<string[]>(
        {
          status: "refused",
          error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY LAST IN ITS GROUP" },
        },
        { status: "refused", error: { kind: "not-found" } },
      ),
    );
    const down = screen.getByRole("button", { name: "Move down: “Do you deliver nationwide?”" });

    await user.click(down);
    expect(await screen.findByText("IT’S ALREADY LAST IN ITS GROUP")).toBeInTheDocument();
    await waitFor(() => expect(down).toBeEnabled());
    await user.click(down);
    expect(
      await screen.findByText(
        "That question is no longer in the catalogue. The list is up to date.",
      ),
    ).toBeInTheDocument();
  });

  it("lists matches from every group while searching, with ▲▼ disabled", () => {
    renderList({
      ...LIST,
      query: { group: "shipping", q: "shopee" },
      rows: [SHIPPING[0], faq("faq-011", "Where can I buy?", { group: "buying" })].filter(
        (row): row is Faq => row !== undefined,
      ),
    });

    expect(screen.getByText("2 MATCHES IN ALL GROUPS")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Matching questions" })).getAllByRole(
      "listitem",
    );
    expect(rows[1]).toHaveTextContent("BUYING · ANSWER ONLY");
    for (const button of screen.getAllByRole("button", { name: /^Move (up|down)/ })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Clear the search to reorder");
    }
    expect(screen.getByText("Clear the search to reorder.")).toBeInTheDocument();
  });

  it("says when no question matches", () => {
    renderList({ ...LIST, query: { group: "shipping", q: "zzz" }, rows: [] });

    expect(screen.getByText("No questions match.")).toBeInTheDocument();
  });
});

describe("FaqPanel", () => {
  const STAMP = { savedAt: "2026-10-22T04:00:00.000Z", savedBy: "AYC Content Team" };
  const opened = (fields: Partial<Faq> = {}): AdminFaq => ({
    faq: faq("faq-002", "Do you deliver nationwide?", { order: 2, ...fields }),
    stamp: STAMP,
  });
  const actions = (save = answering<AdminFaq>(), add = answering<AdminFaq>()) => ({
    save,
    add,
    remove: answering<DeletedFaq>(),
  });

  it("asks for a question when none is selected", () => {
    render(<FaqPanel selected={null} opened={null} list={LIST} actions={actions()} />);

    expect(screen.getByRole("complementary", { name: "FAQ editor" })).toHaveTextContent(
      "Select a question",
    );
  });

  it("follows an FAQ moved to another group, so the list shows it there", async () => {
    const user = userEvent.setup();
    const save = answering<AdminFaq>({
      status: "saved",
      value: opened({ group: "coverage", order: 5 }),
    });
    render(<FaqPanel selected="faq-002" opened={opened()} list={LIST} actions={actions(save)} />);

    await user.selectOptions(screen.getByLabelText("GROUP"), "coverage");
    await user.click(screen.getByRole("button", { name: "Save question" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/reviews?tab=faqs&group=coverage&faq=faq-002",
        { scroll: false },
      ),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("opens a new FAQ in the list's group, and goes to it once added", async () => {
    const user = userEvent.setup();
    const add = answering<AdminFaq>({
      status: "saved",
      value: opened({ id: "faq-019", group: "buying" }),
    });
    render(
      <FaqPanel
        selected="new"
        opened={null}
        list={{ ...LIST, query: { group: "buying", q: null } }}
        actions={actions(undefined, add)}
      />,
    );

    expect(screen.getByText("NEW QUESTION · BUYING")).toBeInTheDocument();
    await user.type(screen.getByLabelText("QUESTION"), "Can I pay by GCash?");
    await user.type(screen.getByLabelText("ANSWER"), "Yes.");
    await user.click(screen.getByRole("button", { name: "Add question" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/admin/reviews?tab=faqs&group=buying&faq=faq-019",
        { scroll: false },
      ),
    );
  });
});

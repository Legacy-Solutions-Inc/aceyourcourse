import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminTopic, AdminTopicList } from "@/services/admin.types";
import type { Topic } from "@/services/content.types";

import { TopicsEditor, type TopicsEditorActions } from "./topics-editor";

// A Subject's Topics list in Member App content (story 133n): add, rename,
// move and delete (only when empty). The Server Actions are the boundary, so
// they are replaced; the screen shows what each one answers and reads the
// list again.
const { refresh, toast } = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

const OPENED = { savedAt: "2026-11-17T03:42:00.000Z", savedBy: null };
const EMPTY = { deck: null, quiz: null, reviewerPdf: null };

const SIMPLE: AdminTopic = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Simple Curves",
  position: 1,
  content: { deck: "visible", quiz: "hidden", reviewerPdf: "draft" },
  deleteBlocker: "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
  stamp: OPENED,
};
const SURVEYING: AdminTopic = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Surveying",
  position: 2,
  content: EMPTY,
  deleteBlocker: null,
  stamp: OPENED,
};

const LIST: AdminTopicList = {
  exam: { code: "CE", board: "CELE", name: "Civil Engineering" },
  subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
  topics: [SIMPLE, SURVEYING],
};

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function renderEditor(list: AdminTopicList = LIST, actions: Partial<TopicsEditorActions> = {}) {
  const all = {
    addTopic: vi.fn(async (): Promise<AdminActionState<AdminTopic>> =>
      saved({
        ...SURVEYING,
        id: "33333333-3333-4333-8333-333333333333",
        name: "Highways",
        position: 3,
      }),
    ),
    saveTopicName: vi.fn(async (): Promise<AdminActionState<AdminTopic>> =>
      saved({ ...SURVEYING, name: "Leveling" }),
    ),
    moveTopicInSubject: vi.fn(async (): Promise<AdminActionState<string[]>> =>
      saved([SURVEYING.id, SIMPLE.id]),
    ),
    removeTopic: vi.fn(async (): Promise<AdminActionState<Topic>> =>
      saved({
        id: SURVEYING.id,
        examCode: "CE",
        subjectCode: "MSTC",
        name: "Surveying",
        position: 2,
      }),
    ),
    ...actions,
  };
  const user = userEvent.setup();
  render(<TopicsEditor list={list} actions={all} />);
  return { user, ...all };
}

const topics = () => screen.getByRole("list", { name: "MSTC Topics" });
const row = (name: string) =>
  within(topics())
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("heading", { name })) ??
  (() => {
    throw new Error(`No row for ${name}`);
  })();

describe("TopicsEditor", () => {
  beforeEach(() => {
    refresh.mockClear();
    toast.mockClear();
  });

  it("lists the Subject's Topics in order, each with what it holds", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "CE · MSTC · TOPICS" })).toBeInTheDocument();
    expect(
      within(topics())
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Simple Curves", "Surveying"]);
    expect(
      within(screen.getByRole("list", { name: "What Simple Curves holds" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["DECK · VISIBLE", "QUIZ · HIDDEN", "REVIEWER PDF · DRAFT"]);
    expect(screen.getByRole("list", { name: "What Surveying holds" })).toHaveTextContent("EMPTY");
  });

  it("opens each Topic's deck in the card editor from “Flashcards”", () => {
    renderEditor();

    expect(screen.getByRole("link", { name: "Flashcards in Surveying" })).toHaveAttribute(
      "href",
      `/admin/content/deck?topic=${SURVEYING.id}`,
    );
  });

  it("opens the Subject's card import from “Import cards”", () => {
    renderEditor();

    expect(screen.getByRole("link", { name: "Import cards" })).toHaveAttribute(
      "href",
      `/admin/content/import?exam=${LIST.exam.code.toLowerCase()}&subject=${LIST.subject.code.toLowerCase()}`,
    );
  });

  it("shows why a Topic with content can't be deleted, in place of its Delete button", () => {
    renderEditor();

    expect(
      within(row("Simple Curves")).queryByRole("button", { name: /Delete/ }),
    ).not.toBeInTheDocument();
    expect(
      within(row("Simple Curves")).getByText(
        "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
      ),
    ).toBeInTheDocument();
    expect(
      within(row("Surveying")).getByRole("button", { name: "Delete Surveying" }),
    ).toBeInTheDocument();
  });

  it("deletes an empty Topic after asking, then reads the list again", async () => {
    const { user, removeTopic } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Delete Surveying" }));
    const dialog = screen.getByRole("dialog", { name: "Delete “Surveying” from MSTC?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete topic" }));

    expect(removeTopic).toHaveBeenCalledWith({ status: "idle" }, { input: { id: SURVEYING.id } });
    expect(toast).toHaveBeenCalledWith("✓ DELETED · SURVEYING");
    expect(refresh).toHaveBeenCalled();
  });

  it("says why the server refused a delete, in the dialog", async () => {
    const { user } = renderEditor(LIST, {
      removeTopic: vi.fn(async (): Promise<AdminActionState<Topic>> => ({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "It has a quiz. Only an empty Topic can be deleted.",
        },
      })),
    });

    await user.click(screen.getByRole("button", { name: "Delete Surveying" }));
    await user.click(screen.getByRole("button", { name: "Delete topic" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "It has a quiz. Only an empty Topic can be deleted.",
    );
  });

  it("adds a Topic by name, then clears the field and reads the list again", async () => {
    const { user, addTopic } = renderEditor();

    await user.type(screen.getByLabelText("NEW TOPIC"), "Highways");
    await user.click(screen.getByRole("button", { name: "+ Add topic" }));

    expect(addTopic).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { exam: "CE", subject: "MSTC", name: "Highways" } },
    );
    expect(toast).toHaveBeenCalledWith("✓ ADDED · HIGHWAYS");
    expect(screen.getByLabelText("NEW TOPIC")).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a refused name under the field, keeping what was typed", async () => {
    const { user } = renderEditor(LIST, {
      addTopic: vi.fn(async (): Promise<AdminActionState<AdminTopic>> => ({
        status: "refused",
        error: {
          kind: "invalid",
          fieldErrors: { name: ["MSTC ALREADY HAS A TOPIC CALLED “surveying”"] },
        },
      })),
    });

    await user.type(screen.getByLabelText("NEW TOPIC"), "surveying");
    await user.click(screen.getByRole("button", { name: "+ Add topic" }));

    expect(screen.getByText("MSTC ALREADY HAS A TOPIC CALLED “surveying”")).toBeInTheDocument();
    expect(screen.getByLabelText("NEW TOPIC")).toHaveValue("surveying");
    expect(screen.getByLabelText("NEW TOPIC")).toHaveAttribute("aria-invalid", "true");
  });

  it("renames a Topic with the stamp it opened with", async () => {
    const { user, saveTopicName } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Rename Surveying" }));
    const field = within(row("Surveying")).getByLabelText("NAME");
    await user.clear(field);
    await user.type(field, "Leveling");
    await user.click(within(row("Surveying")).getByRole("button", { name: "Save name" }));

    expect(saveTopicName).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: SURVEYING.id, name: "Leveling" }, expected: { savedAt: OPENED.savedAt } },
    );
    expect(toast).toHaveBeenCalledWith("✓ RENAMED · LEVELING");
    expect(refresh).toHaveBeenCalled();
  });

  it("says who saved first when a rename conflicts", async () => {
    const { user } = renderEditor(LIST, {
      saveTopicName: vi.fn(async (): Promise<AdminActionState<AdminTopic>> => ({
        status: "refused",
        error: {
          kind: "conflict",
          savedBy: "AYC Content Team",
          savedAt: "2026-11-17T03:50:00.000Z",
        },
      })),
    });

    await user.click(screen.getByRole("button", { name: "Rename Surveying" }));
    await user.click(within(row("Surveying")).getByRole("button", { name: "Save name" }));

    expect(screen.getByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
    expect(screen.getByRole("alert")).toHaveTextContent(/AYC Content Team saved this Topic’s name/);
  });

  it("disables ▲ on the first Topic and ▼ on the last, and moves the rest", async () => {
    const { user, moveTopicInSubject } = renderEditor();

    expect(screen.getByRole("button", { name: "Move up: Simple Curves" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: Surveying" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move up: Surveying" }));

    expect(moveTopicInSubject).toHaveBeenCalledWith(
      { status: "idle" },
      { input: { id: SURVEYING.id, direction: "up" } },
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("says so when the Subject has no Topics yet", () => {
    renderEditor({ ...LIST, topics: [] });
    expect(screen.getByText("No Topics in MSTC yet. Add the first one below.")).toBeInTheDocument();
  });
});

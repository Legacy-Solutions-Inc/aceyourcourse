import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { AdminCard, AdminDeck, AdminDeckSettings, DeletedCard } from "@/services/admin.types";

import { ADD_A_CARD_FIRST, DeckEditor, type DeckEditorActions, NOW_HIDDEN } from "./deck-editor";

// A Topic's deck in Member App content (stories 125, 127, 128): its state,
// its two switches, the cards in order with ▲▼ and Delete, and the card form.
// The Server Actions are the boundary, so they're replaced; the screen shows
// what each one answers and reads the deck again.
const { refresh, replace, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast }));

const TOPIC = "11111111-1111-4111-8111-111111111111";
const DECK = "44444444-4444-4444-8444-444444444444";
const OPENED = { savedAt: "2026-11-18T01:00:00.000Z", savedBy: null };

const card = (position: number, front: string): AdminCard => ({
  id: `5555555${position}-5555-4555-8555-555555555555`,
  position,
  front,
  back: "$x^2$",
  note: null,
  image: null,
  stamp: OPENED,
});

function deckWith(
  cards: AdminCard[],
  settings: AdminDeckSettings | null = { id: DECK, visibility: "hidden", freePreview: false },
): AdminDeck {
  return {
    exam: { code: "CE", name: "Civil Engineering" },
    subject: { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
    topic: { id: TOPIC, name: "Simple Curves", position: 1 },
    deck: settings,
    cards,
  };
}

const saved = <T,>(value: T): AdminActionState<T> => ({ status: "saved", value });

function renderDeck(
  deck: AdminDeck,
  selected: string | null = null,
  overrides: Partial<DeckEditorActions> = {},
) {
  const actions = {
    createCardImageUpload: vi.fn(),
    addCard: vi.fn(),
    saveCard: vi.fn(),
    moveCardInDeck: vi.fn(async () => saved(deck.cards.map((c) => c.id).reverse())),
    removeCard: vi.fn(async (): Promise<AdminActionState<DeletedCard>> =>
      saved({
        card: { ...card(1, "A"), deckId: DECK },
        deckHidden: false,
      }),
    ),
    saveDeckVisibility: vi.fn(async () =>
      saved({ id: DECK, visibility: "visible" as const, freePreview: false }),
    ),
    saveDeckFreePreview: vi.fn(async () =>
      saved({ id: DECK, visibility: "hidden" as const, freePreview: true }),
    ),
    ...overrides,
  };
  render(
    <DeckEditor
      deck={deck}
      selected={selected}
      watermark="content@aceyourcourse.ph"
      actions={actions as unknown as DeckEditorActions}
    />,
  );
  return { actions, user: userEvent.setup() };
}

beforeEach(() => {
  refresh.mockClear();
  replace.mockClear();
  toast.mockClear();
});

describe("the deck screen", () => {
  it("shows the deck's state, its card count and its cards in order", () => {
    renderDeck(
      deckWith([card(1, "Degree of curve"), card(2, "Tangent distance")], {
        id: DECK,
        visibility: "visible",
        freePreview: true,
      }),
    );

    expect(screen.getByRole("heading", { name: "Simple Curves flashcards" })).toBeVisible();
    expect(screen.getByText("CE · MSTC · 2 CARDS · VISIBLE · FREE PREVIEW")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Visible to members" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Free Preview" })).toBeChecked();
    const list = screen.getByRole("list", { name: "Cards in Simple Curves" });
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Degree of curve", "Tangent distance"]);
    expect(
      within(list).getByRole("link", { name: "Edit card 2: Tangent distance" }),
    ).toHaveAttribute("href", `/admin/content/deck?topic=${TOPIC}&card=${card(2, "").id}`);
    expect(screen.getByRole("form", { name: "New card" })).toBeInTheDocument();
  });

  it("won't make an empty deck Visible, saying to add a card first", () => {
    renderDeck(deckWith([]));

    const visible = screen.getByRole("switch", { name: "Visible to members" });
    expect(visible).toBeDisabled();
    expect(visible).toHaveAccessibleDescription(ADD_A_CARD_FIRST);
    expect(screen.getByText("No cards yet. Write the first one in the form.")).toBeInTheDocument();
  });

  it("keeps both switches off until a Topic with no deck gets its first card", () => {
    renderDeck(deckWith([], null));

    expect(screen.getByText("CE · MSTC · 0 CARDS · HIDDEN")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Visible to members" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Free Preview" })).toBeDisabled();
  });

  it("makes a deck with cards Visible and Free Preview, then reads it again", async () => {
    const { actions, user } = renderDeck(deckWith([card(1, "A")]));

    await user.click(screen.getByRole("switch", { name: "Visible to members" }));
    await user.click(screen.getByRole("switch", { name: "Free Preview" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(actions.saveDeckVisibility).toHaveBeenCalledWith(expect.anything(), {
      input: { deck: DECK, visible: true },
    });
    expect(actions.saveDeckFreePreview).toHaveBeenCalledWith(expect.anything(), {
      input: { deck: DECK, freePreview: true },
    });
  });

  it("says why the server refused a switch", async () => {
    const { user } = renderDeck(deckWith([card(1, "A")]), null, {
      saveDeckVisibility: vi.fn(async () => ({
        status: "refused" as const,
        error: { kind: "invalid" as const, fieldErrors: {}, formError: "ADD A CARD FIRST" },
      })),
    });
    await user.click(screen.getByRole("switch", { name: "Visible to members" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("ADD A CARD FIRST"));
  });

  it("moves a card with ▲▼", async () => {
    const { actions, user } = renderDeck(deckWith([card(1, "A"), card(2, "B")]));
    await user.click(screen.getByRole("button", { name: "Move up: card 2" }));

    await waitFor(() =>
      expect(actions.moveCardInDeck).toHaveBeenCalledWith(expect.anything(), {
        input: { id: card(2, "").id, direction: "up" },
      }),
    );
    expect(screen.getByRole("button", { name: "Move up: card 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: card 2" })).toBeDisabled();
  });

  it("deletes a card after warning that Members lose their marks on it", async () => {
    const { actions, user } = renderDeck(deckWith([card(1, "A"), card(2, "B")]));
    await user.click(screen.getByRole("button", { name: "Delete card 1" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Members who marked it lose that mark.");
    await user.click(within(dialog).getByRole("button", { name: "Delete card" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(actions.removeCard).toHaveBeenCalledWith(expect.anything(), {
      input: { id: card(1, "").id },
    });
    expect(toast).toHaveBeenCalledWith("✓ DELETED · CARD 1");
    expect(screen.queryByText(NOW_HIDDEN)).toBeNull();
  });

  it("says the deck is now Hidden when its last card goes", async () => {
    const only = card(1, "Only");
    const { user } = renderDeck(
      deckWith([only], { id: DECK, visibility: "visible", freePreview: false }),
      only.id,
      {
        removeCard: vi.fn(async () => saved({ card: { ...only, deckId: DECK }, deckHidden: true })),
      },
    );
    await user.click(screen.getByRole("button", { name: "Delete card 1" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete card" }),
    );

    expect(await screen.findByText(NOW_HIDDEN)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(NOW_HIDDEN);
    // The card open in the form is gone, so a new card's form opens.
    expect(replace).toHaveBeenCalledWith(`/admin/content/deck?topic=${TOPIC}&card=new`);
  });

  it("keeps a new card's form, cleared and saying so, after “Save & add next”", async () => {
    const { actions, user } = renderDeck(deckWith([card(1, "A")]), null, {
      addCard: vi.fn(async () => saved(card(2, "B"))),
    });
    const form = screen.getByRole("form", { name: "New card" });
    await user.type(within(form).getByLabelText(/^FRONT/), "B");
    await user.type(within(form).getByLabelText(/^BACK/), "Bee");
    await user.click(within(form).getByRole("button", { name: "Save & add next" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(actions.addCard).toHaveBeenCalled();
    expect(within(form).getByRole("status")).toHaveTextContent(
      "✓ SAVED CARD 2 · WRITING THE NEXT ONE",
    );
    expect(within(form).getByLabelText(/^FRONT/)).toHaveValue("");
    expect(within(form).getByLabelText(/^FRONT/)).toHaveFocus();
    // Already a new card's form: the address stays as it is.
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens a new card's form after “Save & add next” on an edited card", async () => {
    const first = card(1, "A");
    const { user } = renderDeck(deckWith([first]), first.id, {
      saveCard: vi.fn(async () => saved(first)),
    });
    await user.click(screen.getByRole("button", { name: "Save & add next" }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/admin/content/deck?topic=${TOPIC}&card=new`),
    );
  });

  it("opens the saved card after “Save” on a new card", async () => {
    const { user } = renderDeck(deckWith([]), null, {
      addCard: vi.fn(async () => saved(card(1, "A"))),
    });
    await user.type(screen.getByLabelText(/^FRONT/), "A");
    await user.type(screen.getByLabelText(/^BACK/), "Aye");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/admin/content/deck?topic=${TOPIC}&card=${card(1, "").id}`,
      ),
    );
  });

  it("opens the selected card in the form, marked in the list", () => {
    const second = card(2, "B");
    renderDeck(deckWith([card(1, "A"), second]), second.id);

    expect(screen.getByRole("form", { name: "Card 2" })).toBeInTheDocument();
    const current = within(screen.getByRole("list", { name: "Cards in Simple Curves" }))
      .getAllByRole("listitem")
      .find((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveTextContent("B");
  });
});

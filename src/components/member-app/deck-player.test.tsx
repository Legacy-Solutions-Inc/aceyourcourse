import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudyActionState } from "@/app/app/(shell)/library/actions";
import type { StudyCard } from "@/services/member.types";

import { DeckPlayer, type DeckPlayerProps } from "./deck-player";

// The flashcard player (stories 95–97 and 106; mockups `flashcards` and
// `deckDone`): one card at a time, flipped with a tap or space, marked with
// a swipe, the arrow keys or the buttons, then the summary and "Review the
// N". The Server Actions are the boundary, so they're replaced: each mark is
// sent with where the Member is in the deck afterwards.
const { refresh, toast } = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: Object.assign(toast, { error: toast }) }));

// jsdom has no pointer events: a mouse event with a pointer id stands in.
beforeAll(() => {
  if (!("PointerEvent" in window)) {
    class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.assign(window, { PointerEvent });
  }
  Element.prototype.setPointerCapture ??= () => {};
});

const DECK = "44444444-4444-4444-8444-444444444444";
const id = (n: number) => `5555555${n}-5555-4555-8555-555555555555`;
const card = (
  n: number,
  front: string,
  back: string,
  extra: Partial<StudyCard> = {},
): StudyCard => ({
  id: id(n),
  position: n,
  front,
  back,
  note: null,
  imageUrl: null,
  ...extra,
});
const CARDS = [
  card(1, "Degree of curve", "$D = \\dfrac{1145.916}{R}$", { note: "Arc basis" }),
  card(2, "Tangent distance", "$T = R \\tan(I/2)$", { imageUrl: "/api/dev/card-images/t2" }),
  card(3, "Long chord", "$C = 2R \\sin(I/2)$"),
];
const WATERMARK = "tester@example.com · 3F1A5C2E";
const SAVED: StudyActionState = { status: "saved" };

function renderPlayer(overrides: Partial<DeckPlayerProps> = {}) {
  const actions = {
    markCard: vi.fn(async (_input: unknown): Promise<StudyActionState> => SAVED),
    savePosition: vi.fn(async (_input: unknown): Promise<StudyActionState> => SAVED),
  };
  const props: DeckPlayerProps = {
    deckId: DECK,
    title: "Simple Curves",
    label: "MSTC · SIMPLE CURVES",
    cards: CARDS,
    marks: {},
    resumeAt: null,
    imagesExpireAt: null,
    watermark: WATERMARK,
    examCode: "CE",
    unlock: { kind: "plans", href: "/app/plans?exam=CE" },
    back: { href: "/app/library?subject=MSTC", label: "Back to MSTC topics" },
    actions,
    ...overrides,
  };
  const view = render(<DeckPlayer {...props} />);
  return { ...view, actions, props, user };
}

const front = () => screen.getByRole("figure", { name: "Card front" });
const back = () => screen.getByRole("figure", { name: "Card back" });
const stage = () => screen.getByTestId("card-stage");
let user: UserEvent;
/** Presses a key with nothing focused, as studying with the keyboard does. */
const press = (key: string) => user.keyboard(key === " " ? " " : `{${key}}`);

/** Drags across the card by `dx` pixels, as a finger or mouse would. */
function drag(dx: number) {
  const at = (clientX: number) => ({ target: stage(), coords: { clientX } });
  return user.pointer([
    { keys: "[MouseLeft>]", ...at(100) },
    at(100 + dx / 2),
    at(100 + dx),
    { keys: "[/MouseLeft]", ...at(100 + dx) },
  ]);
}
const tap = () => user.pointer({ keys: "[MouseLeft]", target: stage(), coords: { clientX: 100 } });

beforeEach(() => {
  refresh.mockClear();
  toast.mockClear();
  user = userEvent.setup();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the deck player", () => {
  it("shows the first card's front, with the deck's title and where the Member is", async () => {
    renderPlayer();

    expect(screen.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeVisible();
    expect(screen.getByText("CARD 1 / 3")).toBeInTheDocument();
    expect(front()).toHaveTextContent("Degree of curve");
    expect(front()).toHaveTextContent("MSTC · SIMPLE CURVES");
    expect(screen.queryByRole("figure", { name: "Card back" })).toBeNull();
  });

  it("tiles the Member's email and short Member ID over the card, as a picture, not text", async () => {
    renderPlayer();

    const mark = front().querySelector("[data-watermark]");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(decodeURIComponent((mark as HTMLElement).style.backgroundImage)).toContain(WATERMARK);
    expect(front()).not.toHaveTextContent("tester@example.com");
  });

  it("lets nothing on the cards be selected", async () => {
    renderPlayer();
    expect(screen.getByRole("region", { name: "Simple Curves flashcards" })).toHaveClass(
      "select-none",
    );
  });

  it("flips to the back with space: the formula rendered, the note and the image", async () => {
    renderPlayer({ cards: [CARDS[1] ?? CARDS[0]!, CARDS[0]!] });

    await press(" ");
    expect(back().querySelector(".katex")).not.toBeNull();
    expect(
      within(back()).getByRole("img", { name: "Image on the back of the card" }),
    ).toHaveAttribute("src", "/api/dev/card-images/t2");
    await press(" ");
    expect(front()).toHaveTextContent("Tangent distance");
  });

  it("shows the note on the back", async () => {
    renderPlayer();
    await press(" ");
    expect(back()).toHaveTextContent("Arc basis");
  });

  it("flips with a tap, and with the Flip card button", async () => {
    const { user } = renderPlayer();

    await tap();
    expect(back()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Flip card" }));
    expect(front()).toBeInTheDocument();
  });

  it("marks Got it with →, saving the mark and where the Member is now", async () => {
    const { actions } = renderPlayer();
    await press("ArrowRight");

    expect(front()).toHaveTextContent("Tangent distance");
    expect(screen.getByText("CARD 2 / 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(actions.markCard).toHaveBeenCalledWith({
        deckId: DECK,
        cardId: id(1),
        verdict: "got",
        position: { cardId: id(2) },
      }),
    );
  });

  it("marks Review again with ←", async () => {
    const { actions } = renderPlayer();
    await press("ArrowLeft");

    await waitFor(() =>
      expect(actions.markCard).toHaveBeenCalledWith(
        expect.objectContaining({ cardId: id(1), verdict: "again" }),
      ),
    );
  });

  it("leaves the keys alone with Ctrl, Alt or ⌘ held, or a key held down", async () => {
    const { actions } = renderPlayer();
    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await user.keyboard("{Meta>}{ArrowLeft}{/Meta}");
    // user-event can't send a lone repeat: the key held down after its first press.
    fireEvent.keyDown(window, { key: "ArrowRight", repeat: true });

    expect(front()).toHaveTextContent("Degree of curve");
    expect(actions.markCard).not.toHaveBeenCalled();
  });

  it("marks with the Got it and Review again buttons", async () => {
    const { actions, user } = renderPlayer();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(actions.markCard.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ cardId: id(1), verdict: "got" }),
      expect.objectContaining({ cardId: id(2), verdict: "again" }),
    ]);
  });

  it("swipes right for Got it and left for Review again", async () => {
    const { actions } = renderPlayer();
    await drag(140);
    await drag(-140);

    expect(front()).toHaveTextContent("Long chord");
    expect(actions.markCard.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ cardId: id(1), verdict: "got" }),
      expect.objectContaining({ cardId: id(2), verdict: "again" }),
    ]);
  });

  it("springs back from a short drag, marking nothing and not flipping", async () => {
    const { actions } = renderPlayer();
    await drag(60);

    expect(front()).toHaveTextContent("Degree of curve");
    expect(actions.markCard).not.toHaveBeenCalled();
  });

  it("moves with the ← and → buttons without marking, saving where the Member is", async () => {
    const { actions, user } = renderPlayer();
    expect(screen.getByRole("button", { name: "Previous card" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next card, without marking" }));
    expect(front()).toHaveTextContent("Tangent distance");
    await user.click(screen.getByRole("button", { name: "Previous card" }));
    expect(front()).toHaveTextContent("Degree of curve");

    expect(actions.markCard).not.toHaveBeenCalled();
    expect(actions.savePosition.mock.calls.map(([input]) => input)).toEqual([
      { deckId: DECK, cardId: id(2) },
      { deckId: DECK, cardId: id(1) },
    ]);
  });
});

describe("keys and focus", () => {
  it("leaves Space to a focused button that isn't one of the card's controls", async () => {
    renderPlayer();
    screen.getByRole("button", { name: "Finish deck →" }).focus();
    await user.keyboard(" ");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "0 of 3 got it · 0 to review again",
    );
  });

  it("flips with Space on a focused card control, such as Got it", async () => {
    renderPlayer();
    screen.getByRole("button", { name: "Got it" }).focus();
    await user.keyboard(" ");

    expect(back()).toBeInTheDocument();
  });

  it("ignores the keys while focus is outside the player, in the menu beside it", async () => {
    const { actions } = renderPlayer();
    const outside = document.body.appendChild(document.createElement("button"));
    outside.focus();
    await user.keyboard("{ArrowRight}");
    outside.remove();

    expect(front()).toHaveTextContent("Degree of curve");
    expect(actions.markCard).not.toHaveBeenCalled();
  });
});

describe("when an Editor deletes a card mid-session", () => {
  it("moves on to the next card once the deck is read again, and leaves it out of the summary", async () => {
    const { props, rerender } = renderPlayer();
    await press("ArrowLeft");
    expect(front()).toHaveTextContent("Tangent distance");

    // Read again (for fresh image URLs) without cards 1 and 2.
    rerender(<DeckPlayer {...props} cards={[CARDS[2]!]} />);
    expect(front()).toHaveTextContent("Long chord");
    expect(screen.getByText("CARD 1 / 1")).toBeInTheDocument();
    await press("ArrowRight");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "1 of 1 got it · 0 to review again",
    );
  });
});

describe("the summary", () => {
  it("counts the deck after the last card, and clears where the Member is", async () => {
    const { actions } = renderPlayer();
    await press("ArrowRight");
    await press("ArrowLeft");
    await press("ArrowRight");

    const summary = screen.getByRole("region", { name: /got it/ });
    expect(summary).toHaveTextContent("DECK FINISHED · SIMPLE CURVES");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "2 of 3 got it · 1 to review again",
    );
    expect(
      within(screen.getByRole("list", { name: "Cards to review again" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to MSTC topics" })).toHaveAttribute(
      "href",
      "/app/library?subject=MSTC",
    );
    await waitFor(() =>
      expect(actions.markCard).toHaveBeenLastCalledWith(
        expect.objectContaining({ cardId: id(3), position: { cardId: null } }),
      ),
    );
  });

  it("counts the Member's earlier marks on cards before where they continued", async () => {
    renderPlayer({ marks: { [id(1)]: "again", [id(2)]: "got" }, resumeAt: id(3) });
    await user.click(screen.getByRole("button", { name: "Continue at card 3" }));
    await press("ArrowRight");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "2 of 3 got it · 1 to review again",
    );
  });

  it("drills only the cards to review with “Review the N”, leaving the deck position alone", async () => {
    const { actions, user } = renderPlayer();
    await press("ArrowLeft");
    await press("ArrowRight");
    await press("ArrowLeft");
    actions.markCard.mockClear();

    await user.click(screen.getByRole("button", { name: "Review the 2" }));
    expect(screen.getByText("REVIEW · CARD 1 / 2")).toBeInTheDocument();
    expect(front()).toHaveTextContent("Degree of curve");
    await press("ArrowRight");
    expect(front()).toHaveTextContent("Long chord");
    await press("ArrowLeft");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "1 of 2 got it · 1 to review again",
    );
    expect(screen.getByText("REVIEW FINISHED · SIMPLE CURVES")).toBeInTheDocument();
    expect(actions.markCard.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ cardId: id(1), verdict: "got", position: null }),
      expect.objectContaining({ cardId: id(3), verdict: "again", position: null }),
    ]);
    expect(actions.savePosition).not.toHaveBeenCalled();
  });

  it("offers no review when every card was got", async () => {
    renderPlayer();
    for (const _ of CARDS) await press("ArrowRight");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "3 of 3 got it · 0 to review again",
    );
    expect(screen.queryByRole("button", { name: /^Review the/ })).toBeNull();
  });

  it("finishes early with “Finish deck”", async () => {
    const { actions, user } = renderPlayer();
    await press("ArrowRight");
    await user.click(screen.getByRole("button", { name: "Finish deck →" }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "1 of 3 got it · 0 to review again",
    );
    expect(actions.savePosition).toHaveBeenLastCalledWith({ deckId: DECK, cardId: null });
  });

  it("ignores the keys at the summary", async () => {
    const { actions } = renderPlayer({ cards: [CARDS[0]!] });
    await press("ArrowRight");
    await press("ArrowRight");
    await press(" ");

    expect(actions.markCard).toHaveBeenCalledTimes(1);
  });
});

describe("resuming", () => {
  it("offers to continue at the card the Member left the deck at", async () => {
    const { user } = renderPlayer({ resumeAt: id(2) });

    expect(
      screen.getByRole("heading", { level: 2, name: "You stopped at card 2 of 3" }),
    ).toBeVisible();
    expect(screen.queryByRole("figure")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue at card 2" }));

    expect(front()).toHaveTextContent("Tangent distance");
    expect(screen.getByText("CARD 2 / 3")).toBeInTheDocument();
  });

  it("starts from card 1 instead, saving that", async () => {
    const { actions, user } = renderPlayer({ resumeAt: id(2) });
    await user.click(screen.getByRole("button", { name: "Start from card 1" }));

    expect(front()).toHaveTextContent("Degree of curve");
    expect(actions.savePosition).toHaveBeenCalledWith({ deckId: DECK, cardId: id(1) });
  });

  it("ignores the keys until the Member picks", async () => {
    const { actions } = renderPlayer({ resumeAt: id(2) });
    await press("ArrowRight");
    expect(actions.markCard).not.toHaveBeenCalled();
  });

  it("opens straight at the first card when that's where the Member left it", async () => {
    renderPlayer({ resumeAt: id(1) });
    expect(front()).toHaveTextContent("Degree of curve");
  });
});

describe("when a save doesn't go through", () => {
  it("shows “no longer available” in place of the cards once the deck is hidden", async () => {
    const { actions } = renderPlayer();
    actions.markCard.mockResolvedValueOnce({
      status: "refused",
      decision: { outcome: "unavailable" },
    });
    await press("ArrowRight");

    expect(
      await screen.findByRole("heading", { level: 2, name: "No longer available" }),
    ).toBeVisible();
    expect(screen.getByText("This is no longer available. Your progress is kept.")).toBeVisible();
    expect(screen.queryByRole("figure")).toBeNull();
    await press("ArrowRight");
    expect(actions.markCard).toHaveBeenCalledTimes(1);
  });

  it("says renew when the pass ended mid-deck, keeping the marks", async () => {
    const { actions } = renderPlayer();
    actions.markCard.mockResolvedValueOnce({
      status: "refused",
      decision: { outcome: "expired", passEndedAt: "2026-11-14T03:42:00.000Z" },
    });
    await press("ArrowRight");

    expect(
      await screen.findByRole("heading", { name: "Your CE All-Access ended on 14 Nov 2026" }),
    ).toBeVisible();
    expect(screen.getByText(/Renew to keep reviewing\. Your progress is kept\./)).toBeVisible();
    expect(screen.getByRole("link", { name: "Renew access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
  });

  it("says so when a card was removed", async () => {
    const { actions } = renderPlayer();
    actions.markCard.mockResolvedValueOnce({ status: "not-found" });
    await press("ArrowRight");

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("That card was just removed from the deck."),
    );
    expect(front()).toHaveTextContent("Tangent distance");
  });

  it("says so when the connection drops", async () => {
    const { actions } = renderPlayer();
    actions.markCard.mockRejectedValueOnce(new Error("Failed to fetch"));
    await press("ArrowRight");

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Couldn’t save that. Check your connection."),
    );
  });
});

describe("card images", () => {
  it("reads the deck again a minute before its image URLs stop working", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-17T03:42:00.000Z"));
    renderPlayer({ imagesExpireAt: "2026-11-17T03:52:00.000Z" });

    vi.advanceTimersByTime(9 * 60 * 1000 - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't read the deck again when no card has an image", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    renderPlayer();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(refresh).not.toHaveBeenCalled();
  });
});

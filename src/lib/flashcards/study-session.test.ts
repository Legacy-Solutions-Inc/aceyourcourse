import { describe, expect, it } from "vitest";

import {
  currentCard,
  finish,
  flip,
  keepCards,
  mark,
  move,
  positionToSave,
  reviewSession,
  startSession,
  summaryOf,
  tickOf,
} from "./study-session";

// A Member's pass through a deck (stories 95 and 97; mockups `flashcards` and
// `deckDone`): one card at a time, flipped and marked Got it or Review again,
// then the summary and "Review the N". The cards are a, b, c and d, in deck
// order.
const DECK = ["a", "b", "c", "d"];
const fresh = () => startSession({ cardIds: DECK, marks: {}, scope: "deck" });

describe("startSession", () => {
  it("starts at the first card, front up", () => {
    const session = fresh();
    expect(currentCard(session)).toBe("a");
    expect(session.flipped).toBe(false);
    expect(session.finished).toBe(false);
  });

  it("starts at the card a Member continues from", () => {
    const session = startSession({ cardIds: DECK, marks: {}, scope: "deck", startAt: "c" });
    expect(currentCard(session)).toBe("c");
    expect(session.index).toBe(2);
  });

  it("starts at the first card when the card to continue from has gone", () => {
    const session = startSession({ cardIds: DECK, marks: {}, scope: "deck", startAt: "zz" });
    expect(currentCard(session)).toBe("a");
  });

  it("drops stored marks on cards that aren't in the session", () => {
    const session = startSession({
      cardIds: DECK,
      marks: { a: "got", gone: "again" },
      scope: "deck",
    });
    expect(session.marks).toEqual({ a: "got" });
  });
});

describe("flip", () => {
  it("turns the card over and back", () => {
    const once = flip(fresh());
    expect(once.flipped).toBe(true);
    expect(flip(once).flipped).toBe(false);
  });
});

describe("mark", () => {
  it("records the verdict on the current card and moves to the next, front up", () => {
    const session = mark(flip(fresh()), "got");
    expect(session.marks).toEqual({ a: "got" });
    expect(currentCard(session)).toBe("b");
    expect(session.flipped).toBe(false);
  });

  it("finishes the session on the last card", () => {
    let session = fresh();
    for (const verdict of ["got", "again", "got", "again"] as const) {
      session = mark(session, verdict);
    }
    expect(session.finished).toBe(true);
    expect(session.marks).toEqual({ a: "got", b: "again", c: "got", d: "again" });
    expect(currentCard(session)).toBeNull();
  });

  it("keeps only the latest verdict on a card marked again", () => {
    const back = move(mark(fresh(), "again"), -1);
    expect(mark(back, "got").marks).toEqual({ a: "got" });
  });

  it("changes nothing once the session is finished", () => {
    const done = finish(fresh());
    expect(mark(done, "got")).toEqual(done);
  });
});

describe("move", () => {
  it("goes back and forward without marking", () => {
    const forward = move(fresh(), 1);
    expect(currentCard(forward)).toBe("b");
    expect(forward.marks).toEqual({});
    expect(currentCard(move(forward, -1))).toBe("a");
  });

  it("stays on the first card going back, front up", () => {
    const session = move(flip(fresh()), -1);
    expect(currentCard(session)).toBe("a");
    expect(session.flipped).toBe(false);
  });

  it("finishes going forward from the last card", () => {
    const last = startSession({ cardIds: DECK, marks: {}, scope: "deck", startAt: "d" });
    expect(move(last, 1).finished).toBe(true);
  });
});

describe("the summary", () => {
  it("counts the Member's latest marks over the whole deck, stored ones too", () => {
    // Continued at c: a and b were marked in an earlier session.
    let session = startSession({
      cardIds: DECK,
      marks: { a: "got", b: "again" },
      scope: "deck",
      startAt: "c",
    });
    session = mark(mark(session, "got"), "got");

    expect(summaryOf(session)).toEqual({ total: 4, got: 3, again: 1, toReview: ["b"] });
  });

  it("leaves cards skipped without a mark out of both counts", () => {
    const session = finish(mark(move(mark(fresh(), "again"), 1), "got"));
    expect(summaryOf(session)).toEqual({ total: 4, got: 1, again: 1, toReview: ["a"] });
  });

  it("lists the cards to review in deck order", () => {
    let session = fresh();
    for (const verdict of ["again", "got", "again", "again"] as const) {
      session = mark(session, verdict);
    }
    expect(summaryOf(session).toReview).toEqual(["a", "c", "d"]);
  });
});

describe("reviewSession", () => {
  it("drills only the cards to review, from the first, keeping the marks", () => {
    let session = fresh();
    for (const verdict of ["again", "got", "again", "got"] as const) {
      session = mark(session, verdict);
    }
    const review = reviewSession(session);

    expect(review.scope).toBe("review");
    expect(review.cardIds).toEqual(["a", "c"]);
    expect(currentCard(review)).toBe("a");
    expect(review.finished).toBe(false);
    expect(review.marks).toEqual({ a: "again", c: "again" });
  });

  it("counts a review over its own cards", () => {
    let session = fresh();
    for (const verdict of ["again", "got", "again", "again"] as const) {
      session = mark(session, verdict);
    }
    const reviewed = mark(mark(mark(reviewSession(session), "got"), "again"), "got");

    expect(reviewed.finished).toBe(true);
    expect(summaryOf(reviewed)).toEqual({ total: 3, got: 2, again: 1, toReview: ["c"] });
    expect(reviewSession(reviewed).cardIds).toEqual(["c"]);
  });
});

describe("positionToSave", () => {
  it("is the card a deck session is on", () => {
    expect(positionToSave(move(fresh(), 1))).toEqual({ cardId: "b" });
  });

  it("is cleared once the deck is finished, so it opens at the start", () => {
    expect(positionToSave(finish(fresh()))).toEqual({ cardId: null });
  });

  it("is left alone while reviewing", () => {
    const review = reviewSession(mark(fresh(), "again"));
    expect(positionToSave(review)).toBeNull();
    expect(positionToSave(finish(review))).toBeNull();
  });
});

describe("keepCards", () => {
  it("drops cards removed from the deck, staying on the current card", () => {
    const onC = move(move(fresh(), 1), 1);
    const kept = keepCards(flip(onC), ["a", "c", "d"]);

    expect(kept.cardIds).toEqual(["a", "c", "d"]);
    expect(currentCard(kept)).toBe("c");
    expect(kept.flipped).toBe(true);
  });

  it("moves on to the next card, front up, when the current one is removed", () => {
    const kept = keepCards(flip(move(fresh(), 1)), ["a", "c", "d"]);
    expect(currentCard(kept)).toBe("c");
    expect(kept.flipped).toBe(false);
  });

  it("finishes when the last card is removed while it's showing", () => {
    const onD = startSession({ cardIds: DECK, marks: {}, scope: "deck", startAt: "d" });
    expect(keepCards(onD, ["a", "b", "c"]).finished).toBe(true);
  });

  it("drops a removed card's mark, so the summary counts what's in the deck", () => {
    const marked = mark(mark(fresh(), "again"), "got");
    expect(summaryOf(keepCards(marked, ["b", "c", "d"]))).toEqual({
      total: 3,
      got: 1,
      again: 0,
      toReview: [],
    });
  });

  it("gives the same session back when nothing was removed", () => {
    const session = move(fresh(), 1);
    expect(keepCards(session, [...DECK, "e"])).toBe(session);
  });
});

describe("tickOf", () => {
  it("shows the current card, then each card's latest mark", () => {
    const session = mark(mark(fresh(), "got"), "again");
    expect(DECK.map((id) => tickOf(session, id))).toEqual(["got", "again", "current", "none"]);
  });
});

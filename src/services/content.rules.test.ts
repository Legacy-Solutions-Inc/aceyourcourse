import { describe, expect, it } from "vitest";

import { visibilityAfterRemoval, visibilityRefusal } from "./content.rules";

// A deck's or quiz's visibility (spec, Phase 3 → Content model; story 127):
// Visible is refused while it's empty, and removing its last item makes a
// Visible one Hidden, so Members never see empty content. The card editor
// (ticket 07) applies it to decks, and the question editor (ticket 10) to
// quizzes.

describe("visibilityRefusal", () => {
  it("refuses making an empty deck or quiz Visible, with what to add", () => {
    expect(visibilityRefusal("visible", 0, "card")).toBe("ADD A CARD FIRST");
    expect(visibilityRefusal("visible", 0, "question")).toBe("ADD A QUESTION FIRST");
  });

  it("allows Visible with one item or more, and Hidden whatever it holds", () => {
    expect(visibilityRefusal("visible", 1, "card")).toBeNull();
    expect(visibilityRefusal("hidden", 0, "card")).toBeNull();
    expect(visibilityRefusal("hidden", 5, "question")).toBeNull();
  });
});

describe("visibilityAfterRemoval", () => {
  it("makes a Visible deck with nothing left Hidden, and says so", () => {
    expect(visibilityAfterRemoval("visible", 0)).toEqual({ visibility: "hidden", hidden: true });
  });

  it("leaves it as it was while anything is left, or when it was Hidden", () => {
    expect(visibilityAfterRemoval("visible", 1)).toEqual({ visibility: "visible", hidden: false });
    expect(visibilityAfterRemoval("hidden", 0)).toEqual({ visibility: "hidden", hidden: false });
  });
});

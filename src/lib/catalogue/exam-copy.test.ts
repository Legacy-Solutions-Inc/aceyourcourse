import { describe, expect, it } from "vitest";

import { testExam } from "../../../test/fixtures/catalogue";
import { examSeoDescription, examSeoTitle } from "./exam-copy";

// The Exam page's search-result title and description. Visitors search by
// board acronym ("CELE reviewer"), so the title leads with it. The root
// layout's template adds " · Ace Your Course", and the whole title must stay
// within 60 characters.

const BRAND = " · Ace Your Course";

describe("examSeoTitle", () => {
  it('reads "{board} Reviewer · {name}"', () => {
    expect(examSeoTitle(testExam())).toBe("CELE Reviewer · Civil Engineering");
  });

  it("drops the name when the whole title would pass 60 characters", () => {
    const exam = testExam({ board: "LET", name: "Licensure Examination for Teachers" });
    expect(examSeoTitle(exam)).toBe("LET Reviewer");
    expect(`${examSeoTitle(exam)}${BRAND}`.length).toBeLessThanOrEqual(60);
  });
});

describe("examSeoDescription", () => {
  it("is the blurb when it fits in 160 characters", () => {
    expect(examSeoDescription(testExam({ blurb: "Flash cards for all six CPALE subjects." }))).toBe(
      "Flash cards for all six CPALE subjects.",
    );
  });

  it("keeps the blurb's whole sentences that fit in 160 characters", () => {
    const blurb =
      "Three subjects, four formats. Our CE line started it all and it’s still our best seller. Start with the cards, add the notebook and posters, or get everything in one bundle.";
    expect(blurb.length).toBeGreaterThan(160);
    expect(examSeoDescription(testExam({ blurb }))).toBe(
      "Three subjects, four formats. Our CE line started it all and it’s still our best seller.",
    );
  });

  it("cuts a first sentence longer than 160 characters at a word, with an ellipsis", () => {
    // The short second sentence would fit after the cut, but never follows an ellipsis.
    const blurb = `${"Formula cards ".repeat(15).trim()}. Ok.`;
    const description = examSeoDescription(testExam({ blurb }));
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/^Formula cards Formula .*cards…$/);
  });
});

import { describe, expect, it } from "vitest";

import { codeParam, topicContentLabels } from "./topics-view";

describe("topicContentLabels", () => {
  it("says EMPTY for a Topic with nothing in it", () => {
    expect(topicContentLabels({ deck: null, quiz: null, reviewerPdf: null })).toEqual(["EMPTY"]);
  });

  it("names each kind it holds with its visibility or status, in deck, quiz, Reviewer PDF order", () => {
    expect(topicContentLabels({ deck: "visible", quiz: "hidden", reviewerPdf: "draft" })).toEqual([
      "DECK · VISIBLE",
      "QUIZ · HIDDEN",
      "REVIEWER PDF · DRAFT",
    ]);
    expect(topicContentLabels({ deck: null, quiz: null, reviewerPdf: "published" })).toEqual([
      "REVIEWER PDF · PUBLISHED",
    ]);
  });
});

describe("codeParam", () => {
  it("reads a code from the address as saved", () => {
    expect(codeParam(" mstc ")).toBe("MSTC");
    expect(codeParam("math  and   science")).toBe("MATH AND SCIENCE");
  });

  it("reads nothing from a missing or repeated parameter", () => {
    expect(codeParam(undefined)).toBeUndefined();
    expect(codeParam(["ce", "me"])).toBeUndefined();
  });
});

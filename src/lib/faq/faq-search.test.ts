import { describe, expect, it } from "vitest";

import { testFaqGroups } from "../../../test/fixtures/catalogue";
import { filterFaqs } from "./faq-search";

const slugs = (groups: { items: { slug: string }[] }[]) =>
  groups.map((group) => group.items.map((faq) => faq.slug));

describe("filterFaqs", () => {
  it("returns every group unchanged for an empty or blank search", () => {
    const groups = testFaqGroups();
    expect(filterFaqs(groups, "")).toEqual(groups);
    expect(filterFaqs(groups, "   ")).toEqual(groups);
  });

  it("matches the question or the answer, ignoring case and surrounding spaces", () => {
    const groups = testFaqGroups();
    // "Iloilo" is in one shipping answer and the authenticity answer.
    expect(slugs(filterFaqs(groups, "  iLoIlO "))).toEqual([["ship"], ["original"]]);
    // "track" is only in a question.
    expect(slugs(filterFaqs(groups, "TRACK"))).toEqual([["tracking"]]);
  });

  it("keeps each matching group's title and the FAQs' order", () => {
    const [shipping] = filterFaqs(testFaqGroups(), "order");
    expect(shipping).toMatchObject({ group: "shipping", title: "Shipping" });
    expect(shipping?.items.map((faq) => faq.slug)).toEqual(["ship", "tracking"]);
  });

  it("drops every group with no match, and returns none for a search nothing matches", () => {
    expect(slugs(filterFaqs(testFaqGroups(), "posters"))).toEqual([["posters"]]);
    expect(filterFaqs(testFaqGroups(), "zzzz")).toEqual([]);
  });

  it("doesn't search a Review quote, which isn't the answer", () => {
    expect(filterFaqs(testFaqGroups(), "Readable fonts")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { metadata as rootMetadata } from "./not-found";
import { metadata as websiteMetadata } from "./(website)/not-found";

// Both 404 pages name themselves, so a tab or a shared link doesn't read as
// just the site name. The root layout's template adds " · Ace Your Course".
describe("the 404 pages' title", () => {
  it.each([
    ["an unmatched address", rootMetadata],
    ["a Website page's notFound()", websiteMetadata],
  ])("%s says the page wasn't found", (_page, metadata) => {
    expect(metadata.title).toBe("Page not found");
  });
});

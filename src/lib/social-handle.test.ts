import { describe, expect, it } from "vitest";

import { socialHandle } from "./social-handle";

describe("socialHandle", () => {
  it.each([
    ["https://www.tiktok.com/@aceyourcourse", "@aceyourcourse"],
    ["https://www.facebook.com/aceyourcourseph", "@aceyourcourseph"],
    ["https://www.instagram.com/aceyourcourseph/", "@aceyourcourseph"],
    ["https://www.facebook.com/pages/aceyourcourseph?ref=bookmarks", "@aceyourcourseph"],
  ])("reads the handle from %s", (url, handle) => {
    expect(socialHandle(url)).toBe(handle);
  });

  it("returns null for a profile URL with no path", () => {
    expect(socialHandle("https://www.tiktok.com/")).toBeNull();
  });

  it("returns null for a string that is not a URL", () => {
    expect(socialHandle("aceyourcourse")).toBeNull();
  });
});

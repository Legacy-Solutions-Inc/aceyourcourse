import { describe, expect, it } from "vitest";

import { truncate } from "./text";

describe("truncate", () => {
  it("leaves text that fits as it is", () => {
    expect(truncate("CELE Reviewer", 13)).toBe("CELE Reviewer");
  });

  it("cuts at a word, so the result with its ellipsis fits", () => {
    expect(truncate("Formula flash cards for the CELE", 21)).toBe("Formula flash cards…");
    expect(truncate("Formula flash cards for the CELE", 20)).toBe("Formula flash…");
  });
});

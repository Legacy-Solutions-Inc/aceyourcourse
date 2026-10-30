import { describe, expect, it } from "vitest";

import { listNumber, truncate } from "./text";

describe("truncate", () => {
  it("leaves text that fits as it is", () => {
    expect(truncate("CELE Reviewer", 13)).toBe("CELE Reviewer");
  });

  it("cuts at a word, so the result with its ellipsis fits", () => {
    expect(truncate("Formula flash cards for the CELE", 21)).toBe("Formula flash cards…");
    expect(truncate("Formula flash cards for the CELE", 20)).toBe("Formula flash…");
  });
});

describe("listNumber", () => {
  it("numbers from 01, given a zero-based index", () => {
    expect(listNumber(0)).toBe("01");
    expect(listNumber(8)).toBe("09");
  });

  it("keeps two digits and more as they are", () => {
    expect(listNumber(9)).toBe("10");
    expect(listNumber(99)).toBe("100");
  });
});

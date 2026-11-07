import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("lets a later class win a conflict", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("keeps a brand shadow's size when a shadow colour is added", () => {
    // Shopee's button on the orange store band: a cream hard shadow, not none.
    expect(cn("shadow-hard hover:shadow-hard-md", "shadow-ayc-cream")).toBe(
      "shadow-hard hover:shadow-hard-md shadow-ayc-cream",
    );
  });

  it("lets a later brand shadow size replace an earlier one", () => {
    expect(cn("shadow-hard", "shadow-hard-sm")).toBe("shadow-hard-sm");
    expect(cn("shadow-note", "shadow-panel")).toBe("shadow-panel");
  });
});

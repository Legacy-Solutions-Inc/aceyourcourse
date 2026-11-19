import { describe, expect, it } from "vitest";

import { refusalText } from "./users-refusal";

// What the Users panels say about a refusal that isn't one field's (force
// sign-out; grant, extend and end access).

describe("refusalText", () => {
  it("gives the server's own message for the whole form", () => {
    expect(
      refusalText({
        kind: "invalid",
        fieldErrors: {},
        formError: "This Member has no CE Access Pass to extend. Grant one instead.",
      }),
    ).toBe("This Member has no CE Access Pass to extend. Grant one instead.");
  });

  it("says nothing changed for a refusal with no message of its own", () => {
    expect(refusalText({ kind: "invalid", fieldErrors: {} })).toBe("Nothing was changed.");
  });

  it("gives an Editor the Owners-only message", () => {
    expect(
      refusalText({ kind: "forbidden", message: "ONLY AN OWNER CAN GRANT, EXTEND OR END ACCESS" }),
    ).toBe("ONLY AN OWNER CAN GRANT, EXTEND OR END ACCESS");
  });

  it("says a Member who is gone changed nothing", () => {
    expect(refusalText({ kind: "not-found" })).toBe(
      "This Member isn’t there any more, so nothing was changed.",
    );
  });

  it("asks for a reload after a conflict", () => {
    expect(
      refusalText({ kind: "conflict", savedBy: null, savedAt: "2026-11-19T03:42:00.000Z" }),
    ).toBe("Nothing was changed. Reload the page and try again.");
  });
});

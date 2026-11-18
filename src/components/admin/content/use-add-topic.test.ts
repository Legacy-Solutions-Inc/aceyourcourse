import { describe, expect, it } from "vitest";

import { nameError, refusalText } from "./use-add-topic";

// What a refused or failed Topic save says (Phase 3, tickets 05 and 13): the
// name field's own message when the refusal has one, and otherwise a line for
// each kind of refusal, shown in the field by "+ Add topic", "+ New topic"
// and Rename.

describe("nameError", () => {
  it("is the name field's message from a refused save", () => {
    expect(
      nameError({
        status: "refused",
        error: { kind: "invalid", fieldErrors: { name: ["MSTC ALREADY HAS IT"] } },
      }),
    ).toBe("MSTC ALREADY HAS IT");
  });

  it("is nothing for a refusal of another kind, a save that failed, or one that saved", () => {
    expect(nameError({ status: "refused", error: { kind: "not-found" } })).toBeUndefined();
    expect(nameError({ status: "failed" })).toBeUndefined();
    expect(nameError({ status: "saved", value: null })).toBeUndefined();
  });
});

describe("refusalText", () => {
  it("says what each refusal means", () => {
    expect(
      refusalText({
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "TOO LONG" },
      }),
    ).toBe("TOO LONG");
    expect(refusalText({ status: "refused", error: { kind: "invalid", fieldErrors: {} } })).toBe(
      "NOT SAVED · CHECK THE NAME",
    );
    expect(
      refusalText({
        status: "refused",
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN DO THIS" },
      }),
    ).toBe("ONLY AN OWNER CAN DO THIS");
    expect(refusalText({ status: "refused", error: { kind: "not-found" } })).toBe(
      "THAT TOPIC OR SUBJECT IS GONE · RELOAD THE PAGE",
    );
    expect(
      refusalText({
        status: "refused",
        error: { kind: "conflict", savedBy: null, savedAt: "2026-11-19T00:00:00.000Z" },
      }),
    ).toBe("NOT SAVED · RELOAD THE PAGE AND TRY AGAIN");
  });

  it("says to check the connection when the save broke down, and nothing before any answer", () => {
    expect(refusalText({ status: "failed" })).toBe(
      "COULDN’T SAVE · CHECK YOUR CONNECTION AND TRY AGAIN",
    );
    expect(refusalText({ status: "idle" })).toBe("");
  });
});

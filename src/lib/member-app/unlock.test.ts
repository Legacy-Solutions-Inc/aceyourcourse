import { describe, expect, it } from "vitest";

import { unlockRoute } from "./unlock";

// Where a lock sends a Member (Phase 4, ticket 02; spec, Phase 4 planning
// decisions → Who buys, and which Exams; story 151e): to the Exam's Plans
// while it has a Plan on sale, otherwise to the "contact us" note.

describe("unlockRoute", () => {
  it("leads to the Exam's Plans while it has a Plan on sale", () => {
    expect(unlockRoute("CE", ["CE", "ME"], "help@example.com")).toEqual({
      kind: "plans",
      href: "/app/plans?exam=CE",
    });
  });

  it("keeps the contact us note for an Exam with nothing on sale", () => {
    expect(unlockRoute("EE", ["CE", "ME"], "help@example.com")).toEqual({
      kind: "contact",
      contactEmail: "help@example.com",
    });
  });

  it("keeps the contact us note while nothing is on sale at all", () => {
    expect(unlockRoute("CE", [], "help@example.com")).toMatchObject({ kind: "contact" });
  });
});

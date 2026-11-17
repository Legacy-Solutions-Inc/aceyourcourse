import { describe, expect, it } from "vitest";

import { memberAppGate } from "./gate";

// The Member App gate (spec, Phase 3 → The beta gate). While the Member App
// switch is off, only active Staff and Beta Testers get past sign-in, and only
// by a verified email. Removed Staff and unused Invites aren't active Staff,
// and a removed tester isn't a Beta Tester: the callers read both lists on
// every request, so here each is simply "no".
describe("memberAppGate", () => {
  const someone = { emailVerified: true, activeStaff: false, betaTester: false };

  describe("while the switch is off", () => {
    it.each([
      ["an active Staff User", { activeStaff: true }, "open"],
      ["a Beta Tester", { betaTester: true }, "open"],
      [
        "an active Staff User who is also a Beta Tester",
        { activeStaff: true, betaTester: true },
        "open",
      ],
      ["removed Staff", { activeStaff: false }, "not-open-yet"],
      ["Staff with an Invite they haven't used", { activeStaff: false }, "not-open-yet"],
      ["a removed tester", { betaTester: false }, "not-open-yet"],
      ["anyone else", {}, "not-open-yet"],
    ] as const)("%s: %j is %s", (_who, lists, expected) => {
      expect(memberAppGate({ live: false, ...someone, ...lists })).toBe(expected);
    });

    it.each([
      ["an active Staff User", { activeStaff: true }],
      ["a Beta Tester", { betaTester: true }],
      ["both", { activeStaff: true, betaTester: true }],
      ["neither", {}],
    ] as const)("never lets an unverified email match: %s", (_who, lists) => {
      expect(memberAppGate({ live: false, ...someone, ...lists, emailVerified: false })).toBe(
        "not-open-yet",
      );
    });
  });

  describe("once the switch is on", () => {
    it.each([
      ["an active Staff User", { activeStaff: true }],
      ["a Beta Tester", { betaTester: true }],
      ["a removed tester or removed Staff", {}],
      ["anyone else", {}],
    ] as const)("lets %s in", (_who, lists) => {
      expect(memberAppGate({ live: true, ...someone, ...lists })).toBe("open");
    });

    it("still needs a verified email: a Member is known by theirs", () => {
      expect(memberAppGate({ live: true, ...someone, emailVerified: false })).toBe("not-open-yet");
    });
  });
});

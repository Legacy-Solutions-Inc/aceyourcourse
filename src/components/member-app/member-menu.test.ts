import { describe, expect, it } from "vitest";

import { firstName, isCurrentItem, MEMBER_MENU, memberScreen } from "./member-menu";

// The Member App's fixed menu (Member App BUILD-MAP §2): seven numbered items,
// the same for every Member.
describe("MEMBER_MENU", () => {
  it("lists the seven screens, numbered 01 to 07, each with its hint", () => {
    expect(MEMBER_MENU.map((item) => [item.code, item.label, item.hint, item.href])).toEqual([
      ["01", "Home", "Countdown, streak and progress", "/app"],
      ["02", "Library", "Flash cards, quizzes, reviewers", "/app/library"],
      ["03", "Courses", "Video lessons", "/app/courses"],
      ["04", "Plans", "Buy or renew access", "/app/plans"],
      ["05", "Billing", "Payments and receipts", "/app/billing"],
      ["06", "Account", "Exam date and privacy", "/app/account"],
      ["07", "Support", "Contact us", "/app/support"],
    ]);
  });
});

describe("memberScreen", () => {
  it("finds a screen that isn't built yet by its address", () => {
    expect(memberScreen("library")).toMatchObject({ label: "Library", code: "02" });
    expect(memberScreen("support")).toMatchObject({ label: "Support" });
  });

  it.each(["home", "", "sign-in", "not-open-yet", "nonsense", "Library"])(
    "knows no screen at %j",
    (segment) => {
      expect(memberScreen(segment)).toBeNull();
    },
  );
});

describe("isCurrentItem", () => {
  it.each([
    ["/app", "/app", true],
    ["/app/library", "/app", false],
    ["/app/library", "/app/library", true],
    ["/app/library/simple-curves", "/app/library", true],
    ["/app/library-old", "/app/library", false],
    ["/app/plans", "/app/library", false],
  ])("on %s, %s is current: %s", (pathname, href, expected) => {
    expect(isCurrentItem(pathname, href)).toBe(expected);
  });
});

describe("firstName", () => {
  it.each([
    [{ name: "Bea Tester", email: "tester@example.com" }, "Bea"],
    [{ name: "  Angel Rose L. Lepaña ", email: "angel@aceyourcourse.ph" }, "Angel"],
    [{ name: "Cher", email: "cher@example.com" }, "Cher"],
    [{ name: null, email: "tester@example.com" }, "tester"],
    [{ name: "   ", email: "sam.stranger@example.com" }, "sam.stranger"],
  ])("greets %j as %s", (member, expected) => {
    expect(firstName(member)).toBe(expected);
  });
});

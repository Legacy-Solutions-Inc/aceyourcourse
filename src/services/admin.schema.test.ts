import { describe, expect, it } from "vitest";

import {
  cardFormSchema,
  endAccessInputSchema,
  extendAccessInputSchema,
  fieldErrorsOf,
  grantAccessInputSchema,
  newCardFormSchema,
  passwordSignInSchema,
  websiteSettingsUpdateSchema,
} from "./admin.schema";

// The Settings schema reads what the form sends, which is text, as well as the
// typed values the seam receives, so the Server Action and the seam parse with
// one schema. The seam's suite (admin.settings.test.ts) covers each rule.

const parse = (input: unknown) => websiteSettingsUpdateSchema.safeParse(input);
const errors = (input: unknown) => {
  const result = parse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("websiteSettingsUpdateSchema, from the form's text", () => {
  it("reads the trust figures' numbers, with or without thousands commas", () => {
    expect(
      parse({ shopStats: { rating: " 4.9 ", ratingCount: "1,234", followers: " 3.8K " } }),
    ).toEqual({
      success: true,
      data: { shopStats: { rating: 4.9, ratingCount: 1234, followers: "3.8K" } },
    });
  });

  it.each(["", "  ", "abc", "4,8", "4.9★", "0x4"])("refuses the rating %j", (rating) => {
    expect(errors({ shopStats: { rating, ratingCount: "1", followers: "1" } })).toEqual({
      "shopStats.rating": ["ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST"],
    });
  });

  it.each(["", "1.2k", "-1", "1.5", "0x10"])("refuses the number of ratings %j", (ratingCount) => {
    expect(errors({ shopStats: { rating: "4.8", ratingCount, followers: "1" } })).toEqual({
      "shopStats.ratingCount": ["ENTER A WHOLE NUMBER, 0 OR MORE"],
    });
  });

  it("reads an empty link as no link", () => {
    expect(
      parse({
        shopLinks: { shopee: "", lazada: " ", tiktok: "vt.tiktok.com/ZS49ve6cu/" },
        socialLinks: { tiktok: "", facebook: "", instagram: "" },
      }),
    ).toEqual({
      success: true,
      data: {
        shopLinks: { shopee: null, lazada: null, tiktok: "https://vt.tiktok.com/ZS49ve6cu/" },
        socialLinks: { tiktok: null, facebook: null, instagram: null },
      },
    });
  });

  it("refuses a links part that is missing a link, rather than clearing it", () => {
    expect(errors({ shopLinks: { shopee: "shopee.ph/aceyourcourse" } })).toEqual({
      "shopLinks.lazada": ["SHOULD BE A LAZADA.COM.PH LINK"],
      "shopLinks.tiktok": ["SHOULD BE A TIKTOK LINK"],
    });
  });

  it("gives the same answer when it parses its own output again", () => {
    const input = {
      contactEmail: " hello@aceyourcourse.ph ",
      shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "", tiktok: "" },
      socialLinks: { tiktok: "tiktok.com/@aceyourcourse", facebook: "", instagram: "" },
      shopStats: { rating: "4.9", ratingCount: "900", followers: "3.8K" },
    };
    const once = parse(input);
    if (!once.success) throw new Error("the form's input should parse");
    expect(parse(once.data)).toEqual(once);
  });
});

// The development password box (ticket 19): one message per empty field, the
// typed-email message for a malformed one. The password is taken as typed.
describe("passwordSignInSchema", () => {
  const signInErrors = (input: unknown) => {
    const result = passwordSignInSchema.safeParse(input);
    return result.success ? {} : fieldErrorsOf(result.error);
  };

  it("takes a typed email, trimmed, and the password exactly as typed", () => {
    expect(
      passwordSignInSchema.parse({ email: " angel@aceyourcourse.ph ", password: " pass word " }),
    ).toEqual({ email: "angel@aceyourcourse.ph", password: " pass word " });
  });

  it.each([
    [
      { email: "", password: "" },
      { email: ["Enter your email"], password: ["Enter your password"] },
    ],
    [{ email: "   ", password: "x" }, { email: ["Enter your email"] }],
    [{}, { email: ["Enter your email"], password: ["Enter your password"] }],
    [
      { email: "angel@", password: "x" },
      { email: ["Enter a valid email address, like name@example.com."] },
    ],
  ])("refuses %j", (input, expected) => {
    expect(signInErrors(input)).toEqual(expected);
  });
});

// The card editor's forms (ticket 07): a Server Action parses its input, then
// the seam parses what it got again, so parsing must give the same card twice.
describe("the card forms", () => {
  const TOPIC = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

  it("gives the card as saved: trimmed, a blank note as none, no image", () => {
    expect(
      newCardFormSchema.parse({ topic: TOPIC, front: " Grade ", back: "$x$\n", note: " " }),
    ).toEqual({ topic: TOPIC, front: "Grade", back: "$x$", note: null, image: null });
  });

  it.each([
    [
      "a new card",
      newCardFormSchema,
      { topic: TOPIC, front: "F", back: "B", note: "", image: null },
    ],
    [
      "an edited card",
      cardFormSchema,
      { id: TOPIC, front: "F", back: "B", note: "  n ", image: "uploads/x" },
    ],
  ] as const)("parses %s's own output to the same card", (_, schema, input) => {
    const once = schema.parse(input);
    expect(schema.parse(once)).toEqual(once);
  });

  it("names each field it refuses", () => {
    const parsed = cardFormSchema.safeParse({ id: TOPIC, front: "", back: "$x", note: 5 });
    expect(parsed.success).toBe(false);
    expect(parsed.error && fieldErrorsOf(parsed.error)).toEqual({ note: ["ENTER TEXT"] });

    const blank = cardFormSchema.safeParse({ id: TOPIC, front: "", back: "$x" });
    expect(blank.error && fieldErrorsOf(blank.error)).toEqual({
      front: ["ADD A FRONT TO SAVE"],
      back: ["The back has a $ with no closing $ (write a dollar sign as \\$)"],
    });
  });
});

// Grant, extend and end an Access Pass (ticket 17; spec, Phase 3 planning
// decisions → Grants and ending access). The panels send typed values or the
// custom days box's text; the seam parses with the same schemas.
describe("the Access Pass inputs", () => {
  const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";
  const grant = { userId: BEA, examCode: "CE", days: 30, reason: "Beta tester" };
  const errorsOf = (result: { success: boolean; error?: Parameters<typeof fieldErrorsOf>[0] }) =>
    !result.success && result.error ? fieldErrorsOf(result.error) : {};

  describe("grantAccessInputSchema", () => {
    it.each([30, 90, 180, 365, 1, 45, 364])("grants %i days", (days) => {
      expect(grantAccessInputSchema.parse({ ...grant, days })).toMatchObject({ days });
    });

    it("reads a custom number typed in the box", () => {
      expect(grantAccessInputSchema.parse({ ...grant, days: " 45 " })).toMatchObject({ days: 45 });
    });

    it.each([
      ["0 days", 0],
      ["366 days", 366],
      ["a part of a day", 1.5],
      ["a negative number", -30],
      ["text that isn't a number", "thirty"],
      ["an empty box", ""],
      ["no days", undefined],
    ])("refuses %s on the days field", (_, days) => {
      expect(errorsOf(grantAccessInputSchema.safeParse({ ...grant, days }))).toEqual({
        days: ["GRANT 1 TO 365 WHOLE DAYS"],
      });
    });

    it("reads the Exam as the catalogue holds it", () => {
      expect(grantAccessInputSchema.parse({ ...grant, examCode: " ce " })).toMatchObject({
        examCode: "CE",
      });
    });

    it("refuses no Exam on the Exam field", () => {
      expect(errorsOf(grantAccessInputSchema.safeParse({ ...grant, examCode: "" }))).toEqual({
        examCode: ["PICK AN EXAM"],
      });
    });

    it.each([
      ["no reason", undefined],
      ["an empty reason", ""],
      ["a reason of spaces", "   "],
    ])("refuses %s on the reason field", (_, reason) => {
      expect(errorsOf(grantAccessInputSchema.safeParse({ ...grant, reason }))).toEqual({
        reason: ["ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY"],
      });
    });

    it("keeps the reason trimmed", () => {
      expect(grantAccessInputSchema.parse({ ...grant, reason: "  Beta  " })).toMatchObject({
        reason: "Beta",
      });
    });
  });

  describe("extendAccessInputSchema", () => {
    it.each([3, 7, 14, 30])("extends by %i days", (days) => {
      expect(extendAccessInputSchema.parse({ ...grant, days })).toMatchObject({ days });
    });

    it.each([
      ["12 days", 12],
      ["90 days, a grant's", 90],
      ["0 days", 0],
      ["text that isn't a number", "seven"],
      ["no days", undefined],
    ])("refuses %s on the days field", (_, days) => {
      expect(errorsOf(extendAccessInputSchema.safeParse({ ...grant, days }))).toEqual({
        days: ["PICK 3, 7, 14 OR 30 DAYS"],
      });
    });

    it("refuses a reason of spaces", () => {
      expect(
        errorsOf(extendAccessInputSchema.safeParse({ ...grant, days: 7, reason: " " })),
      ).toEqual({ reason: ["ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY"] });
    });
  });

  describe("endAccessInputSchema", () => {
    it("takes the Member, the Exam and a reason", () => {
      expect(
        endAccessInputSchema.parse({ userId: BEA, examCode: "ce", reason: " Granted by mistake " }),
      ).toEqual({ userId: BEA, examCode: "CE", reason: "Granted by mistake" });
    });

    it.each([
      ["an empty reason", ""],
      ["a reason of spaces", "  "],
      ["a reason over 500 characters", "x".repeat(501)],
    ])("refuses %s on the reason field", (_, reason) => {
      expect(
        errorsOf(endAccessInputSchema.safeParse({ userId: BEA, examCode: "CE", reason })),
      ).toEqual({ reason: [expect.any(String)] });
    });
  });
});
